#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNLOGS_DIR="$ROOT_DIR/.runlogs/smoke"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
SUMMARY_LOG="$RUNLOGS_DIR/mvp0-pre-release-$TIMESTAMP.log"

GATE_RUNS="${GATE_RUNS:-3}"

mkdir -p "$RUNLOGS_DIR"

run_phase() {
  local name="$1"
  shift
  echo ""
  echo "== PRE-RELEASE PHASE: $name =="
  {
    echo ""
    echo "phase=$name started_at=$(date +%Y-%m-%dT%H:%M:%S)"
  } >>"$SUMMARY_LOG"

  if ! ( "$@" ); then
    echo "phase=$name result=failed" >>"$SUMMARY_LOG"
    echo "PRE-RELEASE FAILED at phase: $name"
    echo "Summary log: $SUMMARY_LOG"
    exit 1
  fi

  echo "phase=$name result=passed" >>"$SUMMARY_LOG"
}

echo "== MVP0 Pre-release Runner =="
echo "GATE_RUNS=$GATE_RUNS"
{
  echo "timestamp=$TIMESTAMP"
  echo "gate_runs=$GATE_RUNS"
} >"$SUMMARY_LOG"

run_phase "stability-gate" env RUNS="$GATE_RUNS" bash "$ROOT_DIR/scripts/smoke/mvp0-full-run.sh"
run_phase "final-artifact-delivery" env RUNS=1 SMOKE_FINAL_ARTIFACT=1 bash "$ROOT_DIR/scripts/smoke/mvp0-full-run.sh"
run_phase "negative-cases" env RUNS=1 SMOKE_NEGATIVE_CASE=1 bash "$ROOT_DIR/scripts/smoke/mvp0-full-run.sh"

echo ""
echo "== PRE-RELEASE RESULT: PASSED =="
echo "Summary log: $SUMMARY_LOG"
