# SARH Orders Console — Implementation Plan

## 1. Goal

Build the smallest clean full-stack implementation that satisfies the SARH Senior Full Stack Developer assessment.

The submission must prioritize:

1. Correctness
2. Performance
3. Security
4. Code quality
5. Clear technical decisions
6. A readable micro-commit history
7. Senior-level judgment in `SCALE.md`

Avoid unnecessary architecture, UI polish, deployment work, Docker, and broad test coverage unless all mandatory work is already complete.

### Assessment constraints

- The user controls scheduling and when to stop. Do not stop or reduce scope based on elapsed time.
- Everything must run locally from the README in under five minutes. Do not use paid or hosted services.
- Maintain `.env.example` with all required settings and safe placeholders. Do not create, read, or commit a real `.env` or secrets; keep real environment files ignored. README must explain how users provide their own local configuration and generate their own JWT secret. Seeded demo passwords may appear in README; store only password hashes in the database.
- Submit a Git repository link with readable history; if private, grant reviewer access.
- Submission or contacting reviewers requires an explicit user request.
- The implementation must be understandable and modifiable during the live walkthrough. Disclose actual AI usage and all omissions.

---

## 2. Agreed Tech Stack

The assessment permits React 18+, a Node.js backend, and any real database. NestJS, Prisma/SQLite, the libraries below, and cursor pagination with infinite scrolling and virtualization are agreed project choices, not additional assessment mandates. Preserve them unless discussed first.

### Frontend

- React 18+
- Vite
- TypeScript
- React Router
- TanStack Query
- TanStack Table
- TanStack Virtual
- React Hook Form
- Zod
- Tailwind CSS
- Selective shadcn/ui primitives only where useful

### Backend

- NestJS
- TypeScript
- Prisma
- SQLite
- JWT authentication
- Password hashing with bcrypt or argon2
- DTO validation with Nest validation pipes

### Repository

Use one Git repository with npm workspaces.

Recommended structure:

```text
orders-console/
├── apps/
│   ├── web/
│   └── api/
├── README.md
├── DECISIONS.md
├── SCALE.md
├── PLAN.md
├── package.json
├── package-lock.json
├── .gitignore
└── .editorconfig
```

Do not create separate repositories for frontend and backend.

---

## 3. Core Architecture Decisions

### R1 — Orders List

Use:

- Server-side search
- Server-side status filtering
- Server-side sorting
- Cursor/keyset pagination
- Infinite scrolling
- Virtualized row rendering

Frontend responsibilities:

- TanStack Table owns table UI state
- TanStack Query owns server state
- TanStack Virtual owns visible row rendering
- Backend owns filtering, searching, sorting, and pagination

Do not load all orders into the browser.

### Cursor Pagination

Prefer keyset/cursor pagination over offset pagination because the UI uses infinite scrolling and does not need random page access.

The cursor must include the active sort value plus a stable unique tie-breaker.

Examples:

```text
createdAt + id
totalAmount + id
```

Search/filter/sort changes must start a fresh query from the beginning.

### Stale Request Protection

R1 must guarantee that older requests never replace newer results.

Use TanStack Query with a complete query key containing:

```text
search
status
sortBy
sortDirection
```

The query function must consume the provided `AbortSignal` and pass it into `fetch`. Verify three rapid filter changes while earlier responses are deliberately delayed: only results for the latest filter may be displayed.

---

## 4. R2 — Duplicate-Safe Order Creation

Use an idempotency-key strategy enforced by the database.

### Client

Generate one idempotency key for one logical order submission.

Reuse the same key across:

- double-clicks
- retries
- repeated requests after timeout

Generate a new key only for a new logical order.

### Server

Accept an `Idempotency-Key` header.

Store the key on the order or in a dedicated idempotency record.

Enforce uniqueness in the database.

The guarantee must not depend on disabling the submit button.

Create the order and its items atomically, and calculate the total on the server from validated quantities and unit prices. Do not trust a client-supplied total.

Before exposing the create endpoint, define and document key scope, matching-request replay responses, conflicting payload behavior, concurrent-request handling, and retention limits. Account for single-order deletion: deleting an order must not silently remove the duplicate protection within its documented retention period. Document these guarantees and limits in the R2 decision in `DECISIONS.md`.

