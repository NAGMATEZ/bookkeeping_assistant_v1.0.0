Current focus: Section 0 Foundation — money helper (src/lib/money.ts)
Remaining work: Section 0 (money helper, diagnostics, startup gate logic, guardrail screen, sidebar, root layout), then Sections 1–6

- [DONE] src/db/schema.ts — 3-table Drizzle schema (invoices, transactions, settings) + initial migration — notes:
- [DONE] src/lib/db.ts — shared Turso/Drizzle singleton, PRAGMA foreign_keys = ON, globalThis-cached in dev — notes:
- [DONE] drizzle.config.ts — drizzle-kit config (dialect: turso), committed in fdaed1f — notes: