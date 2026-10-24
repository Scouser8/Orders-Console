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

Vite forwards browser requests under `/api` to `http://127.0.0.1:3000` in development and preview. If the API uses another address or port, set `API_PROXY_TARGET` in the frontend terminal.

## Login

Open the frontend and sign in with either demo account above. Search by customer name/email, filter by status, and sort by date or total in either direction. Scroll to load more orders, or use **Load more**. Rows are virtualized, with loading, empty, and retry states. **Sign out** clears the local session and cached server data.

`POST /api/auth/login` accepts JSON with `email` and `password`, and returns `{ accessToken, user }`. Tokens expire after one hour and must be sent as `Authorization: Bearer <accessToken>` on protected routes.

The token lives only in React memory and is sent explicitly in the Authorization header; reloading signs you out. It is not persisted in localStorage or cookies, reducing persistent token exposure and avoiding cookie-based CSRF. Active XSS can still use a live session, and signing out locally does not revoke a token before its server expiry.

The protected `GET /api/orders` supports `search` (customer name/email), `status`, `sortBy` (`createdAt` or `totalAmount`), `sortDirection` (`asc` or `desc`), `limit` (default 50, maximum 100), and `cursor`. Both roles can list orders; responses contain `{ items, nextCursor }`. Use `nextCursor` with the same search/filter/sort settings to continue. Changing frontend controls resets the viewport and starts the matching query from its first page; older requests are cancelled.

`POST /api/orders` requires authentication and an `Idempotency-Key` header. Send `customerName`, `customerEmail`, and `items` containing `name`, integer `quantity`, and integer `unitPrice` in halalas; the server calculates the total and saves everything atomically. Reuse the same key for retries of one logical submission; matching requests return the stored order (`201`), changed payloads return `409`, and retries after deletion return `410`. See [R2 guarantees and limits](DECISIONS.md). The frontend create form is pending.

## Tests

```bash
npm run db:validate
npm run test --workspace=api
npm run test:e2e --workspace=api
npm run test --workspace=web
```

Tests cover the scaffold, database constraints, seed/rerun, login, JWT rejection, deletion authorization, orders search/filter/sort/pagination, and validated order creation. Creation integration tests check parallel matching/conflicting requests, replay after deletion, and rollback on database failures. They use temporary test configuration and databases; the dedicated root R2 proof command is pending.

Frontend tests cover API requests, cancellation, login validation/errors, protected redirects, logout, session expiry, virtualized scrolling, cursor loading, and retries. The R1 test changes status three times, resolves the latest response first, then resolves the older responses and checks that only the latest results remain visible.

## Security review (in progress)

- Hardcoded JWT secret: replaced with required environment configuration, with no fallback secret.
- Decode-only authentication and missing expiry: tokens are signed, expire after one hour, and are verified using HS256. Tokens without expiry are rejected.
- Query-string tokens and loose header parsing: only a valid Bearer header is accepted.
- Plaintext password lookup: credentials are checked against bcrypt hashes; incorrect credentials receive a generic error.
- Unvalidated login input: DTO validation rejects malformed fields, extra properties, and passwords beyond bcrypt's 72-byte limit.
- Frontend-only admin checks: `DELETE /api/orders/:id` now requires verified authentication and the current database role `ADMIN`. Agents receive `403`; missing orders return `404`. Deletion removes line items but keeps the idempotency key reserved. Frontend route protection is only a UI convenience.

## Indexes

Orders use `(createdAt, id)` and `(totalAmount, id)` for stable sorting/pagination, plus `(status, createdAt, id)` and `(status, totalAmount, id)` for status-filtered queries. Line items use `(orderId)` for lookup and deletion. These indexes do not accelerate arbitrary customer-name/email substring searches.

## What I skipped and why

Development is ongoing: the R2 frontend form and dedicated duplicate-proof command are pending. `npm run test:duplicate` will be documented when implemented. Submission screenshots/recording and fresh-setup verification are still pending.

The five-line product answer is also pending. Optional work has not been started while mandatory requirements remain incomplete.
