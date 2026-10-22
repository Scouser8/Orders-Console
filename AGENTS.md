# Agent Instructions

Always read PLAN.md before making changes.

This project uses a strict micro-commit workflow. PLAN.md section 18 is the authoritative numbered completion checklist; section 17 is a priority overview.

Follow the requested kind of work:

- Writing, reviewing, and discussing documentation are normal project tasks. Write or revise Markdown when requested; do not limit documentation tasks to commentary.
- Review or planning requests do not authorize application changes. Requested plan/workflow revisions do not authorize starting a feature.

For implementation requests:

1. Identify the next incomplete step in PLAN.md section 18.
2. Implement ONLY that step. Do not implement future features early.
3. Keep changes minimal and scoped; ship required authentication, authorization, validation, cancellation, and idempotency with the behavior they protect.
4. Run relevant lint/typecheck/focused tests, including affected existing behavior where regressions are plausible. For documentation-only changes, review content and run applicable diff/format checks instead of application tests.
5. Review the diff for unnecessary or generated code, dead code, and debug leftovers.
6. Update section 18 completion status after successful verification. Leave incomplete steps unchecked and record issues or partial progress. Documentation-only revisions must not mark unimplemented features complete.
7. Report:
   - files changed
   - what was implemented or revised
   - commands/tests run
   - any issues found
   - recommended commit message
8. The user reviews and creates the micro-commit. Provide the recommended message; do not commit automatically.
9. Stop after completing the current step. Do not automatically start the next one.

Architecture decisions in PLAN.md must not be changed without discussing them first. Explain new dependencies before adding them. Preserve strict TypeScript typing and the agreed stack.

The user controls scheduling. Do not stop or reduce scope based on elapsed time. Document gaps and actual AI usage honestly. Do not submit work or contact reviewers without an explicit user request.

Code organization:

- Follow the feature-based frontend/backend layouts in PLAN.md sections 9–10. Keep components/controllers/services focused and feature ownership clear.
- Frontend features separate `api/`, `components/`, `hooks/`, `schemas/`, `types/`, `utils/`, and `constants/` as needed. Put actual cross-feature reuse under `shared/` with the same responsibility separation.
- Backend modules separate `dto/`, `types/`, `utils/`, and `constants/` as needed; auth guards/decorators have dedicated folders. Use `common/` only for actual cross-feature reuse.
- Use descriptive filenames. Keep nontrivial types, hooks, utilities, and constants out of component/controller bodies. Create folders when code needs them; avoid empty scaffolding, duplicate ownership, and catch-all helper files.
- Extract reusable components and helpers when actual reuse or complexity warrants it; avoid speculative abstractions and unrelated refactors.
- Use typed constants for statuses, roles, query keys, configurable limits, and meaningful repeated values. Keep business values and repeated option definitions outside JSX; ordinary labels and one-off presentation text may remain inline.
- Keep feature constants close to their code and share only what is actually shared.

Setup and acceptance:

- Maintain `.env.example` with every required setting and safe placeholders. Do not create, read, or commit a real `.env`; keep real environment files ignored.
- Keep README concise and assessment-focused; avoid schema walkthroughs or internal maintenance manuals.
- Keep README instructions current: supported Node/npm versions, installation, local configuration and JWT-secret generation, database initialization, seeding, running both apps, URLs, demo login, and tests. Verify from a clean starting point before completion.
- Add root `npm run db:seed` and `npm run test:duplicate` with their respective implementation steps, not during documentation-only work. Store hashed demo passwords in the database; readable demo credentials may appear in README.
- R1 must pass three rapid filter changes with delayed earlier responses: older results cannot override the latest filter.
- R2 must use server validation, atomic persistence, server-calculated totals, and database-enforced idempotency. Its authenticated parallel-request proof must verify exactly one persisted order and exit unsuccessfully on duplication.
- Fix the supplied middleware's actual problems in NestJS and document findings and fixes. Verify invalid-token rejection, password hashing, and admin-only deletion.

Do not:

- add Docker or deployment configuration
- add unnecessary abstractions
- implement optional features before mandatory ones, or more than one optional assessment feature
- use `any` without justification
- move filtering/sorting/pagination to the client
- weaken server-side authentication, authorization, or idempotency guarantees
- introduce intentionally insecure intermediate routes
- implement bulk deletion from the written product question