Do not expose an intermediate create endpoint without validation, authentication, atomicity, and database-enforced idempotency.

### Proof

Add an automated proof script or test that:

1. sends the exact same create-order request twice in parallel;
2. uses the same idempotency key;
3. verifies that exactly one order exists afterward.

Expose the required root-level command (delegating to the API workspace):

```bash
npm run test:duplicate
```

The proof must exercise authenticated HTTP requests, verify the persisted order count, and exit unsuccessfully if duplication occurs. Document its prerequisites and invocation in README.

---

## 5. Database Model

Initial model:

```text
User
- id
- email
- passwordHash
- role
- createdAt

Order
- id
- customerName
- customerEmail
- status
- totalAmount
- createdAt

OrderItem
- id
- orderId
- name
- quantity
- unitPrice

IdempotencyRecord
- userId + key UNIQUE (composite primary key)
- requestHash
- orderId UNIQUE, nullable after order deletion
- createdAt
```

Use the dedicated idempotency-record option from section 4. Scope keys to the authenticated user, and preserve records when their order is deleted. The schema uses `SetNull` for that order reference and cascading deletion for line items.

MVP assumptions: one currency (SAR, stored as integer halalas); roles `ADMIN`/`AGENT`; statuses `PENDING`, `PROCESSING`, `COMPLETED`, and `CANCELLED`. The initial migration enforces valid enums, nonnegative integer money within Prisma's `Int` range, and positive integer quantities. Document and preserve SQL-only checks when changing the schema.

Use integer smallest-currency units for money rather than floating-point values.

Seed:

- at least 50,000 orders
- 1–5 line items per order
- at least one ADMIN user
- at least one AGENT user

Expose the seed through root `npm run db:seed`, delegating to the API workspace. Add the command with the order-seeding step and extend the same seed with users in the next step. Document database setup and seed prerequisites in README.

Hash seeded passwords with bcrypt or argon2 when introducing the user seed, not in a later auth step. Never store plaintext passwords in the database. Readable demo credentials in README let reviewers log in; they are not production credentials.

The brief does not define status values, currency, or detailed field limits. Record reasonable assumptions before implementing the affected schema and validation.

---

## 6. Order Query Requirements

The Orders API must support:

```text
search by customer name or email
filter by status
sort by created date
sort by total amount
cursor pagination
limit
```

Example conceptual request:

```http
GET /api/orders?search=mohamed&status=PENDING&sortBy=createdAt&sortDirection=desc&cursor=...&limit=50
```

Example response shape:

```ts
{
  items: Order[];
  nextCursor: string | null;
}
```

Keep the cursor opaque to the frontend where practical.

Use stable sorting with `id` as the tie-breaker.

---

## 7. Database Indexes

Add only indexes that match real queries.

Likely candidates:

```text
status + createdAt + id
status + totalAmount + id
createdAt + id
totalAmount + id
```

Investigate how customer-name/email search behaves in SQLite before claiming a normal B-tree index improves arbitrary `%term%` search.

Document the actual indexing strategy in README or DECISIONS.md.

---

## 8. Authentication and Security

Use the assessment's intentionally insecure middleware and login/delete routes as the code-review subject. Document each problem and its corresponding fix, but implement the solution directly with NestJS guards and secure login. Do not add an intentionally insecure intermediate implementation.

Authenticate all `/api/orders` routes. Project permission defaults:

- ADMIN and AGENT may list and create orders.
- Only ADMIN may call `DELETE /api/orders/:id`; enforce this with a server-side role guard.
- Implement single-order deletion for the mandatory security task. Do not implement bulk deletion or an unnecessary deletion UI.

Required fixes include:

- no hardcoded JWT secret
- verify JWT signatures instead of decoding only
- do not accept auth token through query parameters
- enforce authorization on the backend
- hash passwords
- set JWT expiry
- protect admin-only actions with a server-side role guard
- never rely on a React component for authorization

Suggested Nest components:

```text
auth/
├── auth.controller.ts
├── auth.service.ts
├── auth.module.ts
├── guards/
│   ├── jwt-auth.guard.ts
│   └── roles.guard.ts
└── dto/
```

