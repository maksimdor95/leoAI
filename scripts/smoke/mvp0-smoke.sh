#!/usr/bin/env bash
set -euo pipefail

echo "== MVP0 Smoke =="

GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}"
USER_PROFILE_URL="${USER_PROFILE_URL:-http://localhost:3001}"
CONVERSATION_URL="${CONVERSATION_URL:-http://localhost:3002}"
JOB_MATCHING_URL="${JOB_MATCHING_URL:-http://localhost:3004}"
REPORT_URL="${REPORT_URL:-http://localhost:3007}"
SMOKE_MODE="${SMOKE_MODE:-light}"
SMOKE_SESSION_CREATE="${SMOKE_SESSION_CREATE:-0}"
SMOKE_CHAT_LOOP="${SMOKE_CHAT_LOOP:-0}"
SMOKE_COMPLETION_TRIGGER="${SMOKE_COMPLETION_TRIGGER:-0}"
SMOKE_FINAL_ARTIFACT="${SMOKE_FINAL_ARTIFACT:-0}"
SMOKE_NEGATIVE_CASE="${SMOKE_NEGATIVE_CASE:-0}"
REPORT_READY_TIMEOUT_SEC="${REPORT_READY_TIMEOUT_SEC:-40}"
REPORT_READY_POLL_SEC="${REPORT_READY_POLL_SEC:-2}"
SESSION_PRODUCT="${SESSION_PRODUCT:-wannanew}"
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
  if [[ "$code" -lt 200 || "$code" -ge 400 ]]; then
    fail "auth check failed for $url (HTTP $code)"
  fi
  echo "OK $method $url (HTTP $code)"
}

http_auth_json_check() {
  local method="$1"
  local url="$2"
  local js_check="$3"
  local body="${4:-}"

  [[ -n "$TOKEN" ]] || fail "TOKEN is required for auth checks"

  local tmp_body
  tmp_body="$(mktemp)"
  local code
  if [[ -n "$body" ]]; then
    code="$(curl -s -o "$tmp_body" -w "%{http_code}" -X "$method" "$url" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$body")"
  else
    code="$(curl -s -o "$tmp_body" -w "%{http_code}" -X "$method" "$url" -H "Authorization: Bearer $TOKEN")"
  fi

  if [[ "$code" -lt 200 || "$code" -ge 400 ]]; then
    rm -f "$tmp_body"
    fail "auth check failed for $url (HTTP $code)"
  fi

  if ! node -e "
const fs=require('fs');
const p=process.argv[1];
const text=fs.readFileSync(p,'utf8');
let data;
try { data=JSON.parse(text || '{}'); } catch { process.exit(2); }
const check = (obj) => { ${js_check} };
process.exit(check(data) ? 0 : 3);
" "$tmp_body"; then
    rm -f "$tmp_body"
    fail "json assertion failed for $url"
  fi

  rm -f "$tmp_body"
  echo "OK $method $url (HTTP $code + JSON)"
}

http_auth_json_extract() {
  local method="$1"
  local url="$2"
  local js_extract="$3"
  local body="${4:-}"

  [[ -n "$TOKEN" ]] || fail "TOKEN is required for auth checks"

  local tmp_body
  tmp_body="$(mktemp)"
  local code
  if [[ -n "$body" ]]; then
    code="$(curl -s -o "$tmp_body" -w "%{http_code}" -X "$method" "$url" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$body")"
  else
    code="$(curl -s -o "$tmp_body" -w "%{http_code}" -X "$method" "$url" -H "Authorization: Bearer $TOKEN")"
  fi

  if [[ "$code" -lt 200 || "$code" -ge 400 ]]; then
    rm -f "$tmp_body"
    fail "auth check failed for $url (HTTP $code)"
  fi

  local extracted
  extracted="$(node -e "
const fs=require('fs');
const p=process.argv[1];
const text=fs.readFileSync(p,'utf8');
let data;
try { data=JSON.parse(text || '{}'); } catch { process.exit(2); }
const extract = (obj) => { ${js_extract} };
const out = extract(data);
process.stdout.write(out == null ? '' : String(out));
" "$tmp_body")"

  rm -f "$tmp_body"
  echo "$extracted"
}

