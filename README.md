# DevHubOne Office Calendar

This repository contains the DevHubOne Office Calendar: a bilingual public office/event calendar and an authenticated member/admin scheduling application.

## Source documents

Read these before planning or implementing:

1. [`PRODUCT_BLUEPRINT.md`](PRODUCT_BLUEPRINT.md) — authoritative product behavior and scope.
2. [`ARCHITECTURE.md`](ARCHITECTURE.md) — authoritative technical baseline.
3. [`CLAUDE.md`](CLAUDE.md) — mandatory Claude Code operating procedure.
4. [`CONTRIBUTING.md`](CONTRIBUTING.md) — branch, review, and merge workflow.
5. [`docs/DEVELOPMENT_WORKFLOW.md`](docs/DEVELOPMENT_WORKFLOW.md) — human/agent issue lifecycle.
6. [`docs/TESTING_STRATEGY.md`](docs/TESTING_STRATEGY.md) — automated and manual test policy.
7. [`docs/PARALLEL_WORK_PLAN.md`](docs/PARALLEL_WORK_PLAN.md) — two-programmer planning constraints.
8. [`docs/PLANNER_PROMPT.md`](docs/PLANNER_PROMPT.md) — prompt for the Opus planning session.
9. [`docs/iframe-integration.md`](docs/iframe-integration.md) — public iframe embed and resize protocol.
10. [`docs/RENDER_DEPLOY.md`](docs/RENDER_DEPLOY.md) — public Render deployment guide.

## Current phase

Version 1 is feature-complete (Milestones 1–3, Issues #1–#6): monorepo/Docker/CI foundation, design system, office schedule/attendance, bilingual events, public aggregation/iframe/realtime/audit, and this issue's seed completeness, integration-test coverage, production-like Nginx profile, and Render deployment.

## Prerequisites

- Node.js 22.x (see `.nvmrc`)
- pnpm (`corepack enable` or install directly; see `packageManager` in `package.json`)
- Docker and Docker Compose (for the `db`/`full`/`test` profiles)

## Setup

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
# Edit apps/api/.env and set real random values for JWT_ACCESS_SECRET / JWT_REFRESH_SECRET,
# e.g. `openssl rand -hex 32`.

pnpm install
```

## Fast local development (database-only Compose profile)

Runs Postgres in Docker; `apps/web` and `apps/api` run locally via pnpm/Turbo for fast iteration.

```bash
docker compose --profile db up -d
pnpm --filter @dho/database prisma:migrate   # applies committed migrations, creates a shadow DB
pnpm --filter @dho/database prisma:seed      # seeds one admin + one temp-password member
pnpm dev                                     # starts apps/web (:3000) and apps/api (:4000)
```

## Full local Compose profile

Runs Postgres, the API, and the web app entirely in containers.

```bash
docker compose --profile full up --build
```

## Test Compose profile

Runs an isolated, disposable Postgres for the backend integration suite.

`pnpm --filter @dho/api test:integration` auto-loads `apps/api/.env.test`
(fake, non-secret placeholder values matching CI — safe to commit), so no
manual exports are needed for the test run itself. Applying migrations to the
test database still needs `DATABASE_URL` set for that one command, since the
Prisma CLI runs from `packages/database` and does not read `apps/api/.env.test`:

```bash
docker compose --profile test up -d
DATABASE_URL=postgresql://dho:dho_dev_password@localhost:5433/dho_test \
  pnpm --filter @dho/database prisma:migrate:deploy

pnpm --filter @dho/api test:integration
```

## Production-like Compose profile

Runs Postgres, the API, and the web app behind Nginx (ARCHITECTURE.md §17.3) — the closest local approximation of the Render deployment. Nginx applies a request-size limit and forwards WebSocket upgrades; Postgres and uploads persist across `down`/`up` via the same named volumes as the `full` profile.

Build the web image for **same-origin** access through Nginx (matches the Render setup — do not use the `full` profile's `:4000` defaults here):

```bash
NEXT_PUBLIC_API_ORIGIN= NEXT_PUBLIC_WS_ORIGIN= docker compose --profile prod up --build
```

Set `APP_ORIGIN=http://localhost:8080` in `apps/api/.env` (the Nginx-facing origin) before starting, then apply migrations/seed as in the full profile. Open `http://localhost:8080`. Verify persistence:

```bash
docker compose --profile prod down
docker compose --profile prod up   # data and uploads are still present
```

## Render deployment

See [`docs/RENDER_DEPLOY.md`](docs/RENDER_DEPLOY.md) for creating the Blueprint (`render.yaml`), running the seed once via Render Shell, and the free-tier limitations (ephemeral uploads, ~30-day free Postgres, cold starts).

## Common commands

```bash
pnpm lint
pnpm typecheck
pnpm test              # unit tests across all packages/apps
pnpm test:integration   # backend integration tests (needs a running Postgres, see above)
pnpm build
```