Document all security problems found in the README.

Choose client token storage and transport before building the login flow. Include a two- or three-sentence README explanation of where the token is stored and which attacks that choice does and does not protect against.

Required focused security checks:

- Missing, malformed, forged, and expired tokens return `401` on protected order routes.
- A query-string token alone cannot authenticate; query-string credentials are never used.
- Authenticated AGENT deletion returns `403` and leaves the order intact.
- Authenticated ADMIN deletion succeeds for an existing order.
- Login verifies password hashes and issues expiring tokens; invalid credentials are rejected.

Apply authentication when each order route is introduced; do not defer protection to a later step.

---

## 9. Frontend Structure

Use feature ownership first, then separate responsibilities within each feature:

```text
apps/web/src/
├── features/
│   ├── auth/
│   └── orders/
│       ├── api/
│       ├── components/
│       ├── hooks/
│       ├── schemas/
│       ├── types/
│       ├── utils/
│       └── constants/
├── shared/
│   ├── api/
│   ├── components/ui/
│   ├── hooks/
│   ├── types/
│   ├── utils/
│   └── constants/
├── pages/
├── routes/
├── App.tsx
└── main.tsx
```

Apply the same responsibility-based layout to `auth` as needed. Feature API calls belong in the feature's `api/`; the shared HTTP client belongs in `shared/api/`. Pages compose feature components rather than owning their hooks, types, or business utilities.

Do not over-abstract early.

Start simple and only extract reusable code when duplication or complexity appears. Use a feature-based hierarchy: keep feature-specific components, schemas, types, and hooks together; use shared folders only for actual shared code. The tree above defines where code belongs when introduced; do not create empty folders or duplicate ownership. Keep nontrivial hooks, types, schemas, utilities, and constants in their dedicated locations instead of accumulating them in components. Use descriptive filenames such as `use-orders.ts`, `order.types.ts`, and `order-status.constants.ts` so ownership is traceable.

Keep components and services focused with clear frontend/API boundaries. Use typed constants for statuses, roles, query keys, configurable limits, and meaningful repeated values. Keep business values and repeated option definitions outside JSX; ordinary labels and one-off presentation text may stay inline. Keep constants close to their feature unless shared, and avoid a global constants layer or abstractions without a concrete need.

---

## 10. Backend Structure

Keep Nest modules feature-based and separate DTOs, types, utilities, and constants from controllers and services:

```text
apps/api/src/
├── auth/
│   ├── dto/
│   ├── guards/
│   ├── decorators/
│   ├── types/
│   ├── constants/
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   └── auth.module.ts
├── orders/
│   ├── dto/
│   ├── types/
│   ├── utils/
│   ├── constants/
│   ├── orders.controller.ts
│   ├── orders.service.ts
│   └── orders.module.ts
├── prisma/
├── common/
├── app.module.ts
└── main.ts
```

Create only the folders a feature actually needs; `auth` may also have `utils/` when needed. DTOs own request validation, types describe internal contracts, utilities hold pure helpers, and constants name domain values and limits. Keep controllers focused on HTTP handling and services on application/database behavior. Use descriptive filenames such as `create-order.dto.ts` and `order-query.constants.ts`.

Use `common/` only for code genuinely shared across backend features, organized into the same dedicated responsibility folders when needed. Keep auth guards/decorators under `auth/` unless they have a clearer shared owner. Do not turn `common/` or `utils/` into a catch-all or add layers merely to populate the tree.

Keep NestJS usage minimal.

Do not add:

- CQRS
- event buses
- microservices
- generic repository layers
- complex domain abstractions
- Swagger or other tooling without a concrete assessment need

---

## 11. Orders Table

Use TanStack Table for:

- column definitions
- sorting state
- filter state
- row model / table metadata

Use manual server-side modes where applicable.

Use TanStack Virtual to render only visible rows.

Use TanStack Query `useInfiniteQuery` for data loading.

Important:

The frontend must never sort/filter only the currently loaded subset when the user expects server-wide results.

---

## 12. UI Strategy

Use Tailwind CSS for layout and styling.

