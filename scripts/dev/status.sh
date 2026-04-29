#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PID_DIR="$ROOT_DIR/.runlogs/pids"

print_status() {
  local name="$1"
  local port="$2"
  local pid_file="$PID_DIR/$name.pid"
  local pid="-"

  if [[ -f "$pid_file" ]]; then
    pid="$(cat "$pid_file")"
  fi

  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "[$name] port:$port status:UP pid_file:$pid"
  else
    echo "[$name] port:$port status:DOWN pid_file:$pid"
  fi
}

print_status "frontend" 3000
print_status "user-profile" 3001
print_status "conversation" 3002
print_status "ai-nlp" 3003
print_status "job-matching" 3004
print_status "email" 3005
print_status "report" 3007
