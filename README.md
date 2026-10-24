# SARH Orders Console

An orders console built with React/Vite, NestJS, and Prisma/SQLite. Design choices are in [DECISIONS.md](DECISIONS.md), with scaling notes in [SCALE.md](SCALE.md).

## Setup and Run

Requires Node.js 24.22+ (24.x) and npm 12.2+ (12.x). Run commands from the repository root.

Clone the submitted repository and open its folder, then install dependencies:

```bash
git clone <repository-url> sarh-orders-console
cd sarh-orders-console
npm ci
```

Replace `<repository-url>` with the submitted Git URL. Use `.env.example` as the configuration reference. Run the configuration commands below in the terminal you will use for database setup and the API; they set values for that terminal session, without editing any files. No real `.env` file is required or loaded.

macOS/Linux:

```bash
export DATABASE_URL='file:./prisma/dev.db'
export PORT=3000
export JWT_SECRET="$(node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))")"
```

PowerShell:

```powershell
$env:DATABASE_URL = 'file:./prisma/dev.db'
$env:PORT = '3000'
$env:JWT_SECRET = node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Create/update the local database and generate Prisma Client:

```bash
npm run db:migrate
npm run db:generate
npm run db:seed
```

The database is stored at `apps/api/prisma/dev.db`; SQLite needs no separate server. Keep secrets and real environment files out of Git.

`JWT_SECRET` is required to start the API. The commands above generate a random secret; keep it in the API terminal's environment. Changing it invalidates previously issued tokens.

The seed creates 50,000 demo orders with 1–5 items each, plus the demo accounts below. It is safe to rerun: existing data and credentials are preserved.

| Role  | Email             | Demo password |
| ----- | ----------------- | ------------- |
| ADMIN | admin@example.com | DemoAdmin123! |
| AGENT | agent@example.com | DemoAgent123! |

These credentials are for local demo use only; the database stores bcrypt hashes.

Start the API in the same terminal where you set the configuration:

```bash
npm run dev:api
```

Open a second terminal in the repository root for the frontend:

```bash
npm run dev:web
```

API: <http://localhost:3000>. Frontend: <http://localhost:5173> (or the URL Vite prints).

Vite forwards browser requests under `/api` to `http://127.0.0.1:3000` in development and preview. If the API uses another address or port, set `API_PROXY_TARGET` in the frontend terminal.

## R1 and R2 Implementation

Sign in with either demo account. The console supports server-side search, status filtering, sorting, cursor pagination, infinite loading, and virtualized rows. Both roles can list and create orders; only admins can delete an individual order.

The JWT is kept in React memory and sent as a Bearer token. It expires after one hour, and refreshing the page signs the user out. It is not stored in localStorage or cookies, which limits persistent token exposure and avoids cookie-based CSRF; persistent login is intentionally deferred.

The create form validates customer details and items, calculates a preview total, and sends an idempotency key. The server recalculates the total and saves the order and items atomically. Retries reuse the same key; a confirmed save refreshes the table and highlights the new row.

## Database Indexes

Orders use `(createdAt, id)` and `(totalAmount, id)` for stable sorting, plus status-specific versions for filtered lists. Line items use `(orderId)`. Customer name/email search is substring matching and is not claimed to be accelerated by these indexes.

## Verification and Evidence

```bash
npm run db:validate
npm run test --workspace=api
npm run test:e2e --workspace=api
npm run test --workspace=web
npm run test:duplicate
```

Run these after installation and Prisma Client generation. API tests use temporary databases and do not modify the demo database.

### R1: Rapid Filter Changes

```bash
npm run test --workspace=web -- src/features/orders/orders-table.spec.tsx -t "three rapid status changes" --reporter=verbose
```

This test holds earlier responses, changes the status three times, resolves the latest response first, and then releases the older responses. It checks that outdated results never appear, even when the mocked server ignores cancellation. The delay is only in the test.

### R2: Duplicate-Safe Order Creation