Use shadcn/ui selectively for small primitives such as:

- Button
- Input
- Select
- Dialog
- Card
- Skeleton / Spinner

Do not spend significant time building a design system.

The UI should be:

- clean
- readable
- responsive enough for normal desktop usage
- obviously usable

Pixel-perfect design is not a goal.

---

## 13. Create Order Form

Use:

- React Hook Form
- Zod
- repeatable line items

Fields:

```text
Customer Name
Customer Email
Items:
  Product/Name
  Quantity
  Unit Price
Calculated Total
```

Validate on:

- client
- server

The server remains authoritative and recalculates the total from validated items.

---

## 14. Optional Feature

Pick at most one optional assessment feature. Doing neither is acceptable.

Do not start an optional feature until every mandatory requirement, documentation file, and proof is complete and the user requests optional work.

Preferred optional feature if requested:

### O2 — Optimistic Create

Reason:

R1 already demonstrates cancellation behavior, so O1 partly repeats an existing strength.

O2 demonstrates:

- optimistic TanStack Query cache updates
- rollback
- reconciliation
- interaction with the idempotent create endpoint

Do not implement O2 if it risks R1, R2, security, README, DECISIONS.md, or SCALE.md quality.

---

## 15. Documentation

### README.md

Keep README concise and assessment-focused: setup/run/seed/test instructions, demo access, security findings and token storage, the product answer, indexes, and omissions. Keep detailed schema walkthroughs, numeric limits, and migration-maintenance explanations in the plan or relevant code instead.

Must contain:

- supported Node.js and npm versions, verified against the chosen dependencies
- an ordered fresh-clone walkthrough: clone, install, configure, initialize the database, seed, and start both apps
- required configuration matching `.env.example`, safe placeholders, and instructions for supplying local values and generating a JWT secret
- root `npm run db:seed`, creating at least 50,000 orders with 1–5 items each plus demo users
- exact database setup, frontend/backend run commands, local URLs/ports, and demo login instructions
- test commands, including root `npm run test:duplicate`, its prerequisites, expected proof output, and failure behavior
- readable demo credentials; make clear passwords are hashed in the database
- every code-review/security problem found in the supplied middleware and routes, and the corresponding fix
- client token-storage reasoning in two or three sentences
- product-question answer
- indexes used
- what was skipped and why

Verify this walkthrough from a clean starting point before completion. Keep instructions current alongside implementation and ensure no undocumented global tools or paid/hosted services are required. Use supplied environment values for verification without creating or reading a real `.env`.

### DECISIONS.md

Exactly three strong decisions, five to eight lines per decision. One must explain the R2 approach and its limits.

Recommended:

1. idempotency-key strategy for R2
2. cursor/keyset pagination vs offset
3. SQLite vs PostgreSQL

For each:

- decision
- serious alternative
- reason alternative was rejected

Also disclose actual AI usage clearly: name only tools actually used and describe their real contribution. Claim manual review or modification only when it occurred. Do not copy a stock disclosure that misrepresents the work.

### SCALE.md

One-page senior design memo grounded in the implemented code: 5 million orders, three developers, and agents in two countries using the console all day.

Discuss what changes, what stays, and what should be refused.

Likely changes:

- SQLite → PostgreSQL
- review/expand indexing
- keep keyset pagination
- stronger observability
- production-grade secrets management
- stronger operational monitoring
- possibly dedicated search capability only if justified by real search requirements

Likely keep:

- React SPA
- Nest modular monolith
- server authorization
- idempotency
- TanStack Query
- cursor pagination
- API boundaries

Likely refuse without evidence:

- premature microservices
- unnecessary active-active architecture
- Elasticsearch/OpenSearch only because the table is large
- irreversible bulk deletion without retention/recovery policy

---

## 16. Product Question

For the request:

> Delete all cancelled orders

Do not immediately implement hard deletion.

First ask why the operations lead needs it.

Possible concerns:

- visual clutter
- database size
- compliance
- accidental access
- reporting
- retention
- restoration/audit requirements

If the purpose is unclear, prefer proposing archive/hide plus a retention policy instead of irreversible bulk deletion.

