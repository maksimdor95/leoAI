#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PID_DIR="$ROOT_DIR/.runlogs/pids"

WITH_DOCKER=0
if [[ "${1:-}" == "--with-docker" ]]; then
  WITH_DOCKER=1
fi

stop_service() {
  local name="$1"
  local pid_file="$PID_DIR/$name.pid"

  if [[ ! -f "$pid_file" ]]; then
    echo "[$name] No pid file, skipping."
    return 0
  fi

  local pid
  pid="$(cat "$pid_file")"

  if kill -0 "$pid" >/dev/null 2>&1; then
    echo "[$name] Stopping pid $pid..."
    kill "$pid" >/dev/null 2>&1 || true
  else
    echo "[$name] Process $pid is not running."
  fi

  rm -f "$pid_file"
}

stop_service "frontend"
stop_service "report"
stop_service "email"
stop_service "job-matching"
stop_service "ai-nlp"
stop_service "conversation"
stop_service "user-profile"

if [[ "$WITH_DOCKER" -eq 1 ]]; then
  echo "Stopping docker infrastructure..."
  (cd "$ROOT_DIR" && docker compose down)
fi

echo
echo "Done. Verify with: npm run dev:status"
