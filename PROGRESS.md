Current focus: Section 0 Foundation — startup gate check logic (src/lib/startup-gate.ts)
Remaining work: Section 0 (startup gate logic, guardrail screen, sidebar, root layout), then Sections 1–6

- [DONE] src/db/schema.ts — 3-table Drizzle schema (invoices, transactions, settings) + initial migration — notes:
- [DONE] src/lib/db.ts — shared Turso/Drizzle singleton, PRAGMA foreign_keys = ON, globalThis-cached in dev — notes:
- [DONE] drizzle.config.ts — drizzle-kit config (dialect: turso), committed in fdaed1f — notes:
- [DONE] src/lib/money.ts — round-once minor-unit helpers + decimal→minor parser — notes: SUBMISSION_NOTES.md #1
- [DONE] src/lib/diagnostics.ts — redacting console.error logger + specific client failure messages — notes: