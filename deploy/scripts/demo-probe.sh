#!/usr/bin/env bash
# Scenario A demo: send steady traffic to one Cloud Run service and record a
# timeline of what users saw (first error, when the new revision took traffic,
# totals). Writes a Markdown report to the job summary.
#
# Usage: demo-probe.sh <service> <seconds> <started-epoch>
source "$(dirname "$0")/lib.sh"
svc="$1" seconds="$2" t0="$3"
require GCP_PROJECT_ID GCP_REGION
gcr=(--project "$GCP_PROJECT_ID" --region "$GCP_REGION")

url="$(gcloud run services describe "$svc" "${gcr[@]}" --format='value(status.url)')"
serving() {
  gcloud run services describe "$svc" "${gcr[@]}" --format=json \
    | jq -r '[.status.traffic[]? | select(.percent > 0) | "\(.revisionName) \(.percent)%"] | join(", ")'
}
elapsed() { printf 'T+%ds' "$(( $(date +%s) - t0 ))"; }

timeline=()
add() { timeline+=("| $(date -u +%H:%M:%S) | $(elapsed) | $* |"); log "$(elapsed) $*"; }

ok=0 err=0 first_err="" last_serving="$(serving)" i=0
add "probe started; serving: ${last_serving}"
end=$(( $(date +%s) + seconds ))
while (( $(date +%s) < end )); do
  code="$(curl -s -o /dev/null -m 5 -w '%{http_code}' -H 'x-tenant-id: acme-crisis-line' "$url/api/stats" || true)"
  if [[ "$code" == "200" ]]; then
    ok=$((ok + 1))
  else
    err=$((err + 1))
    [[ -z "$first_err" ]] && { first_err="$(elapsed)"; add "first error seen by a user: HTTP $code"; }
  fi
  i=$((i + 1))
  if (( i % 10 == 0 )); then
    now="$(serving)"
    [[ "$now" != "$last_serving" ]] && { add "traffic moved: $now"; last_serving="$now"; }
  fi
  sleep 1
done
add "probe finished: $ok OK, $err errors"

latest="$(gcloud run services describe "$svc" "${gcr[@]}" --format=json | jq -r '.status.latestCreatedRevisionName')"
ready="$(gcloud run revisions describe "$latest" "${gcr[@]}" --format=json \
  | jq -r '[.status.conditions[]? | select(.type == "Ready")][0] | "\(.status) \(.message // "")"')"

{
  echo "#### What users saw (GET /api/stats, one request per second)"
  echo
  echo "**$ok OK, $err errors**$([[ -n "$first_err" ]] && echo " · first error at $first_err")"
  echo
  echo "| UTC | since change | event |"
  echo "|---|---|---|"
  printf '%s\n' "${timeline[@]}"
  echo
  echo "Newest revision \`$latest\` ready: \`$ready\`"
  echo
  echo "Serving at the end: $(serving)"
} >> "${GITHUB_STEP_SUMMARY:-/dev/stdout}"
