#!/usr/bin/env bash
set -euo pipefail

echo "== MVP0 Smoke =="

GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}"
USER_PROFILE_URL="${USER_PROFILE_URL:-http://localhost:3001}"
CONVERSATION_URL="${CONVERSATION_URL:-http://localhost:3002}"
JOB_MATCHING_URL="${JOB_MATCHING_URL:-http://localhost:3004}"
REPORT_URL="${REPORT_URL:-http://localhost:3007}"
TOKEN="${TOKEN:-}"
SESSION_ID="${SESSION_ID:-}"
REPORT_ID="${REPORT_ID:-}"
USER_ID="${USER_ID:-}"

fail() {
  echo "SMOKE FAILED: $1"
  exit 1
}

http_ok() {
  local url="$1"
  local code
  code="$(curl -s -o /dev/null -w "%{http_code}" "$url")"
  if [[ "$code" -lt 200 || "$code" -ge 400 ]]; then
    fail "health check failed for $url (HTTP $code)"
  fi
  echo "OK $url"
}

http_auth() {
  local method="$1"
  local url="$2"
  local body="${3:-}"

  [[ -n "$TOKEN" ]] || fail "TOKEN is required for auth checks"

  local args=(-s -o /dev/null -w "%{http_code}" -X "$method" "$url" -H "Authorization: Bearer $TOKEN")
  if [[ -n "$body" ]]; then
    args+=(-H "Content-Type: application/json" -d "$body")
  fi

  local code
  code="$(curl "${args[@]}")"
  if [[ "$code" -lt 200 || "$code" -ge 500 ]]; then
    fail "auth check failed for $url (HTTP $code)"
  fi
  echo "OK $method $url (HTTP $code)"
}

# 1) Service health
http_ok "$USER_PROFILE_URL/health"
http_ok "$CONVERSATION_URL/health"
http_ok "$JOB_MATCHING_URL/health"
http_ok "$REPORT_URL/health"

# 2) Auth works for profile endpoint
http_auth "GET" "$USER_PROFILE_URL/api/users/profile"

# 3) Session roundtrip check (if SESSION_ID provided)
if [[ -n "$SESSION_ID" ]]; then
  http_auth "GET" "$CONVERSATION_URL/api/chat/session/$SESSION_ID"
else
  echo "SKIP conversation session check (set SESSION_ID=...)"
fi

# 4) Match endpoint check (if USER_ID provided)
if [[ -n "$USER_ID" ]]; then
  http_auth "GET" "$JOB_MATCHING_URL/api/jobs/match/$USER_ID"
else
  echo "SKIP jobs match check (set USER_ID=...)"
fi

# 5) Report status check (if REPORT_ID provided)
if [[ -n "$REPORT_ID" ]]; then
  http_auth "GET" "$REPORT_URL/api/report/$REPORT_ID/status"
else
  echo "SKIP report status check (set REPORT_ID=...)"
fi

echo "MVP0 smoke checks passed."
