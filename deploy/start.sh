#!/usr/bin/env bash
set -euo pipefail

EXTERNAL_PORT="${PORT:-8555}"
BUN_INTERNAL_PORT="${BUN_INTERNAL_PORT:-8554}"

mkdir -p /tmp/nginx/client_temp /tmp/nginx/proxy_temp /tmp/nginx/fastcgi_temp /tmp/nginx/uwsgi_temp /tmp/nginx/scgi_temp

env EXTERNAL_PORT="$EXTERNAL_PORT" envsubst '$EXTERNAL_PORT' \
    < /app/deploy/nginx/conf.d/default.conf.template \
    > /app/deploy/nginx/conf.d/default.conf

PORT="$BUN_INTERNAL_PORT" bun run bun-entry.ts &
BUN_PID=$!

nginx -c /app/deploy/nginx/nginx.conf -g "daemon off;" &
NGINX_PID=$!

terminate() {
    kill -TERM "$BUN_PID" "$NGINX_PID" 2>/dev/null || true
    wait "$BUN_PID" "$NGINX_PID" 2>/dev/null || true
}

trap terminate SIGINT SIGTERM

set +e
wait -n "$BUN_PID" "$NGINX_PID"
EXIT_CODE=$?
set -e

terminate
exit "$EXIT_CODE"