Keep the final README answer to five lines maximum. This is a written product question, not authorization to build a bulk-delete or archive feature.

### Submission evidence

Provide either a two-minute screen recording or three screenshots demonstrating R1, including three rapid filter changes without stale results, and the R2 parallel-request duplicate proof. Preserve the repository history and include the repository link in the submission.

---

## 17. Implementation Priority

This is a priority overview, not a second task checklist. Section 18 is the authoritative source for step order and completion. After database preparation, finish authentication across backend and frontend, then R1 across both, then R2 across both. Keep a separate micro-commit for each checklist step.

### P0 — Core Mandatory Functionality

Workspace and environment setup; Prisma/SQLite schema and indexes; 50k order seed and hashed user seed; secure authentication and authorization; protected R1 API and frontend with cancellation; validated, atomic, idempotent R2 API and form; parallel duplicate proof.

### P1 — Mandatory Submission Work

Security review; README; DECISIONS.md; SCALE.md; fresh local setup verification; required recording or screenshots. `.env.example` is introduced during setup and verified here.

### P2 — Only If Safe

O2 optimistic create with rollback and reconciliation, minor UI improvements, and additional focused tests. Mandatory correctness/security checks belong to their feature steps, not P2.

---

## 18. Authoritative Micro-Step Checklist

This numbered checklist is the single source of implementation progress. For implementation, select only the next unchecked step. Writing, reviewing, and discussing documentation are normal project tasks: follow the user's request, and do not treat a discussion or review as authorization for application changes. Requested plan/workflow revisions do not authorize starting a feature.

For each step:

1. Complete only that step as working behavior or a complete, reviewable supporting artifact.
2. Run relevant lint, typecheck, and focused tests, including affected existing behavior where regressions are plausible. For documentation-only work, review content and run diff/format checks instead.
3. Review the diff and remove unnecessary, generated, dead, or debug code.
4. Mark the step complete only when its checks pass; record blockers or partial progress without checking it off.
5. Report files changed, behavior or documentation completed, checks run, issues, and a recommended commit message.
6. Stop after the current step. The user reviews and creates the micro-commit; do not commit or automatically start the next step.

Each item is one intended micro-commit boundary. Ship security and correctness with the behavior they protect. Update relevant environment examples and documentation alongside changes rather than creating artificial follow-up steps. Do not expose unsafe intermediate endpoints or forms.

Completed setup is supported by existing files and commits `f72af43`, `21a5588`, `8e19622`, and `5a1afb0`; these checks record scaffold presence, not a fresh validation of those commits.

Known scaffold issue from step 6 verification: full API typechecking reports `TS2307` for the existing `supertest/types` import in `apps/api/test/app.e2e-spec.ts`. The API build, schema-test typecheck, and unit/schema tests pass. Resolve the unrelated import before final submission verification.

1. [x] Initialize repository and npm workspace.
2. [x] Scaffold React/Vite/TypeScript app.
3. [x] Scaffold NestJS app.
4. [x] Add root frontend/backend development and build scripts.
5. [x] Configure Prisma/SQLite and `.env.example`; document required local configuration without creating or reading a real `.env`.
6. [x] Add database models, constraints, and query indexes; document index purpose and search limitations.
7. [x] Add the 50,000-order seed with 1–5 items per order and root `npm run db:seed` command.
8. [ ] Extend the seed with ADMIN and AGENT accounts using hashed passwords; document demo credentials.
9. [ ] Implement secure login and JWT authentication with environment-based secrets, hash verification, expiry, and focused invalid-token checks.
10. [ ] Implement server-side role authorization and authenticated admin-only single-order deletion; verify AGENT denial and ADMIN success.
11. [ ] Configure frontend routing, query client, API client with AbortSignal support, and basic Tailwind styling.
12. [ ] Implement login and protected frontend routes using the documented token-storage choice.
13. [ ] Implement the protected orders API with customer search, status filtering, date/amount sorting, and stable cursor pagination; check ties in both directions.
14. [ ] Implement the virtualized orders table with infinite loading, complete query keys, and cancellation.
15. [ ] Add search/filter/sort controls with query reset and cancellation; verify three rapid filter changes with delayed earlier responses cannot show stale results.
16. [ ] Implement authenticated, validated, atomic, idempotent order creation with server-calculated totals; check replay/conflict behavior and atomicity.
17. [ ] Implement the validated create form, calculated total, and idempotency-key reuse across double-clicks, retries, and timeout resubmissions.
18. [ ] Add root `npm run test:duplicate`: send matching authenticated create requests in parallel, verify exactly one persisted order, and fail the command if duplication occurs.
19. [ ] Write the README middleware-review findings, implemented fixes, and two- or three-sentence token-storage explanation.
20. [ ] Write DECISIONS.md with exactly three actual decisions of five to eight lines each, including R2 limits and truthful AI disclosure.
21. [ ] Write the one-page SCALE.md grounded in the implementation.
22. [ ] Complete README prerequisites, ordered setup/configuration/database/seed/run/test instructions, URLs, demo login, indexes, five-line product answer, and omissions.
23. [ ] Verify fresh local setup from README in under five minutes without paid/hosted services; prepare a two-minute recording or three screenshots showing R1 rapid-filter correctness and R2 duplicate proof.

