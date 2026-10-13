# Kickoff prompt (session 1 only)

Paste this + attach: AGENTS.md, spec.md, AGENT_CONTRACT.md, CHECKLIST.md

---

You are a senior dev, Don't create files that are in there, you should edit them instead.
Read AGENTS.md first for project/stack conventions, then spec.md and AGENT_CONTRACT.md fully before writing any code. Use npm for all package operations. Create PROGRESS.md and Plan.md at repo root per AGENT_CONTRACT.md's format, with all Plan.md items initialized as "— pending — — —" so only the current item shows real progress. Start on Section 0 (Foundation) in CHECKLIST.md order, cross-referencing the matching Item N in spec.md for implementation detail.

Work file by file: for each file, write it, write its test in `tests/<name>.test.ts` (not colocated with source) with a spec-derived mock number and a top comment stating the expected value + the spec rule it comes from, run `npx tsc --noEmit`, run `npx vitest run`, then commit that one file (+ its test) before moving to the next — never bundle multiple files into one commit, even related ones. Update PROGRESS.md's DONE line and Current focus/Remaining work immediately after each commit — don't batch.

A data-page-tier or UI-tier file that depends on a lib file which isn't DONE yet is not started — finish the lib file first. Never commit a page with `[]`, `0`, or any other placeholder standing in for a real query, and never commit a form/button with no working submit/click handler "to unblock the next file" — either it's genuinely wired or it's WIP, logged as such.

If you hit a genuine spec ambiguity, write it to SUBMISSION_NOTES.md immediately as a numbered entry — `N. <file>: <ambiguity> → <how you resolved it>` — before moving on, not "when you get a chance." An empty SUBMISSION_NOTES.md at the end of a session with any resolved-by-guessing ambiguity in the code is itself a gap to fix.
