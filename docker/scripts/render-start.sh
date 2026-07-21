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
