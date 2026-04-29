#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PID_DIR="$ROOT_DIR/.runlogs/pids"

WITH_DOCKER=0
if [[ "${1:-}" == "--with-docker" ]]; then
  WITH_DOCKER=1
fi

kill_port() {
  local port="$1"
  local pids
  pids="$(lsof -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -z "$pids" ]]; then
    echo "[port:$port] already free"
    return 0
  fi

  echo "[port:$port] stopping: $pids"
  for pid in $pids; do
    kill "$pid" >/dev/null 2>&1 || true
  done

  sleep 0.5

  pids="$(lsof -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    echo "[port:$port] force stopping: $pids"
    for pid in $pids; do
      kill -9 "$pid" >/dev/null 2>&1 || true
    done
  fi
}

echo "Cleaning old listeners on ports 3000-3005..."
kill_port 3000
kill_port 3001
kill_port 3002
kill_port 3003
kill_port 3004
kill_port 3005

rm -f "$PID_DIR"/*.pid 2>/dev/null || true

echo
echo "Starting fresh dev stack..."
if [[ "$WITH_DOCKER" -eq 1 ]]; then
  bash "$ROOT_DIR/scripts/dev/up.sh" --with-docker
else
  bash "$ROOT_DIR/scripts/dev/up.sh"
fi
