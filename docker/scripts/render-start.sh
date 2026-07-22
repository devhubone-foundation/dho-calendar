#!/bin/sh
# Entrypoint for the combined Render deployment image (Dockerfile.render,
# GitHub issue #6): starts the Next.js standalone server and the NestJS API
# as background processes, then hands off to the shared Nginx entrypoint
# (docker/scripts/nginx-entrypoint.sh) bound to Render's $PORT.
#
# Render provides $PORT; the API and web processes always listen on their
# own fixed internal ports (API_ORIGIN/APP_ORIGIN describe the single public
# Nginx origin, not these internal ports).
set -eu

# --- Database migrations + one-time seed (Render free tier) --------------
# The free instance type has neither a preDeployCommand nor Shell/SSH
# access, so the migrations and the demo seed that would normally run there
# run here at container boot instead. Commands invoke the Prisma/tsx CLIs
# directly from the copied workspace node_modules because the runtime image
# has no pnpm/corepack (Dockerfile.render). WORKDIR is /repo.
DB_DIR="packages/database"
PRISMA_BIN="${DB_DIR}/node_modules/.bin/prisma"
TSX_BIN="${DB_DIR}/node_modules/.bin/tsx"

echo "[render-start] Applying database migrations (prisma migrate deploy)..."
# Fatal on failure (set -e): serving traffic against an unmigrated schema
# would only crash-loop. migrate deploy is idempotent across cold starts.
"$PRISMA_BIN" migrate deploy --schema "${DB_DIR}/prisma/schema.prisma"

# The seed is idempotent (upserts + count guards; the user upsert's
# `update: {}` never clobbers a changed admin password), so it is safe to
# run every boot. Set RUN_SEED_ON_BOOT=false once real data exists to skip
# it. Non-fatal: an already-migrated app should still serve the public
# calendar even if the seed hits a transient error.
if [ "${RUN_SEED_ON_BOOT:-true}" = "true" ]; then
  echo "[render-start] Seeding database (RUN_SEED_ON_BOOT=true)..."
  "$TSX_BIN" "${DB_DIR}/prisma/seed.ts" || \
    echo "[render-start] WARNING: seed failed; continuing to start the app."
else
  echo "[render-start] Skipping seed (RUN_SEED_ON_BOOT=${RUN_SEED_ON_BOOT})."
fi
# ------------------------------------------------------------------------

WEB_INTERNAL_PORT=3000
API_INTERNAL_PORT=4000

PORT="$API_INTERNAL_PORT" node apps/api/dist/main.js &
API_PID=$!

PORT="$WEB_INTERNAL_PORT" HOSTNAME=127.0.0.1 node apps/web/.next/standalone/apps/web/server.js &
WEB_PID=$!

trap 'kill "$API_PID" "$WEB_PID" 2>/dev/null' TERM INT

export WEB_UPSTREAM="127.0.0.1:${WEB_INTERNAL_PORT}"
export API_UPSTREAM="127.0.0.1:${API_INTERNAL_PORT}"
# PORT is Render's externally-assigned port; Nginx is the only process
# that binds to it.

exec /entrypoint.sh