http_auth_code() {
  local method="$1"
  local url="$2"
  [[ -n "$TOKEN" ]] || fail "TOKEN is required for auth checks"
  curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url" -H "Authorization: Bearer $TOKEN"
}

http_auth_expect_code() {
  local method="$1"
  local url="$2"
  local expected_code="$3"
  local body="${4:-}"

  [[ -n "$TOKEN" ]] || fail "TOKEN is required for auth checks"

  local code
  if [[ -n "$body" ]]; then
    code="$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$body")"
  else
    code="$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url" -H "Authorization: Bearer $TOKEN")"
  fi

  if [[ "$code" != "$expected_code" ]]; then
    fail "expected HTTP $expected_code for $method $url, got HTTP $code"
  fi
  echo "OK $method $url (expected HTTP $expected_code)"
}

wait_report_ready() {
  local report_id="$1"
  local elapsed=0
  while [[ "$elapsed" -lt "$REPORT_READY_TIMEOUT_SEC" ]]; do
    local status
    status="$(http_auth_json_extract "GET" "$REPORT_URL/api/report/$report_id/status" "return obj.status || '';" || true)"
    if [[ "$status" == "ready" ]]; then
      echo "ready"
      return 0
    fi
    if [[ "$status" == "error" ]]; then
      echo "error"
      return 1
    fi
    sleep "$REPORT_READY_POLL_SEC"
    elapsed=$((elapsed + REPORT_READY_POLL_SEC))
  done
  echo "timeout"
  return 1
}

require_env() {
  local name="$1"
  local value="$2"
  [[ -n "$value" ]] || fail "$name is required in full smoke mode"
}

# 1) Service health
http_ok "$USER_PROFILE_URL/health"
http_ok "$CONVERSATION_URL/health"
http_ok "$JOB_MATCHING_URL/health"
http_ok "$REPORT_URL/health"

# 2) Auth works for profile endpoint
http_auth "GET" "$USER_PROFILE_URL/api/users/profile"

# 3) Auth + session creation (new session)
if [[ "$SMOKE_MODE" == "full" || "$SMOKE_SESSION_CREATE" == "1" ]]; then
  http_auth_json_check "POST" "$CONVERSATION_URL/api/chat/session" \
    "return typeof obj.sessionId === 'string' && obj.sessionId.length > 0;" \
    "{\"createNew\":true,\"product\":\"$SESSION_PRODUCT\"}"
else
  echo "SKIP session creation check (set SMOKE_SESSION_CREATE=1 or use SMOKE_MODE=full)"
fi

# 4) Session roundtrip check
if [[ "$SMOKE_MODE" == "full" ]]; then
  require_env "SESSION_ID" "$SESSION_ID"
  http_auth_json_check "GET" "$CONVERSATION_URL/api/chat/session/$SESSION_ID" \
    "return typeof obj.sessionId === 'string' && obj.sessionId.length > 0;"
elif [[ -n "$SESSION_ID" ]]; then
  http_auth "GET" "$CONVERSATION_URL/api/chat/session/$SESSION_ID"
else
  echo "SKIP conversation session check (set SESSION_ID=...)"
fi

# 5) Chat loop check (send one message and ensure response structure)
if [[ "$SMOKE_MODE" == "full" || "$SMOKE_CHAT_LOOP" == "1" ]]; then
  require_env "SESSION_ID" "$SESSION_ID"
  http_auth_json_check "POST" "$CONVERSATION_URL/api/chat/session/$SESSION_ID/message" \
    "return typeof obj.sessionId === 'string' && obj.sessionId.length > 0 && !!obj.userMessage;" \
    "{\"content\":\"да\"}"
else
  echo "SKIP chat loop check (set SMOKE_CHAT_LOOP=1 or use SMOKE_MODE=full)"
fi

