#!/usr/bin/env bash
# Run weekly profile SQL against VPS Postgres (read-only aggregates).
#
# Usage:
#   ./scripts/ops/weekly-profile-check.sh              # remote default host
#   ./scripts/ops/weekly-profile-check.sh local         # local docker jack-postgres
#   VPS_HOST=ubuntu@1.2.3.4 ./scripts/ops/weekly-profile-check.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SQL="$ROOT/scripts/ops/weekly-profile-check.sql"
MODE="${1:-remote}"
VPS_HOST="${VPS_HOST:-ubuntu@84.54.57.209}"
VPS_DIR="${VPS_DIR:-~/leoAI}"
PG_CONTAINER="${PG_CONTAINER:-jack-postgres}"
PG_USER="${PG_USER:-postgres}"
PG_DB="${PG_DB:-jack_ai}"

if [[ ! -f "$SQL" ]]; then
  echo "Missing SQL file: $SQL" >&2
  exit 1
fi

run_psql() {
  docker exec -i "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1
}

echo "# weekly-profile-check $(date -u +%Y-%m-%dT%H:%MZ) mode=$MODE"

if [[ "$MODE" == "local" ]]; then
  run_psql < "$SQL"
  exit 0
fi

if [[ "$MODE" != "remote" ]]; then
  echo "Unknown mode: $MODE (use remote|local)" >&2
  exit 1
fi

# Stream SQL over SSH without copying the file to the server first.
ssh -o BatchMode=yes -o ConnectTimeout=15 "$VPS_HOST" \
  "cd $VPS_DIR && docker exec -i $PG_CONTAINER psql -U $PG_USER -d $PG_DB -v ON_ERROR_STOP=1" \
  < "$SQL"