`npm run test:duplicate` runs one dedicated R2 proof. It starts a temporary API/database, logs in as the seeded agent, and sends two matching requests in parallel with the same key. Expected output (IDs vary):

```text
R2 duplicate proof
- request statuses: 201, 201
- returned order IDs: same-id, same-id
- persisted counts: {"orders":1,"items":1,"idempotencyRecords":1}
```

The command exits with an error if either request fails, the IDs differ, or the persisted counts are wrong. The full suites also cover validation, authentication, authorization, pagination, cancellation, retries, and atomic order creation.

## Code Review Findings and Fixes

The PDF's code-review concerns were in the supplied middleware and login/delete routes. The table below maps each problem to the fix in this implementation.

| Problem in the supplied code                                                                                              | Fix in this implementation                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The JWT secret was hardcoded, so anyone with the source could create tokens.                                              | `JWT_SECRET` is required from the environment; there is no fallback secret. Nest's `JwtService` signs and verifies tokens with it.                                                                                                                                                                                                                                                                         |
| The middleware decoded a token but did not verify its signature or expiry. A modified or expired token could be accepted. | [`auth.service.ts:34`](/Users/muhammadadel/Projects/job-application-playground/sarh-orders-console/apps/api/src/auth/auth.service.ts:34) uses `verifyAsync`, and rejects tokens without a valid `sub` and `exp`.                                                                                                                                                                                           |
| A token could be supplied through the URL query string, which can leak through browser history and logs.                  | [`jwt-auth.guard.ts:15`](/Users/muhammadadel/Projects/job-application-playground/sarh-orders-console/apps/api/src/auth/guards/jwt-auth.guard.ts:15) reads only `Authorization: Bearer <token>`. Query-string tokens are ignored.                                                                                                                                                                           |
| Passwords were compared or stored as plain text.                                                                          | [`auth.service.ts:19`](/Users/muhammadadel/Projects/job-application-playground/sarh-orders-console/apps/api/src/auth/auth.service.ts:19) compares the submitted password with a bcrypt hash. Seeded database values are hashes.                                                                                                                                                                            |
| Login input was not strictly validated.                                                                                   | [`login.dto.ts:8`](/Users/muhammadadel/Projects/job-application-playground/sarh-orders-console/apps/api/src/auth/dto/login.dto.ts:8) validates email and password length; the global Nest validation pipe rejects unknown fields.                                                                                                                                                                          |
| Admin checks in the frontend could be bypassed by calling the API directly.                                               | [`orders.controller.ts:24`](/Users/muhammadadel/Projects/job-application-playground/sarh-orders-console/apps/api/src/orders/orders.controller.ts:24) protects every order route with guards, and [`orders.controller.ts:44`](/Users/muhammadadel/Projects/job-application-playground/sarh-orders-console/apps/api/src/orders/orders.controller.ts:44) restricts deletion to `ADMIN`. Agents receive `403`. |
| The browser should not be the source of authorization.                                                                    | [`roles.guard.ts:16`](/Users/muhammadadel/Projects/job-application-playground/sarh-orders-console/apps/api/src/auth/guards/roles.guard.ts:16) checks the current authenticated database user and role on the server.                                                                                                                                                                                       |

The focused API tests cover missing, malformed, forged, expired, and query-string-only tokens, bcrypt login, agent deletion returning `403`, and successful admin deletion. The frontend route check only controls what the user sees; it is not treated as security.

## Omissions and Deferred Work

I left out the optional stats endpoint and optimistic creation to focus on the required list, creation, and security behavior. Orders appear after server confirmation. Persistent login and more UI polish are also deferred. Submission screenshots/recording and fresh-setup verification are still pending.

## Product Question: “Delete All Cancelled Orders”

First clarify whether the need is less visual clutter, storage reduction, compliance, or reporting. Hard deletion could break auditability and recovery, so I would first propose hiding or archiving cancelled orders with an explicit retention policy. If deletion is later required, define authorization, audit logging, confirmation, retention, and recovery before implementing it. This MVP intentionally supports only authorized single-order deletion; it does not implement bulk deletion.
