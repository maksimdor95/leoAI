#!/usr/bin/env bash
# Restart staging stack on VPS (run on server from repo root, e.g. ~/leoAI).
#
#   ssh ubuntu@84.54.57.209
#   cd ~/leoAI
#   npm run dev:deploy:staging
#
# Requires .env.staging.local in repo root (secrets, not in git).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.staging.local"
SITE_URL="${STAGING_SITE_URL:-https://leo-ai.ru}"

SKIP_PULL=0
SKIP_INSTALL=0
SKIP_DOCKER=0

usage() {
  cat <<'EOF'
Usage: bash ./scripts/dev/deploy-staging.sh [options]

Full staging deploy on VPS: optional git pull + npm install, docker up,
stop stack, free ports, start with .env.staging.local, smoke curl.

Options:
  --skip-pull      Do not run git pull origin main
  --skip-install   Do not run npm install (root, frontend, services/*)
  --skip-docker    Do not run docker compose up -d
  -h, --help       Show this help

Examples:
  npm run dev:deploy:staging
  bash ./scripts/dev/deploy-staging.sh --skip-pull
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-pull) SKIP_PULL=1; shift ;;
    --skip-install) SKIP_INSTALL=1; shift ;;
    --skip-docker) SKIP_DOCKER=1; shift ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

cd "$ROOT_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  echo "Create it on the server (copy from Mac .env.staging.local). Not committed to git." >&2
  exit 1
fi

echo "=== Staging deploy ==="
echo "Root: $ROOT_DIR"
echo "Env:  $ENV_FILE"
echo

if [[ "$SKIP_PULL" -eq 0 ]]; then
  echo "[1/6] git pull origin main..."
  git pull origin main
else
  echo "[1/6] git pull skipped"
fi

if [[ "$SKIP_INSTALL" -eq 0 ]]; then
  echo "[2/6] npm install (root, frontend, services/*)..."
  npm install
  (cd "$ROOT_DIR/frontend" && npm install)
  for d in "$ROOT_DIR"/services/*/; do
    if [[ -f "${d}package.json" ]]; then
      echo "  -> $(basename "$d")"
      (cd "$d" && npm install)
    fi
  done
else
  echo "[2/6] npm install skipped"
fi

if [[ "$SKIP_DOCKER" -eq 0 ]]; then
  echo "[3/6] docker compose up -d..."
  docker compose up -d
else
  echo "[3/6] docker compose skipped"
fi

echo "[4/6] stopping dev stack..."
npm run dev:down

echo "[5/6] freeing ports 3000-3007..."
npm run dev:kill-ports

echo "[6/6] starting staging stack..."
npm run dev:up:staging

echo
echo "Waiting 20s for Next.js and services..."
sleep 20

echo
npm run dev:status || true

echo
echo "HTTP checks:"
local_code="$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3000/" || echo "000")"
public_code="$(curl -s -o /dev/null -w "%{http_code}" "$SITE_URL/" || echo "000")"
echo "  localhost:3000 -> $local_code"
echo "  $SITE_URL -> $public_code"

if [[ "$local_code" != "200" ]] || [[ "$public_code" != "200" ]]; then
  echo
  echo "Warning: expected HTTP 200. Check logs:" >&2
  echo "  tail -40 $ROOT_DIR/.runlogs/frontend.log" >&2
  echo "  tail -40 $ROOT_DIR/.runlogs/user-profile.log" >&2
  exit 1
fi

echo
echo "Done. Staging deploy finished successfully."
