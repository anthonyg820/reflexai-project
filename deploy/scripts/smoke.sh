#!/usr/bin/env bash
# Smoke-test one service at a base URL and check it runs the expected version.
# Usage: smoke.sh <base-url> <api|web> <version>
source "$(dirname "$0")/lib.sh"
url="${1%/}" service="$2" version="$3"

for attempt in $(seq 1 10); do
  if health="$(curl -fsS --max-time 5 "$url/healthz")"; then break; fi
  [[ $attempt == 10 ]] && die "$service: $url/healthz never became healthy"
  sleep 3
done
running="$(jq -r .version <<<"$health")"
[[ "$running" == "$version" ]] || die "$service at $url runs version '$running', expected '$version'"

if [[ "$service" == "api" ]]; then
  curl -fsS --max-time 10 -H 'x-tenant-id: acme-crisis-line' "$url/api/stats" >/dev/null || die "api: GET /api/stats failed"
  curl -fsS --max-time 10 -H 'x-tenant-id: northwind-health' "$url/api/scenarios" >/dev/null || die "api: GET /api/scenarios failed"
else
  curl -fsS --max-time 15 -o /dev/null "$url/" || die "web: GET / failed"
  curl -fsS --max-time 15 -o /dev/null "$url/scenarios" || die "web: GET /scenarios failed"
fi
log "smoke OK: $service @ $url ($version)"
