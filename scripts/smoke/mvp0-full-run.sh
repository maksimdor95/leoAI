#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNLOGS_DIR="$ROOT_DIR/.runlogs/smoke"

USER_PROFILE_URL="${USER_PROFILE_URL:-http://localhost:3001}"
CONVERSATION_URL="${CONVERSATION_URL:-http://localhost:3002}"
TEST_EMAIL="${TEST_EMAIL:-testtest@test.ru}"
TEST_PASSWORD="${TEST_PASSWORD:-testtest}"
PRODUCT="${PRODUCT:-wannanew}"
RUNS="${RUNS:-1}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
SUMMARY_LOG="$RUNLOGS_DIR/mvp0-full-summary-$TIMESTAMP.log"

fail() {
  echo "FULL SMOKE FAILED: $1"
  exit 1
}

json_get() {
  local key_path="$1"
  node -e "
const fs=require('fs');
const data=JSON.parse(fs.readFileSync(0,'utf8'));
const keys='$key_path'.split('.');
let cur=data;
for (const k of keys) {
  if (!k) continue;
  cur=cur && Object.prototype.hasOwnProperty.call(cur,k) ? cur[k] : undefined;
}
process.stdout.write(cur == null ? '' : String(cur));
"
}

echo "== MVP0 Full Smoke Runner =="
echo "Using TEST_EMAIL=$TEST_EMAIL PRODUCT=$PRODUCT RUNS=$RUNS"
mkdir -p "$RUNLOGS_DIR"

LOGIN_JSON="$(curl -s -X POST "$USER_PROFILE_URL/api/users/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")"
TOKEN="$(printf "%s" "$LOGIN_JSON" | json_get "token")"
[[ -n "$TOKEN" ]] || fail "login token is empty (check TEST_EMAIL/TEST_PASSWORD)"

PROFILE_JSON="$(curl -s "$USER_PROFILE_URL/api/users/profile" \
  -H "Authorization: Bearer $TOKEN")"
USER_ID="$(printf "%s" "$PROFILE_JSON" | json_get "id")"
[[ -n "$USER_ID" ]] || fail "USER_ID is empty from /api/users/profile"

SESSION_JSON="$(curl -s -X POST "$CONVERSATION_URL/api/chat/session" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"createNew\":true,\"product\":\"$PRODUCT\"}")"
SESSION_ID="$(printf "%s" "$SESSION_JSON" | json_get "sessionId")"
[[ -n "$SESSION_ID" ]] || fail "SESSION_ID is empty from /api/chat/session"

REPORT_JSON="$(curl -s -X POST "$CONVERSATION_URL/api/chat/session/$SESSION_ID/report" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")"
REPORT_ID="$(printf "%s" "$REPORT_JSON" | json_get "reportId")"
if [[ -z "$REPORT_ID" ]]; then
  REPORT_ID="$(printf "%s" "$REPORT_JSON" | json_get "id")"
fi
[[ -n "$REPORT_ID" ]] || fail "REPORT_ID is empty from /api/chat/session/:id/report"

echo "Prepared context:"
echo "  TOKEN_LEN=${#TOKEN}"
echo "  USER_ID=$USER_ID"
echo "  SESSION_ID=$SESSION_ID"
echo "  REPORT_ID=$REPORT_ID"
{
  echo "timestamp=$TIMESTAMP"
  echo "test_email=$TEST_EMAIL"
  echo "product=$PRODUCT"
  echo "runs=$RUNS"
  echo "token_len=${#TOKEN}"
  echo "user_id=$USER_ID"
  echo "session_id=$SESSION_ID"
  echo "report_id=$REPORT_ID"
} >"$SUMMARY_LOG"

for i in $(seq 1 "$RUNS"); do
  echo "=== FULL SMOKE RUN $i/$RUNS ==="
  RUN_LOG="$RUNLOGS_DIR/mvp0-full-$TIMESTAMP-run$i.log"
  if ! (
    SMOKE_MODE=full \
    TOKEN="$TOKEN" \
    USER_ID="$USER_ID" \
    SESSION_ID="$SESSION_ID" \
    REPORT_ID="$REPORT_ID" \
    bash "$ROOT_DIR/scripts/smoke/mvp0-smoke.sh"
  ) 2>&1 | tee "$RUN_LOG"; then
    echo "run_$i=failed log=$RUN_LOG" >>"$SUMMARY_LOG"
    fail "run $i/$RUNS failed (see $RUN_LOG)"
  fi
  echo "run_$i=passed log=$RUN_LOG" >>"$SUMMARY_LOG"
done

echo "== FULL SMOKE RESULT: $RUNS/$RUNS PASSED =="
echo "Summary log: $SUMMARY_LOG"
