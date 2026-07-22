# Render Deployment Guide

Public Version-1 deployment on Render's free tier (GitHub issue #6). Single Nginx-fronted web service (`Dockerfile.render`) + one free managed Postgres, defined in [`render.yaml`](../render.yaml) at the repo root. This is additive to the local-first workflow (ARCHITECTURE.md §17) — no local step depends on Render.

## Topology

One Render service — the same single-origin stack as the local `prod` Compose profile (Nginx + Next.js + NestJS), so the existing `SameSite=lax` cookie auth and single-`APP_ORIGIN` CORS need no changes (ARCHITECTURE.md §3/§26).

## Migrations and seed on the free tier

Render's free instance type supports **neither a `preDeployCommand` nor Shell/SSH access**, so both steps run at container boot in [`docker/scripts/render-start.sh`](../docker/scripts/render-start.sh) instead:

- **Migrations** — `prisma migrate deploy` runs before the app serves traffic. It is idempotent, so re-running it on every cold start is a no-op once the schema is current. A migration failure is fatal (the container will not start against an unmigrated schema).
- **Seed** — the idempotent demo seed runs when `RUN_SEED_ON_BOOT` is `true` (the default in `render.yaml`). It uses upserts and count guards and never overwrites a changed admin password, so it is safe to re-run. A seed failure is non-fatal (the app still starts). Set `RUN_SEED_ON_BOOT=false` in the Environment tab once real data exists so cold starts skip it.

Both commands invoke the Prisma/tsx CLIs directly from the built workspace `node_modules` because the runtime image has no `pnpm`/corepack.

## First deploy

1. In the Render dashboard: **New → Blueprint**, point it at this repository/branch. Render reads `render.yaml` and provisions the web service + the free Postgres database.
2. Wait for the first build + deploy to finish. During boot you'll see `[render-start]` log lines for the migration and seed steps, then Nginx binding to `$PORT`.
3. Render assigns a public URL, e.g. `https://dho-calendar.onrender.com` (the exact subdomain depends on name availability).
4. Open the service's **Environment** tab and update `APP_ORIGIN` and `API_ORIGIN` to that exact URL (they ship in `render.yaml` as a placeholder — same-origin auth depends on this matching). Saving triggers a redeploy.
5. Visit the public URL — the public calendar should render; log in with the seeded admin credentials (see the boot logs' seed output for the current run's demo dates) and confirm the forced password-change flow.

## Environment variables

| Variable | Source | Notes |
|---|---|---|
| `DATABASE_URL` | `fromDatabase` | Render-managed Postgres connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | `generateValue: true` | Never committed |
| `APP_ORIGIN` / `API_ORIGIN` | manual (post-deploy) | Must equal the assigned `*.onrender.com` URL |
| `NODE_ENV`, `OFFICE_TIMEZONE`, `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL`, `UPLOAD_ROOT`, `LOGIN_RATE_LIMIT_*`, `ATTENDANCE_WARNING_LOOKAHEAD_DAYS` | fixed values in `render.yaml` | Same defaults as local `.env.example` |
| `RUN_SEED_ON_BOOT` | fixed value in `render.yaml` (`true`) | Runs the idempotent demo seed at boot; set `false` once real data exists |
| `NEXT_PUBLIC_API_ORIGIN` / `NEXT_PUBLIC_WS_ORIGIN` | intentionally unset | Baked in at Docker build time; left empty so the browser uses same-origin relative requests + a same-host WebSocket |

## Free-tier limitations (documented, not worked around)

- **Uploads are ephemeral.** The free plan has no persistent Disk, so `UPLOAD_ROOT` lives on the container's local, non-persistent filesystem — profile pictures and event covers reset on every redeploy or spin-down. Persistent storage (a paid Disk or object storage) is future work, not part of Version 1 (ARCHITECTURE.md §25).
- **The free Postgres database expires after ~30 days** and is not automatically renewed. Recreate it (and re-run the seed) when it expires.
- **Free web services cold-start** after ~15 minutes of inactivity; the first request after idling can take several seconds while the container spins back up.

## Re-running the §29 acceptance checklist on Render

Walk the same checklist as the local production-like run (see the issue's completion report / manual test steps), but against the live URL. Realtime updates travel through Render's WebSocket support behind the same Nginx config used locally (`docker/nginx/nginx.conf.template`), so no separate configuration is required.
