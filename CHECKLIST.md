# MVP Build Checklist

Scope: startup gate, invoice pipeline (OCR via LLM), manual transactions, CSV/XLSX import-export, full dashboard.
Cut: quote generator, `rate_cards`, multi-currency pockets, PWA/offline, fuzzy suggestions.

Two tiers per AGENT_CONTRACT.md: **[logic]** = tsc + mock-number test required. **[ui]** = tsc + real wiring (no disabled/unwired buttons), no mock-number test required. **[data-page]** = tsc + must query the DB for real, never `[]`/`0` placeholders. Check items off as PROGRESS.md marks the matching file(s) DONE — un-tick and flag for rework if PROGRESS.md says DONE but the item doesn't actually behave correctly (e.g. renders zeros, button does nothing). This file is for your own tracking — the agent's source of truth stays PROGRESS.md + git log.

## 0. Foundation
- [ ] [logic] DB client singleton (globalThis cache in dev, `PRAGMA foreign_keys = ON` set on the client) — test: two imports return same instance; a delete-cascade test against a real in-memory DB proves the pragma is actually in effect (a mocked test can't catch a missing pragma)
- [ ] [logic] Drizzle schema (3 tables) + migration — test: migration applies cleanly to a fresh DB
- [ ] [ui] `drizzle.config.ts` (dialect: turso)
- [ ] [ui] Root layout + guardrail integration (blocks all routes on startup-gate failure)
- [ ] [ui] Sidebar navigation — click-to-toggle only (not hover, not outside-click)
- [ ] [ui] Startup gate guardrail screen (renders correctly on failure)
- [ ] [logic] Startup gate check logic — test: missing env var → fails; failed `SELECT 1` → fails
- [ ] [logic] Money helper (rounding-once) — test: 5.6 + 4.9 minor units sums to 10.5 pre-round, resolves to one value, not 11 from independent rounding
- [ ] [logic] Diagnostics wrapper — test: thrown error → console.error receives full object incl. stack; client body has specific message, no stack/paths

## 1. Config
- [ ] [logic] Settings KV (DB → env fallback) — test: DB value present → used; DB empty + env set → env used; both empty → guardrail
- [ ] [logic] Primary/Secondary LLM dispatcher — test: mock Primary 429 → Secondary called exactly once, not looped
- [ ] [ui] Settings page data fetch (real values from DB/env, never fabricated)
- [ ] [ui] Settings page save action — actually POSTs/writes to the Settings table; encrypts `*_API_KEY` before storage (see encrypt/decrypt below); button is not disabled/unwired
- [ ] [ui] Settings page never sends a plaintext or encrypted secret value into a client-rendered field — prefill secret fields with an `isSet` flag or fixed placeholder only
- [ ] [logic] Opening balance conversion — test: input "1 000,00" → stored as 100000 minor units
- [ ] [logic] AES-256-GCM encrypt/decrypt — test: encrypt("test-key") → decrypt() returns "test-key" exactly; log line shows redacted value. **Not DONE until something in the real save path calls `encrypt()` and something in the real dispatch path calls `decrypt()`** — a passing unit test on an uncalled function does not satisfy this item.

## 2. Invoice Pipeline (OCR)
- [ ] [logic] Upload endpoint size/cap check — test: mock 16MB PDF → rejected pre-dispatch, no invoice row created
- [ ] [logic] Upload rate limit — test: N+1th request in window → 429 before provider dispatch
- [ ] [logic] LLM output Zod schema + defensive parse — test: response wrapped in ```json fences → parses; malformed JSON → rejected
- [ ] [logic] Data Sanity validation — test: Feb 30 rejected; year 1899 rejected; amount over cap rejected
- [ ] [logic] total_minor vs line_items sum check — test: total=1000, sum=990 → flagged for review
- [ ] [logic] Idempotency — test: same file hash uploaded twice → returns first invoice's id, no duplicate row. Store the hash/idempotency identity in a column whose name actually reflects it (this build uses the otherwise-unused `source_image`, since this build sends no images to storage) — never overwrite `raw_llm_response` with a hash; that column must hold the actual raw LLM text, since `invoice-confirm.ts` needs to re-derive `suggested_category` from it.
- [ ] [data-page] Review screen / Invoices list — fetches real `needs_review` invoices from the DB, filters/status badges work, confirm control disabled + `[Multicurrency soon]` badge for non-default-currency rows
- [ ] [logic] Confirm invoice → atomic transaction — test: total_minor=5000, currency=DEFAULT_CURRENCY → transaction has amount_minor=-5000, currency_code=DEFAULT_CURRENCY, category=invoice's suggested_category
- [ ] [logic] Currency Guard on confirm — test: invoice currency_code=EUR (≠ DEFAULT_CURRENCY=USD) → confirm rejected server-side before any DB transaction, no transaction row created, invoice stays needs_review
- [ ] [logic] Inline total-edit → atomic linked-transaction update — test: edit total 5000→6000 → linked transaction updates to -6000
- [ ] [ui] Invoices table Confirm button and inline total-edit control are wired to real endpoints, not decorative

## 3. Manual Transactions & Lists
- [ ] [logic] Manual entry form submit handler — test: submit $12.34 expense → persists as amount_minor=-1234
- [ ] [ui] Manual entry form UI, and its submit button actually calls the handler above (not an empty `onSubmit`)
- [ ] [logic] Transaction CRUD (list with filters, delete) — test: delete returns void and issues exactly one DB delete, no dead update-then-delete on the same row
- [ ] [data-page] Invoices page — table, filters, status badges, fetches real invoices from DB
- [ ] [data-page] Transactions page — filters, signed value display, fetches real transactions from DB
- [ ] [ui] Transactions table Delete button is wired to a real endpoint
- [ ] [logic] Delete invoice → source_invoice_id set NULL via DB `ON DELETE SET NULL` — test against a real in-memory DB (not a mock): insert invoice + linked transaction, delete the invoice, assert the transaction's source_invoice_id is now null. A mocked test cannot verify this because it can't catch a missing `PRAGMA foreign_keys = ON`.

## 4. Import / Export
- [ ] [logic] CSV import parser — test: semicolon-delimited mock file with ISO-8859-2 chars parses correctly
- [ ] [logic] XLSX import parser — test: mock .xlsx with 10 rows parses to 10 records
- [ ] [ui] Column Mapping Screen UI (5-row preview rendering)
- [ ] [logic] Pre-signed number detection — test: amount "-50.00" with no direction column/override → isIncome=false; mapped direction column overrides the sign; explicit per-row override beats both
- [ ] [logic] Override application logic — test: mock 8-row file, set an override on specific row indices (e.g. 3 and 7) → only those rows carry the override, all other rows keep their mapped/sign-inferred value. (Distinct from: an override set while only 5 rows are visible in the preview must still be capturable/applicable to rows 6–8 — both behaviors need coverage.)
- [ ] [logic] Import persistence — test: mapped records → actually inserted into the transactions table with the right sign and DEFAULT_CURRENCY; a row with an unparseable date is skipped and reported, not thrown
- [ ] [ui] "Import All Rows" button is wired to the persistence function above, not decorative
- [ ] [logic] CSV export — test: mock transaction exports to exact `date;description;amount;currency;category;project` row
- [ ] [logic] XLSX export — test: mock export produces numeric amount cell + native date cell
- [ ] [ui] Export CSV/XLSX buttons are wired to a real download, not `disabled`

## 5. Dashboard
- [ ] [logic] Pending Invoices count — test: mock 3 needs_review + 2 confirmed → returns 3
- [ ] [logic] Net Monthly Delta — test: mock transactions across two months → only current month summed
- [ ] [logic] Current Position — test: opening balance 10000 + confirmed sum 2500 → returns 12500
- [ ] [logic] 3-Month Moving Average — test: mock 4 months → uses only 3 complete prior months, excludes current partial
- [ ] [logic] 30/60/90 Projections — test: Current Position=10000, Moving Average=500, 30-day-month assumption → 30-day=10500, no hardcoded zero
- [ ] [logic] Chart month labels — test: mock data spanning Dec→Jan → labels stay in sync with buckets
- [ ] [data-page] Dashboard page integration — calls the lib functions above server-side and renders their real results; a page with numeric cards but no rendered recharts line chart, or with any hardcoded 0/[] value, is not DONE
- [ ] [ui] Method badge rendering

## 6. Integration Smoke Tests
- [ ] [data-page] Invoice flow: upload mock invoice → appears in invoices table → confirm → appears in transactions table with category = suggested_category
- [ ] [data-page] Manual entry flow: fill form → submit → appears in transactions table
- [ ] [data-page] Dashboard flow: with confirmed transactions in DB → all cards show non-zero values, chart renders, projections compute
- [ ] [data-page] Import → Export flow: import CSV → column mapping → Import All Rows → rows appear in transactions table → export CSV → output matches spec format
- [ ] [data-page] Settings flow: save a new PRIMARY_API_KEY → stored encrypted in DB → dispatcher successfully decrypts and uses it on the next upload → key never appears in any client-visible response or rendered HTML

## Definition of done (per file)
[logic]: no TODO/placeholder, `tsc --noEmit` clean, mock-number test passing (spec-derived, per AGENT_CONTRACT.md), one scoped git commit.
[ui]: no TODO/placeholder, `tsc --noEmit` clean, renders/behaves per spec, every write-implying control (submit/confirm/delete/save/import/export) wired to a real endpoint, one scoped git commit.
[data-page]: no TODO/placeholder, `tsc --noEmit` clean, actually queries the DB — never `[]`/`0` — one scoped git commit.
When a file is committed DONE, also check off [x] the corresponding item(s) here.
