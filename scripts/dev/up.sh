#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNLOGS_DIR="$ROOT_DIR/.runlogs"
PID_DIR="$RUNLOGS_DIR/pids"

WITH_DOCKER=0
ENV_FILE="$ROOT_DIR/.env"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-docker)
      WITH_DOCKER=1
      shift
      ;;
    --env-file)
      [[ $# -ge 2 ]] || { echo "--env-file requires a path"; exit 1; }
      ENV_FILE="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--with-docker] [--env-file <path>]"
      exit 1
      ;;
  esac
done

mkdir -p "$RUNLOGS_DIR" "$PID_DIR"

if [[ "$ENV_FILE" != /* ]]; then
  ENV_FILE="$ROOT_DIR/$ENV_FILE"
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Env file not found: $ENV_FILE"
  exit 1
fi

if [[ "$WITH_DOCKER" -eq 1 ]]; then
  echo "Starting docker infrastructure..."
  (cd "$ROOT_DIR" && docker compose up -d)
fi

start_service() {
  local name="$1"
  local port="$2"
  local rel_dir="$3"
  local log_file="$RUNLOGS_DIR/$name.log"
  local pid_file="$PID_DIR/$name.pid"

  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "[$name] Port $port already busy, skipping start."
    return 0
  fi

  echo "[$name] Starting on port $port (env: $ENV_FILE)..."
  nohup bash -lc "
while IFS= read -r line || [[ -n \"\$line\" ]]; do
  [[ -z \"\$line\" || \"\$line\" =~ ^[[:space:]]*# ]] && continue
  key=\"\${line%%=*}\"
  value=\"\${line#*=}\"
  key=\"\${key%%[[:space:]]*}\"
  [[ -n \"\$key\" ]] || continue
  value=\"\${value%\$'\\r'}\"
  export \"\$key=\$value\"
done < \"$ENV_FILE\"
cd \"$ROOT_DIR/$rel_dir\" && npm run dev
" >"$log_file" 2>&1 &
  local pid="$!"
  echo "$pid" >"$pid_file"
  sleep 0.3

  if ! kill -0 "$pid" >/dev/null 2>&1; then
    echo "[$name] Failed to start. Check $log_file"
    return 1
  fi

  echo "[$name] Started (pid $pid), logs: $log_file"
}

start_service "user-profile" 3001 "services/user-profile"
start_service "conversation" 3002 "services/conversation"
start_service "ai-nlp" 3003 "services/ai-nlp"
start_service "job-matching" 3004 "services/job-matching"
start_service "email" 3005 "services/email"
start_service "report" 3007 "services/report"
start_service "frontend" 3000 "frontend"

echo
echo "Done. Check status with: npm run dev:status"