Optional only after all mandatory steps and when requested by the user:

24. [ ] Implement O2 optimistic creation with rollback and reconciliation as one complete behavior; describe the state retained for correct rollback. Do not implement O1 as well.

---

## 19. Copilot Working Rules

Copilot should NOT implement the entire project at once.

For every step:

- only modify files required for the current step;
- do not implement later requirements early unless technically necessary;
- explain any new dependency before adding it;
- prefer the simplest implementation satisfying the requirement;
- preserve strict TypeScript typing;
- avoid `any`;
- avoid dead abstractions;
- do not add Docker or deployment configuration;
- do not add optional features before mandatory work is complete;
- keep security guarantees on the server;
- keep filtering/sorting/pagination on the server;
- keep components/services focused, colocate feature code, and extract shared code only for actual reuse;
- use typed constants for business values and meaningful repeated values; avoid magic numbers and business strings in JSX without extracting ordinary one-off labels;
- keep README setup and `.env.example` current without creating, reading, or committing real environment files;
- preserve micro-commit boundaries; the user reviews and commits.

When implementing a step, verify it, update section 18, report, and stop. Begin another step only on a subsequent user request.

---

## 20. Definition of Done

The implementation is complete when the mandatory checks below pass. Document unmet items honestly. The user controls scheduling; elapsed time is not an automatic stopping condition.

- fresh local install, seed, and startup work from README in under five minutes without paid or hosted services
- `.env.example` documents all required configuration with safe placeholders; no real `.env` is created, read, or committed by the agent, and real environment files remain ignored
- root `npm run db:seed` creates 50k+ orders with 1–5 items each and ADMIN/AGENT users with hashed passwords
- list never downloads all orders
- search works
- status filter works
- date sort works
- amount sort works
- infinite loading works
- row rendering is virtualized
- three rapid filter changes cannot show stale results even when earlier responses are delayed
- create order validates on client and server, calculates totals on the server, and persists orders/items atomically
- root `npm run test:duplicate` proves parallel matching authenticated requests create exactly one persisted order and exits unsuccessfully on duplication
- all order routes require authentication with signature and expiry verification
- missing, malformed, forged, expired, and query-string-only credentials are rejected
- role authorization is server-side: agents can list/create, agent deletion returns `403`, and admin single-order deletion succeeds
- idempotency replay behavior, conflicts, concurrency, retention, and deletion limits are documented and checked
- security findings are documented
- README provides verified supported Node/npm versions and a clean-start walkthrough for install, local configuration/JWT-secret generation, database setup, seeding, running both apps, URLs, demo login, and checks
- DECISIONS.md contains exactly three decisions of five to eight lines each, including R2 and its limits
- SCALE.md is one page and addresses five million orders, three developers, and agents in two countries
- AI usage is disclosed truthfully
- README token-storage reasoning is two or three sentences and the product answer is no more than five lines
- skipped work is explicitly documented
- commit history remains readable
- a two-minute recording or three screenshots demonstrate R1, three rapid filter changes, and the R2 duplicate proof
- repository link and reviewer access are prepared for submission when requested
