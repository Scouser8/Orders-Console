# SARH Orders Console

React/Vite frontend, NestJS API, and Prisma/SQLite database. Implementation is in progress.

## Setup and run

Requires Node.js 24.22+ (24.x) and npm 12.2+ (12.x). Run commands from the repository root.

```bash
npm ci
```

Use `.env.example` as the configuration reference. Set values in your shell; no real `.env` file is required or loaded.

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

The seed creates 50,000 demo orders with 1–5 items each, plus the demo accounts below. Rerunning adds missing records without deleting data or resetting existing orders, passwords, or roles.

| Role  | Email             | Demo password |
| ----- | ----------------- | ------------- |
| ADMIN | admin@example.com | DemoAdmin123! |
| AGENT | agent@example.com | DemoAgent123! |

These credentials are for local demo use only; the database stores bcrypt hashes.

Start each app in a separate terminal:

```bash
npm run dev:api
```

```bash
npm run dev:web
```

API: <http://localhost:3000>. Frontend: <http://localhost:5173> (or the URL Vite prints).

## Login

`POST /api/auth/login` accepts JSON with `email` and `password`, and returns `{ accessToken, user }`. Tokens expire after one hour and must be sent as `Authorization: Bearer <accessToken>` on protected routes. Frontend login is not implemented yet.

## Tests

```bash
npm run db:validate
npm run test --workspace=api
npm run test:e2e --workspace=api
```

Tests cover the scaffold, database constraints, seed/rerun, login, and JWT rejection cases. They use temporary test configuration and databases. The R2 parallel-request proof is not implemented yet.

## Security review (in progress)

- Hardcoded JWT secret: replaced with required environment configuration, with no fallback secret.
- Decode-only authentication and missing expiry: tokens are signed, expire after one hour, and are verified using HS256. Tokens without expiry are rejected.
- Query-string tokens and loose header parsing: only a valid Bearer header is accepted.
- Plaintext password lookup: credentials are checked against bcrypt hashes; incorrect credentials receive a generic error.
- Unvalidated login input: DTO validation rejects malformed fields, extra properties, and passwords beyond bcrypt's 72-byte limit.
- Frontend-only admin checks: `DELETE /api/orders/:id` now requires verified authentication and the current database role `ADMIN`. Agents receive `403`; missing orders return `404`. Deletion removes line items but keeps the idempotency key reserved. Client token storage will be documented with frontend login.

## Indexes

Orders use `(createdAt, id)` and `(totalAmount, id)` for stable sorting/pagination, plus `(status, createdAt, id)` and `(status, totalAmount, id)` for status-filtered queries. Line items use `(orderId)` for lookup and deletion. These indexes do not accelerate arbitrary customer-name/email substring searches.

## What I skipped and why

Development is ongoing: frontend login, R1/R2, and duplicate proof are pending. `npm run test:duplicate` will be documented when implemented.

The client token-storage explanation and five-line product answer are also pending. Optional work has not been started while mandatory requirements remain incomplete.
