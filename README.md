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
```

PowerShell:

```powershell
$env:DATABASE_URL = 'file:./prisma/dev.db'
$env:PORT = '3000'
```

Create/update the local database and generate Prisma Client:

```bash
npm run db:migrate
npm run db:generate
npm run db:seed
```

The database is stored at `apps/api/prisma/dev.db`; SQLite needs no separate server. Keep secrets and real environment files out of Git.

The seed creates 50,000 demo orders with 1–5 items each. Rerunning it adds missing demo orders without deleting existing data or overwriting edits. Demo users will be added in the next step.

Start each app in a separate terminal:

```bash
npm run dev:api
```

```bash
npm run dev:web
```

API: <http://localhost:3000>. Frontend: <http://localhost:5173> (or the URL Vite prints).

## Tests

```bash
npm run db:validate
npm run test --workspace=api
```

Tests cover the scaffold, database constraints, and a complete seed/rerun against a temporary database. The R2 parallel-request proof is not implemented yet.

## Indexes

Orders use `(createdAt, id)` and `(totalAmount, id)` for stable sorting/pagination, plus `(status, createdAt, id)` and `(status, totalAmount, id)` for status-filtered queries. Line items use `(orderId)` for lookup and deletion. These indexes do not accelerate arbitrary customer-name/email substring searches.

## What I skipped and why

Development is ongoing: demo users, authentication, R1/R2, and duplicate proof are pending. `npm run test:duplicate` and demo credentials will be documented when implemented.

The security-review findings/fixes, token-storage explanation, and five-line product answer are also pending. Optional work has not been started while mandatory requirements remain incomplete.
