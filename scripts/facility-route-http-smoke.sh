#!/usr/bin/env bash
set -euo pipefail

export CARE_DATABASE_URL='postgresql://smoke:synthetic-ci-only@127.0.0.1:5432/facility_smoke'
export CARE_ENABLE_REAL_PROVIDER_UI=true

node_modules/.bin/next start --hostname 127.0.0.1 --port 3000 >/tmp/facility-next.log 2>&1 &
app_pid=$!
error_pid=''
cleanup() {
  if [ -n "$error_pid" ]; then
    kill "$error_pid" 2>/dev/null || true
    wait "$error_pid" 2>/dev/null || true
  fi
  kill "$app_pid" 2>/dev/null || true
  wait "$app_pid" 2>/dev/null || true
}
trap cleanup EXIT

wait_for_server() {
  local port="$1"
  local pid="$2"
  for _ in $(seq 1 60); do
    if curl --silent --output /dev/null "http://127.0.0.1:${port}/"; then
      return 0
    fi
    if ! kill -0 "$pid" 2>/dev/null; then
      return 1
    fi
    sleep 1
  done
  return 1
}

http_status() {
  curl --silent --output "$2" --write-out '%{http_code}' "$1"
}

if ! wait_for_server 3000 "$app_pid"; then
  echo 'facility_http_server=not_ready'
  exit 1
fi

body=$(mktemp)
status=$(http_status 'http://127.0.0.1:3000/facility/cms/55305/x' "$body")
echo "malformed_ccn_status=${status}"
[ "$status" = '404' ]

status=$(http_status 'http://127.0.0.1:3000/facility/cms/999999/missing-facility' "$body")
echo "confirmed_missing_ccn_status=${status}"
[ "$status" = '404' ]

status=$(http_status 'http://127.0.0.1:3000/facility/cms/010001/synthetic-ci-facility' "$body")
echo "synthetic_valid_profile_status=${status}"
[ "$status" = '200' ]
grep --fixed-strings --quiet 'Synthetic CI Facility' "$body"
rm -f "$body"

CARE_DATABASE_URL='postgresql://smoke:synthetic-ci-only@127.0.0.1:55432/facility_smoke' \
  CARE_ENABLE_REAL_PROVIDER_UI=true \
  node_modules/.bin/next start --hostname 127.0.0.1 --port 3001 >/tmp/facility-next-db-error.log 2>&1 &
error_pid=$!

if ! wait_for_server 3001 "$error_pid"; then
  echo 'facility_database_error_server=not_ready'
  exit 1
fi

status=$(http_status 'http://127.0.0.1:3001/facility/cms/999998/missing-facility' /dev/null)
echo "database_connection_failure_status=${status}"
[ "$status" = '500' ]
