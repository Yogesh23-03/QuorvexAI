#!/usr/bin/env bash
# Boots every QuorvexAI backend service locally.
# Logs land in backend/logs/<service>.log. Ctrl+C stops them all.
#
#   bash scripts/dev-up.sh                              # uses each service .env
#   LOCAL_MONGO=mongodb://127.0.0.1:27017 bash scripts/dev-up.sh
#                                                       # overrides MONGODB_URI per service
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$ROOT/logs"

# Each service owns its port in its own .env. Reading it here (instead of
# inheriting PORT from the shell) means a stray `PORT` in the terminal cannot
# move every service onto the same port.
service_port() {
  local file="$1/.env"
  [ -f "$file" ] || return 1
  grep -m1 '^PORT=' "$file" | cut -d= -f2 | tr -d '\r[:space:]'
}

start() {
  local name="$1"
  local dir="$2"
  local db="$3"
  local uri=""
  local port=""

  if [ -n "${LOCAL_MONGO:-}" ]; then
    uri="${LOCAL_MONGO%/}/$db"
  fi
  port="$(service_port "$ROOT/$dir" || true)"

  (
    cd "$ROOT/$dir" || exit 1
    if [ -n "$port" ]; then export PORT="$port"; fi
    if [ -n "$uri" ]; then export MONGODB_URI="$uri"; fi
    exec node index.js
  ) >"$ROOT/logs/$name.log" 2>&1 &
}

start gateway gateway quorvex_gateway
start auth services/auth quorvex_auth
start chat services/chat quorvex_chat
start agent services/agent quorvex_agent
start billing services/billing quorvex_billing

echo "QuorvexAI services starting. Logs: $ROOT/logs"

cleanup() {
  trap - SIGINT SIGTERM
  kill "$(jobs -p)" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup SIGINT SIGTERM

wait
