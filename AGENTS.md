# Agent Instructions

Always read PLAN.md before making changes.

This project uses a strict micro-commit workflow.

For every task:

1. Identify the next incomplete step in PLAN.md.
2. Implement ONLY that step.
3. Do not implement future features early.
4. Keep changes minimal and scoped.
5. Run relevant lint/typecheck/tests after implementation.
6. Review the diff for unnecessary or generated code.
7. Report:
   - files changed
   - what was implemented
   - commands/tests run
   - any issues found
   - recommended commit message
8. Stop after completing the current step.

Architecture decisions in PLAN.md must not be changed without discussing them first.

Do not:
- add Docker
- add unnecessary abstractions
- implement optional features before mandatory ones
- use `any` without justification
- move filtering/sorting/pagination to the client
- weaken server-side authentication, authorization, or idempotency guarantees