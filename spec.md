# Fintech Assistant MVP — Spec (compact)

Stack: Next.js App Router, TS strict, Turso+Drizzle, Zod, Tailwind+shadcn, recharts, papaparse, xlsx (SheetJS). No PDF/image conversion — files sent to LLM as base64 as-is.

Scope for this build: startup gate, invoice pipeline, manual transactions/lists, CSV/XLSX import-export, full dashboard (incl. moving average + 30/60/90 projections). NOT in scope: PWA/offline/service worker, multi-currency *activation* (schema keeps `currency_code` on both tables so 1.0.1 can turn it on without a migration, but this build enforces a single active currency via the Currency Guard below — non-default-currency invoices are accepted and stored, never blocked at ingestion, but cannot be confirmed into a transaction yet), fuzzy vendor/project suggestions, quote generator (and `rate_cards` table — dropped since nothing else uses it). Do not build the cut items even if convenient — flag as "deferred" in PROGRESS.md, don't implement.

## Invariants (apply everywhere, non-negotiable)

- **Money:** signed integer minor units only. No floats at storage boundary. Multi-step sums (tax, line items) keep full precision, round once at final persistence — never round-then-sum.
- **Currency:** every invoice/transaction has `currency_code` (ISO 4217). Never summed/converted across currencies. `OPENING_BALANCE_<CODE>` key convention in Settings.
- **Currency Guard (single-active-currency, this build):** a `DEFAULT_CURRENCY` Settings key (falls back to an env var of the same name → Guardrail if unset) names the one currency that can actually become a transaction. There is no per-installation currency picker beyond this one setting, and no manual-entry currency field — manual entries are always `DEFAULT_CURRENCY`. Invoice OCR is the only place a non-default currency can enter: the LLM's extracted `currency_code` is trusted and stored as extracted (never forced to default) for a *recognized* non-default code, and the invoice still lands in `needs_review` like any other. It can never be confirmed: confirm is rejected server-side with the message `"Multi-currency support is coming in a future release. This invoice is in {invoice_currency} but the active currency is {default_currency}. Non-{default_currency} invoices cannot be confirmed yet."`, and the Invoices page disables that row's confirm control with a `[Multicurrency soon]` badge carrying the same message. Because only confirmed invoices create transactions, every transaction row is guaranteed to be `DEFAULT_CURRENCY` — dashboard sums stay a plain single-currency sum, never a blend. This is the *only* invariant this revision should touch to enable 1.0.1 multi-currency: lift the confirm block, nothing else in the schema or pipeline needs to change.
- **Atomicity:** confirming an invoice is only permitted when its `currency_code` equals `DEFAULT_CURRENCY` (see Currency Guard) — a non-default invoice's confirm attempt is rejected before any DB transaction begins. For an eligible invoice: status=`confirmed` + create transaction (`amount_minor = -total_minor`, `currency_code` copied, `category` = the invoice's `suggested_category` from the LLM output, falling back to `"Invoice"` only if empty/missing) in one DB transaction. Updating a confirmed invoice's total updates its linked transaction atomically. Transaction `currency_code` is immutable post-creation.
- **Data sanity:** reject dates outside 1900–2100 / invalid month-day (no silent `Date` rollover). Cap any monetary amount at 1,000,000,000 minor units (= 10,000,000.00 in major units) per currency, server-side. If invoice `total_minor` ≠ sum of `line_items[].amount_minor` at full precision → flag for review, don't reject/auto-correct.
- **Diagnostics:** every catch block logs full error (stack included) via `console.error` before responding. Client body always has a real specific message (never bare status, never generic placeholder). Never leak stack traces/file paths to client. LLM provider rejection messages pass through verbatim to client.
- **Secret redaction:** never log decrypted API keys or `APP_ENCRYPTION_KEY` — redact value, keep stack/message.
- **DB constraints:** exactly 3 tables per schema below, no additions. Schema changes only via Drizzle migrations, never runtime DDL. `projects`/`vendors`/`categories` stay free-text.
- **Migration safety:** never hand-edit an applied migration — new migration for further change. Destructive migrations (`DROP TABLE/COLUMN`) flagged for human review, never auto-applied.
- **Idempotent invoice upload:** dedupe on content hash / client idempotency key before creating an invoice row — same file on retry returns existing invoice, never duplicates.
- **Security:** API keys AES-256-GCM at rest via `APP_ENCRYPTION_KEY`, decrypted in-memory only immediately before LLM dispatch, never reach client JS/API responses. This means: the encrypt function is called at the point a key is saved to Settings, and the decrypt function is called at the point the dispatcher reads it back — an encryption module that exists and passes its own unit test but is never called from the save path or the dispatch path does not satisfy this invariant. The Settings page must never send a real API key value (plaintext or encrypted) into a server-rendered prop passed to a client component, including into a masked/password-type field's `value` — client-rendered HTML is visible in page source regardless of input type. Prefill with an `isSet` boolean or a fixed placeholder; only write a new value when the user submits a non-empty one.
- **Startup gate:** centralized check (env vars present + real `SELECT 1` DB query) blocks all routes/API/Settings on failure, renders a clean guardrail screen.
- **Quality:** no `any`/`ts-ignore`/placeholders/TODOs/dead code/unused params.
- **API contracts:** every POST/PATCH/PUT documented in a code comment at the handler; callers only use documented fields.

