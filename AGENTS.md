<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version (16.2.12) has breaking changes — APIs, conventions, and file structure may all differ from your training data. Route handler `params` are `Promise`-wrapped (`{ params }: { params: Promise<{ id: string }> }`, `await` before use). Read the relevant guide in `node_modules/next/dist/docs/` before writing any code; if that path is empty or source-only, consult the Next.js docs for the installed version (check `package.json`) instead. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Governing documents (read in this order)
1. AGENT_CONTRACT.md — operating rules, test requirements, tiers, git discipline
2. spec.md — feature specification and invariants
3. CHECKLIST.md — human tracking checklist (agent's source of truth is PROGRESS.md + git log, not this file)
4. PROGRESS.md — current build state

# Project structure
```
src/
  lib/         — business logic, DB queries, utilities (no JSX)
  db/          — Drizzle schema + migrations
  app/         — Next.js App Router pages and API routes (src/app/api/**/route.ts)
  components/  — React components, subfolders by feature (invoices/, transactions/, manual/, import/, settings/, layout/, ui/)
tests/         — Vitest test files (not colocated with source)
drizzle/       — generated SQL migrations (never hand-edit an applied one)
```

# Stack specifics
- DB: Turso (libsql) via Drizzle ORM. One shared client in `src/lib/db.ts`, `PRAGMA foreign_keys = ON` must be set on that client or `ON DELETE`/`ON UPDATE` foreign key actions in the schema are silently ignored by SQLite/libsql — this is easy to miss because everything else still works.
- UI primitives: `@base-ui/react`, scaffolded via the `shadcn` CLI into `src/components/ui/`. Check that directory for the current list before building a control from scratch.
- Testing: Vitest (`vitest.config.ts` at repo root — commit this file and the `test` script in `package.json`; without them a fresh clone can't run tests at all). Tests live in `tests/*.test.ts`, run with `npx vitest run`. Mock the DB with `vi.mock("@/lib/db", ...)`; use `vi.hoisted()` for mock factories that must run before imports.
- Package manager: npm (`npm install`, `npx vitest run`, `npx tsc --noEmit`).

# The most common failure mode in this codebase
A component/route that *renders* or *exists* correctly but isn't *wired*: a save button with no `onClick`, a form with an empty `onSubmit`, a page that fetches nothing and passes `[]`/`0` to its children, a validated/tested value that's computed and then discarded instead of persisted, a helper (e.g. encryption) that's implemented and unit-tested but never actually called from the real request path. `tsc --noEmit` and even a passing test suite will not catch any of these — they require actually exercising the feature end to end (or reading the handler/onClick line by line) before marking DONE. See AGENT_CONTRACT.md's UI-tier and data-page-tier definitions, which exist specifically to close this gap.
