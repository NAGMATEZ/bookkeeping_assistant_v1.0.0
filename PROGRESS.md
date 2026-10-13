Current focus: Section 1 Config — LLM dispatcher with Secondary retry (src/lib/llm.ts)
Remaining work: Item 1 (LLM dispatcher, settings API route + save path, settings page + form, opening balance conversion), then Items 2–6

- [DONE] src/db/schema.ts — 3-table Drizzle schema (invoices, transactions, settings) + initial migration — notes:
- [DONE] src/lib/db.ts — shared Turso/Drizzle singleton, PRAGMA foreign_keys = ON, globalThis-cached in dev — notes:
- [DONE] drizzle.config.ts — drizzle-kit config (dialect: turso), committed in fdaed1f — notes:
- [DONE] src/lib/money.ts — round-once minor-unit helpers + decimal→minor parser — notes: SUBMISSION_NOTES.md #1
- [DONE] src/lib/diagnostics.ts — redacting console.error logger + specific client failure messages — notes:
- [DONE] src/lib/startup-gate.ts — env presence + real SELECT 1 check through shared db (mocked test) — notes:
- [DONE] src/components/layout/guardrail-screen.tsx — startup failure screen — notes:
- [DONE] src/components/layout/sidebar.tsx — click-to-toggle responsive sidebar (outside-click closes per spec) — notes: SUBMISSION_NOTES.md #2
- [DONE] src/app/layout.tsx — async layout gates pages on checkStartup, renders sidebar or guardrail — notes:
- [WIP] src/lib/encryption.ts — AES-256-GCM encrypt/decrypt + test pass; not DONE until settings save path calls encrypt() (next) — notes: SUBMISSION_NOTES.md #3
- [DONE] src/lib/settings.ts — resolveSetting DB→env fallback + getOpeningBalanceMinor — notes: SUBMISSION_NOTES.md #4