## Schema (Drizzle, exact — do not add/rename/drop)

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const invoices = sqliteTable('invoices', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  vendor: text('vendor').notNull(),
  date: integer('date').notNull(),
  total_minor: integer('total_minor').notNull(),
  currency_code: text('currency_code').notNull(),
  project: text('project').notNull(),
  status: text('status', { enum: ['needs_review', 'confirmed'] }).notNull(),
  source_image: text('source_image'),
  line_items: text('line_items').notNull(), // JSON [{description, amount_minor}]
  raw_llm_response: text('raw_llm_response').notNull(),
  created_at: integer('created_at').$defaultFn(() => Math.floor(Date.now() / 1000)),
});

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  date: integer('date').notNull(),
  amount_minor: integer('amount_minor').notNull(),
  currency_code: text('currency_code').notNull(),
  category: text('category').notNull(),
  project: text('project').notNull(),
  description: text('description').notNull().default(''),
  source_invoice_id: text('source_invoice_id').references(() => invoices.id, { onDelete: 'set null' }),
  created_at: integer('created_at').$defaultFn(() => Math.floor(Date.now() / 1000)),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
```
3 tables for this build (`invoices`, `transactions`, `settings`) — `rate_cards` dropped, not needed without quote gen.
`drizzle.config.ts`: `dialect: 'turso'`. `_journal.json` may show `"dialect": "sqlite"` — expected, don't hand-edit.

## Item 0: Database Connection

- Exactly one Turso client + Drizzle instance for the whole app, created in a single module (e.g. `lib/db.ts`) and imported everywhere else — never instantiate `createClient`/`drizzle` inside a route handler, server action, or component.
- Env var: a single `DATABASE_URL` (libSQL/Turso URL with the auth token embedded as `?authToken=...`) — resolved once, in that one module (via `lib/db-config.ts`).
- Guard against Next.js dev hot-reload spawning duplicate clients: cache the instance on `globalThis` in development (standard pattern — same idea as the singleton fix for Prisma-style clients), reused as-is in production since serverless invocations are already isolated.
- The startup gate's `SELECT 1` check queries through this same shared instance — it does not open its own separate connection.

## Item 1: Config

KV store: `PRIMARY_BASE_URL/MODEL/API_KEY`, `SECONDARY_*`, `DEFAULT_CURRENCY` (ISO 4217, e.g. `USD`), `OPENING_BALANCE_<CODE>` (minor units, keyed to `DEFAULT_CURRENCY` in this build). Fallback: DB Settings → env vars (identical names) → Guardrail. Dispatcher retries once on Secondary if Primary throws network error/429/invalid JSON. Opening Balance field takes a decimal string, converts to minor units only at API boundary. The Settings page's save action must actually write to the Settings table (encrypting `*_API_KEY` values per the Security invariant before storage) — a settings form that renders every field correctly but has a disabled or unwired save button does not satisfy this item.

## Item 2: Invoice Pipeline

Input: PNG/JPEG/WEBP/PDF as base64, sent as-is to LLM. PDF cap: 15MB pre-base64 — reject at API boundary with clear message if exceeded, log via console.error, no invoice row created. Rate-limit upload endpoint per session/IP against runaway retry cost. On provider rejection (bad file etc.): catch, log full error, return provider's actual message to client.

Output contract (Zod-enforced):
```typescript
{ vendor: string, date: "YYYY-MM-DD", total_minor: number, currency_code: string,
  line_items: [{description: string, amount_minor: number}], suggested_category: string, project: string }