# 6) Completion trigger check (request report generation from session)
if [[ "$SMOKE_MODE" == "full" || "$SMOKE_COMPLETION_TRIGGER" == "1" ]]; then
  require_env "SESSION_ID" "$SESSION_ID"
  generated_report_id="$(http_auth_json_extract "POST" "$CONVERSATION_URL/api/chat/session/$SESSION_ID/report" \
    "return obj.reportId || obj.id || '';" \
    "{}")"
  [[ -n "$generated_report_id" ]] || fail "completion trigger failed: reportId is empty"
  echo "OK POST $CONVERSATION_URL/api/chat/session/$SESSION_ID/report (reportId=$generated_report_id)"
  # For downstream checks (status/download), always use the freshest report id
  # produced by this completion trigger.
  REPORT_ID="$generated_report_id"
else
  echo "SKIP completion trigger check (set SMOKE_COMPLETION_TRIGGER=1 or use SMOKE_MODE=full)"
fi

# 7) Match endpoint check
if [[ "$SMOKE_MODE" == "full" ]]; then
  require_env "USER_ID" "$USER_ID"
  http_auth_json_check "GET" "$JOB_MATCHING_URL/api/jobs/match/$USER_ID" \
    "return Array.isArray(obj.jobs) && typeof obj.count === 'number' && typeof obj.weakCount === 'number';"
elif [[ -n "$USER_ID" ]]; then
  http_auth "GET" "$JOB_MATCHING_URL/api/jobs/match/$USER_ID"
else
  echo "SKIP jobs match check (set USER_ID=...)"
fi

# 8) Report status check
if [[ "$SMOKE_MODE" == "full" ]]; then
  require_env "REPORT_ID" "$REPORT_ID"
  http_auth_json_check "GET" "$REPORT_URL/api/report/$REPORT_ID/status" \
    "const s=obj.status; return typeof obj.reportId === 'string' && ['pending','generating','ready','error'].includes(s);"
elif [[ -n "$REPORT_ID" ]]; then
  http_auth "GET" "$REPORT_URL/api/report/$REPORT_ID/status"
else
  echo "SKIP report status check (set REPORT_ID=...)"
fi

# 9) Final artifact delivery check (download endpoint)
if [[ "$SMOKE_FINAL_ARTIFACT" == "1" ]]; then
  require_env "REPORT_ID" "$REPORT_ID"
  ready_state="$(wait_report_ready "$REPORT_ID")" || fail "report did not become ready (state=$ready_state)"
  code="$(http_auth_code "GET" "$REPORT_URL/api/report/$REPORT_ID/download")"
  if [[ "$code" != "200" && "$code" != "302" ]]; then
    fail "report download check failed for /api/report/$REPORT_ID/download (HTTP $code)"
  fi
  echo "OK GET $REPORT_URL/api/report/$REPORT_ID/download (HTTP $code)"
else
  echo "SKIP final artifact delivery check (set SMOKE_FINAL_ARTIFACT=1)"
fi

# 10) Negative checks (timeout + empty data)
if [[ "$SMOKE_NEGATIVE_CASE" == "1" ]]; then
  require_env "SESSION_ID" "$SESSION_ID"

  # Empty user message must be rejected with 400.
  http_auth_expect_code "POST" "$CONVERSATION_URL/api/chat/session/$SESSION_ID/message" "400" \
    "{\"content\":\"\"}"

  # Non-existing report should not silently pass.
  http_auth_expect_code "GET" "$REPORT_URL/api/report/00000000-0000-0000-0000-000000000000/status" "404"

  # Polling a non-existing report should end by timeout.
  old_timeout="$REPORT_READY_TIMEOUT_SEC"
  old_poll="$REPORT_READY_POLL_SEC"
  REPORT_READY_TIMEOUT_SEC=3
  REPORT_READY_POLL_SEC=1
  timeout_state="$(wait_report_ready "00000000-0000-0000-0000-000000000000" || true)"
  REPORT_READY_TIMEOUT_SEC="$old_timeout"
  REPORT_READY_POLL_SEC="$old_poll"
  if [[ "$timeout_state" != "timeout" ]]; then
    fail "negative timeout check failed (state=$timeout_state)"
  fi
  echo "OK negative timeout check (state=$timeout_state)"
else
  echo "SKIP negative checks (set SMOKE_NEGATIVE_CASE=1)"
fi

echo "MVP0 smoke checks passed."
