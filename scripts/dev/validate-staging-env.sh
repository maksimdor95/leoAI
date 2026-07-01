#!/usr/bin/env bash
# Validate required security env vars in .env.staging.local (no secret values printed).
set -euo pipefail

ENV_FILE="${1:-}"
if [[ -z "$ENV_FILE" || ! -f "$ENV_FILE" ]]; then
  echo "Usage: bash ./scripts/dev/validate-staging-env.sh /path/to/.env.staging.local" >&2
  exit 1
fi

errors=0

require_nonempty() {
  local key="$1"
  local min_len="${2:-1}"
  local line value
  line="$(grep -E "^${key}=" "$ENV_FILE" | tail -1 || true)"
  if [[ -z "$line" ]]; then
    echo "  MISSING $key" >&2
    errors=$((errors + 1))
    return
  fi
  value="${line#*=}"
  value="${value%$'\r'}"
  if [[ ${#value} -lt $min_len ]]; then
    echo "  INVALID $key (too short, need >= ${min_len} chars)" >&2
    errors=$((errors + 1))
  fi
}

echo "Validating staging env: $ENV_FILE"
require_nonempty JWT_SECRET 32
require_nonempty INTERNAL_API_KEY 32

if grep -qE '^NODE_ENV=development' "$ENV_FILE"; then
  echo "  WARN NODE_ENV=development in env file — backend will be forced to production when using dev:up:staging" >&2
fi

if [[ "$errors" -gt 0 ]]; then
  echo "Staging env validation failed ($errors error(s))." >&2
  exit 1
fi

echo "Staging env validation OK."