```
Parse defensively (strip markdown fences/prose). Validate date/amounts/currency per Data Sanity. `currency_code` must be a recognized ISO 4217 code; unrecognized/missing → default to `DEFAULT_CURRENCY`. A recognized code other than `DEFAULT_CURRENCY` is stored as extracted, not rejected or coerced — that's what drives the Currency Guard's confirm block. Mismatched total vs line-item sum → flag for review. All uploads land in `needs_review`.

## Item 3: Manual Transactions & Lists

All list/detail pages (invoices, transactions) are async server components that query the database via `lib/` functions before rendering — never pass an empty array literal or hardcoded placeholder to a table component. If the query result is genuinely empty, render an explicit "No data" state, not a silently-empty table indistinguishable from a page that never fetched anything.

Manual entry form: Date, Amount (decimal→minor units), Income/Expense toggle (sets sign), Category, Project, Description (must persist to `transactions.description`). Submitting the form calls a real endpoint that persists the transaction and shows success/error feedback — a form that renders correctly but has an empty submit handler is not complete.

Invoices page: table with filter (status/project/vendor), status badges, inline total-edit that PATCHes and atomically updates linked transaction. A `needs_review` invoice whose `currency_code` is not `DEFAULT_CURRENCY` additionally shows a `[Multicurrency soon]` badge, and its confirm control is disabled with a tooltip/message explaining that multi-currency support is coming in a future release (Currency Guard).

Transactions page: filterable list (project/category/date range), signed values shown explicitly (sign + color as secondary cue).

Delete sets `source_invoice_id` to NULL.

## Item 4: CSV/XLSX Import & Export

Import: papaparse for `.csv` (comma/semicolon, auto-detect delimiter, UTF-8/ISO-8859-2), xlsx for `.xlsx/.xls`. Single Column Mapping Screen previews first 5 rows, supports pre-signed numbers and per-row direction toggle. Pre-signed numbers: a leading `-` in the amount column means expense, a leading `+` means income; precedence lowest to highest is sign-based inference, then a mapped direction column, then an explicit per-row override (the user's direct action on that row always wins). Overrides captured during preview must apply to every imported row, not just the previewed 5. Import must actually write the mapped rows to the `transactions` table (each row is `DEFAULT_CURRENCY`, per the Currency Guard) — a mapping screen that previews correctly but has no working "Import" action is not complete.

Export: CSV (UTF-8, semicolon-delimited: `date;description;amount;currency;category;project`); XLSX (single sheet, native date/numeric cells, currency column). Export controls must be wired to a real download, not left disabled.

## Item 5: Dashboard (full)

The dashboard page is an async server component that calls the `lib/dashboard.ts` functions below and renders their real results — it must never render with hardcoded zeros, an empty projections object, or an unfetched pending count, even temporarily while other pieces are unfinished. If a dependency isn't ready, the page stays unbuilt (WIP), not shipped with placeholder numbers.

- Pending Invoices: count of `needs_review`. If one or more is non-`DEFAULT_CURRENCY` (blocked from confirming per the Currency Guard), show a small `"Multicurrency soon"` notice near this card — still include them in the count.
- Net Monthly Delta: `SUM(amount_minor)` for the current calendar month. Since the Currency Guard blocks any non-default-currency invoice from ever becoming a transaction, this is always a plain single-currency sum, never a blend.
- Current Position: `OPENING_BALANCE_<DEFAULT_CURRENCY>` + `SUM(amount_minor)` across all confirmed transactions.
- 3-Month Moving Average: average net change across the three most recent COMPLETE calendar months, strictly excluding the current, still-elapsing month from both the average and any weighting.
- Projections (30/60/90 Days): recharts line chart computing `Current Position + Moving Average × (Horizon Days / 30)` — projections assume 30-day months, since the moving average itself is a monthly figure. Fed by actual computed historical monthly buckets — `computeProjections` must never be called with hardcoded zero placeholders; drop unused params rather than passing dead data. Render an actual chart (recharts is a project dependency specifically for this) — a dashboard with numeric cards but no chart component does not satisfy this item. Show an explicit method badge: `"Method: Three-Month Moving Average + Opening Balance"`.
- Any month-index arithmetic for chart labels must be derived from the same year/month values used to fetch the underlying data — never computed independently, so labels can't drift out of sync with the data across a year boundary.

## UI/Layout


- Sidebar: click-to-toggle opens it; either clicking the toggle again or clicking anywhere outside the sidebar collapses it. On viewports where the sidebar and main content can't both fit at full width, the sidebar renders as an overlay with a backdrop/scrim above the content (not pushed inline beside it), so nav items and page content never occupy the same horizontal space at once; above that width it can push content normally. Sidebar container has a fixed width and overflow-hidden; nav labels use white-space: nowrap with text-overflow: ellipsis — never wrap mid-word or bleed into adjacent content.
- Responsive, not "mobile-first" as a fixed small-screen design: layout adapts fluidly across the full range of viewport sizes, from small phones up through large/8K monitors. No fixed-width centered container reproducing the same small size at every breakpoint — the UI should use the available screen space at whatever size it's rendered on.


## Out of scope (this build)

Multi-user/auth, multi-tenancy, quote generator, `rate_cards` table, OCR/rasterization libraries (files go to LLM as-is), server-side PDF rendering, floating-point money, live exchange rates, tax/VAT engine, PWA/offline, multi-currency pocket UI, fuzzy suggestions.
