Current focus: Section 2 Invoice Pipeline — upload endpoint (src/app/api/invoices/route.ts)
Remaining work: Item 2 (upload route test, invoices page + table, upload form), then Items 3–6

- [DONE] src/db/schema.ts — 3-table Drizzle schema (invoices, transactions, settings) + initial migration — notes:
- [DONE] src/lib/db.ts — shared Turso/Drizzle singleton, PRAGMA foreign_keys = ON, globalThis-cached in dev — notes:
- [DONE] drizzle.config.ts — drizzle-kit config (dialect: turso), committed in fdaed1f — notes:
- [DONE] src/lib/money.ts — round-once minor-unit helpers, decimal parser, minor→decimal formatter — notes: SUBMISSION_NOTES.md #1
- [DONE] src/lib/diagnostics.ts — redacting console.error logger + specific client failure messages — notes:
- [DONE] src/lib/startup-gate.ts — env presence + real SELECT 1 check through shared db (mocked test) — notes:
- [DONE] src/components/layout/guardrail-screen.tsx — startup failure screen — notes:
- [DONE] src/components/layout/sidebar.tsx — click-to-toggle responsive sidebar (outside-click closes per spec) — notes: SUBMISSION_NOTES.md #2
- [DONE] src/app/layout.tsx — async layout gates pages on checkStartup, renders sidebar or guardrail — notes:
- [DONE] src/lib/encryption.ts — AES-256-GCM; encrypt() called by settings save route, decrypt() by llm dispatch — notes: SUBMISSION_NOTES.md #3
- [DONE] src/lib/settings.ts — resolveSetting DB→env fallback + getOpeningBalanceMinor — notes: SUBMISSION_NOTES.md #4
- [DONE] src/lib/llm.ts — primary/secondary dispatcher, single retry on network/429/invalid JSON, key decryption — notes:
- [DONE] src/app/api/settings/route.ts — settings save endpoint (encrypts keys, converts opening balance, gates on startup) — notes:
- [DONE] src/components/settings/settings-form.tsx — wired settings form, API keys never prefilled from server — notes:
- [DONE] src/app/settings/page.tsx — real settings fetch, passes key-set flags only — notes:
- [DONE] src/lib/dates.ts — 1900–2100 calendar validation + YYYYMMDD conversions (SUBMISSION_NOTES #5) — notes: SUBMISSION_NOTES.md #5
- [DONE] src/lib/invoice-parse.ts — Zod contract, fence stripping, date/amount/currency sanity, line-item mismatch flag — notes:
- [DONE] src/lib/upload-guard.ts — 15MB cap all types + 10/10min per-IP rate limiter — notes: SUBMISSION_NOTES.md #6
- [DONE] src/lib/invoices.ts — hash dedupe, create/confirm/currency guard/total-edit via atomic batch, filtered list — notes: SUBMISSION_NOTES.md #7