#!/usr/bin/env bash
# Освобождает порты стека Leo/Jack на хосте (после многократных up.sh дочерние node
# иногда остаются слушать порты). Не трогает Docker (postgres/redis/resume-parser).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PID_DIR="$ROOT_DIR/.runlogs/pids"

PORTS=(3000 3001 3002 3003 3004 3005 3007)

echo "Killing listeners on ports: ${PORTS[*]} (needs sudo for fuser)..."

for p in "${PORTS[@]}"; do
  if command -v fuser >/dev/null 2>&1; then
    sudo fuser -k "${p}/tcp" 2>/dev/null || true
  elif command -v lsof >/dev/null 2>&1; then
    pids="$(sudo lsof -tiTCP:"$p" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
      # shellcheck disable=SC2086
      sudo kill -9 $pids 2>/dev/null || true
    fi
  else
    echo "Install fuser (psmisc) or lsof." >&2
    exit 1
  fi
done

# Снять «зависшие» ts-node-dev именно этого репозитория (если остались без порта)
if command -v pkill >/dev/null 2>&1; then
  pkill -f "${ROOT_DIR}/services/.*/node_modules/.bin/ts-node-dev" 2>/dev/null || true
  pkill -f "${ROOT_DIR}/frontend/node_modules/.bin/next" 2>/dev/null || true
fi

rm -f "$PID_DIR"/*.pid 2>/dev/null || true

echo "Done. Check: ss -ltnp | grep -E ':(3000|3001|3002|3003|3004|3005|3007) '"
echo "Then: npm run dev:deploy:staging   # or: npm run dev:up:staging"
