#!/bin/sh
# Renders docker/nginx/nginx.conf.template with envsubst and execs Nginx in
# the foreground. Shared by the local `prod` Compose profile and the
# Render combined image (Dockerfile.render) so the two never drift apart.
set -eu

: "${PORT:=80}"
: "${WEB_UPSTREAM:=web:3000}"
: "${API_UPSTREAM:=api:4000}"

envsubst '${PORT} ${WEB_UPSTREAM} ${API_UPSTREAM}' \
  < /etc/nginx/templates/nginx.conf.template \
  > /etc/nginx/nginx.conf

exec nginx -g "daemon off;"
