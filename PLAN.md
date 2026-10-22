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

---

## 2. Agreed Tech Stack

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

The query function must consume the provided `AbortSignal` and pass it into `fetch`.

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

### Proof

Add an automated proof script or test that:

1. sends the exact same create-order request twice in parallel;
2. uses the same idempotency key;
3. verifies that exactly one order exists afterward.

Expose a simple root-level command such as:

```bash
npm run test:duplicate
```

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
- idempotencyKey UNIQUE
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
```

Use integer smallest-currency units for money rather than floating-point values.

Seed:

- at least 50,000 orders
- 1–5 line items per order
- at least one ADMIN user
- at least one AGENT user

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

Start from the intentionally insecure middleware described in the assessment, but implement the final solution cleanly in NestJS.

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
├── jwt-auth.guard.ts
├── roles.guard.ts
└── dto/
```

Document all security problems found in the README.

Also include the required short explanation of client token storage and which attacks that choice does and does not protect against.

---

## 9. Frontend Structure

Suggested structure:

```text
apps/web/src/
├── api/
├── components/
│   ├── ui/
│   └── orders/
├── features/
│   ├── auth/
│   └── orders/
├── hooks/
├── lib/
├── pages/
├── routes/
├── schemas/
├── types/
├── App.tsx
└── main.tsx
```

Do not over-abstract early.

Start simple and only extract reusable code when duplication or complexity appears.

---

## 10. Backend Structure

Suggested structure:

```text
apps/api/src/
├── auth/
├── orders/
├── prisma/
├── common/
├── app.module.ts
└── main.ts
```

Keep NestJS usage minimal.

Do not add:

- CQRS
- event buses
- microservices
- generic repository layers
- complex domain abstractions
- Swagger unless time remains and it is genuinely useful

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

The server remains authoritative.

---

## 14. Optional Feature

Do not start an optional feature until every mandatory requirement, documentation file, and proof is complete.

Preferred optional feature if time remains:

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

Must contain:

- setup commands
- environment setup
- seed command
- run command
- duplicate proof command
- seeded credentials
- code-review/security findings
- product-question answer
- indexes used
- what was skipped and why

### DECISIONS.md

Exactly three strong decisions.

Recommended:

1. idempotency-key strategy for R2
2. cursor/keyset pagination vs offset
3. SQLite vs PostgreSQL

For each:

- decision
- serious alternative
- reason alternative was rejected

Also disclose AI usage clearly.

Suggested disclosure direction:

> ChatGPT was used for architecture discussion, implementation review, debugging, and technical trade-off analysis. GitHub Copilot was used for code completion and repetitive implementation. All generated code and architectural/security decisions were reviewed and modified manually.

### SCALE.md

One-page senior design memo for 5 million orders, three developers, two countries.

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

Keep the final README answer within the assessment's requested limit.

---

## 17. Implementation Priority

### P0 — Core Mandatory Functionality

1. Initialize repository/workspace
2. Initialize React/Vite app
3. Initialize NestJS app
4. Configure root scripts
5. Add Prisma + SQLite
6. Add schema
7. Add indexes
8. Add 50k seed
9. Seed users
10. Implement auth
11. Implement authorization
12. Implement R1 API
13. Implement R1 frontend
14. Implement stale-request cancellation
15. Implement R2 API
16. Implement Create Order frontend
17. Implement duplicate proof

### P1 — Mandatory Submission Work

18. Security review documentation
19. README
20. DECISIONS.md
21. SCALE.md
22. `.env.example`
23. verify fresh setup from README
24. screenshots / screen recording

### P2 — Only If Safe

25. O2 optimistic create
26. minor UI improvements
27. additional focused tests

---

## 18. Micro-Commit Workflow

Do not combine unrelated steps.

Before every commit:

1. implement only the current step;
2. run relevant checks;
3. review the diff;
4. remove dead/debug code;
5. commit;
6. move to the next step.

Recommended commit sequence:

```text
1. chore: initialize repository and npm workspace
2. chore(web): scaffold React Vite TypeScript application
3. chore(api): scaffold NestJS application
4. chore: add root development scripts and environment template
5. feat(api): configure Prisma with SQLite
6. feat(api): add user order and order item database models
7. perf(api): add indexes for order queries
8. feat(api): add database seed script with 50k orders
9. feat(api): seed admin and agent users
10. feat(api): implement secure login
11. feat(api): add JWT authentication guard
12. feat(api): add server-side role authorization
13. feat(api): add cursor-paginated orders endpoint
14. feat(api): add order search and status filtering
15. feat(api): add date and amount sorting
16. chore(web): configure router query client Tailwind and shared API client
17. feat(web): add login flow and protected routes
18. feat(web): add virtualized orders table
19. feat(web): add infinite cursor loading
20. feat(web): add order search and status filtering
21. feat(web): add server-side sorting controls
22. fix(web): cancel stale orders requests on query changes
23. feat(api): add create-order DTO validation
24. feat(api): implement transactional order creation
25. feat(api): enforce idempotent order creation
26. feat(web): add create-order form
27. feat(web): add client-side order validation
28. feat(web): reuse idempotency key across retries
29. test(api): add parallel duplicate-order proof
30. docs: document authentication security review
31. docs: add architecture decisions
32. docs: add five-million-order scale proposal
33. docs: complete setup and skipped-work documentation
```

Optional only afterward:

```text
34. feat(web): add optimistic order creation
35. fix(web): rollback failed optimistic order creation
```

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
- preserve micro-commit boundaries.

When implementing a step, verify it before proceeding.

---

## 20. Definition of Done

The project is ready to submit only when:

- fresh install works from README
- seed creates 50k+ orders
- list never downloads all orders
- search works
- status filter works
- date sort works
- amount sort works
- infinite loading works
- row rendering is virtualized
- rapid filter changes cannot show stale results
- create order validates on client and server
- duplicate parallel requests create exactly one order
- authentication verifies JWT signatures
- role authorization is server-side
- security findings are documented
- README is complete
- DECISIONS.md is complete
- SCALE.md is complete
- AI usage is disclosed
- skipped work is explicitly documented
- commit history remains readable
- screenshots or recording demonstrate R1 and R2
