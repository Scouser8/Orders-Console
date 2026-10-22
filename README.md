# SARH Orders Console

React/Vite frontend and NestJS API in an npm workspace, with Prisma and local SQLite.
Implementation is in progress; database models, seeding, authentication, and order features are not available yet.

## Prerequisites

- Node.js 24.22+ (24.x)
- npm 12.2+ (12.x)

These versions match the development environment. Install dependencies from the repository root:

```bash
npm ci
```

## Local configuration

Use the root `.env.example` as a reference. Supply its values in your shell; no real `.env` file is required or loaded.

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

`DATABASE_URL` is required by the Prisma CLI. With the workspace commands below, the SQLite file path is relative to `apps/api`, so this value targets `apps/api/prisma/dev.db`. SQLite needs no separate database server. `PORT` sets the API port; it defaults to `3000`.

Keep real environment files and secrets out of Git. Authentication configuration and JWT-secret generation instructions will be added with authentication.

## Database configuration

Validate the Prisma configuration after setting `DATABASE_URL`:

```bash
npm run db:validate
```

The datasource is configured for SQLite. Database models, migrations, and client generation belong to the next implementation step; no application tables exist yet. Seed and duplicate-proof commands will be added with their respective features.

## Run the apps

From the repository root, run each app in its own terminal:

```bash
npm run dev:api
```

```bash
npm run dev:web
```

- API scaffold: <http://localhost:3000>
- Frontend: <http://localhost:5173> (Vite prints the actual URL if the port is occupied)

## Checks

```bash
npm run build:api
npm run build:web
npm run lint --workspace=api
npm run lint --workspace=web
npm run test --workspace=api
```
