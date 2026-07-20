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

## Current phase

Issue #1 (platform foundation) has landed the monorepo skeleton, Prisma/PostgreSQL baseline, and the full authentication system. Design tokens, member profiles, and the calendar verticals are implemented by later issues.

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

```bash
docker compose --profile test up -d
DATABASE_URL=postgresql://dho:dho_dev_password@localhost:5433/dho_test \
  pnpm --filter @dho/database prisma:migrate:deploy
DATABASE_URL=postgresql://dho:dho_dev_password@localhost:5433/dho_test \
  pnpm --filter @dho/api test:integration
```

## Common commands

```bash
pnpm lint
pnpm typecheck
pnpm test              # unit tests across all packages/apps
pnpm test:integration   # backend integration tests (needs a running Postgres, see above)
pnpm build
```
