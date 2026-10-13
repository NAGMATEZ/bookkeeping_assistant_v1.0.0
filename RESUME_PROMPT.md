# Resume prompt (any session after the first)

Paste this + attach: AGENTS.md, spec.md, AGENT_CONTRACT.md, PROGRESS.md, Plan.md

---

Continuing this build. Read AGENTS.md, spec.md, and AGENT_CONTRACT.md, then PROGRESS.md and Plan.md. Per AGENT_CONTRACT.md's resume check: for every entry marked DONE, run `tsc --noEmit` + re-run its test + confirm a matching commit exists in git log before trusting it — downgrade to WIP if any of those three fails, and fix before continuing. Also run `git status --porcelain`: any uncommitted file the build/test infra depends on (config, test runner setup) is a gap, fix before continuing.

`tsc`/tests passing does not prove a UI-tier or data-page-tier file is actually correct — it only proves it compiles and doesn't crash. For every UI-tier file marked DONE, actually read the handler for each interactive control (submit/confirm/delete/save/import/export) and confirm it's wired to a real endpoint, not empty or `disabled`. For every data-page-tier file marked DONE, confirm it calls a real lib function and doesn't pass `[]`/`0`/an empty object as placeholder data. If either check fails, downgrade to WIP even though tsc+test passed — this is the actual bug pattern that has happened before in this project.

Do not re-read the full contents of files that pass every check above. Once verified, continue from PROGRESS.md's "Remaining work" line, same file-by-file / test-then-commit discipline as before.

---

Notes for you (not the agent): tick CHECKLIST.md by hand after each resume using PROGRESS.md's DONE lines. A session cut off mid-file (no commit yet) is caught automatically by the resume check — nothing lost, that file just gets finished or redone.
