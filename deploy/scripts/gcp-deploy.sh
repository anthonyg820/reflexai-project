#!/usr/bin/env bash
# Deploy one service to Cloud Run as ONE revision (image digest + config + shape),
# at 0% traffic first, smoke-test it on its tagged URL, optionally canary,
# then promote to 100%. If the revision fails its startup probe (e.g. config
# the image doesn't understand), `replace` fails and traffic never moves.
#
# Usage: gcp-deploy.sh <env> <api|web> <version> [canary=false]
source "$(dirname "$0")/lib.sh"
env="$1" service="$2" version="$3" canary="${4:-false}"
require GCP_PROJECT_ID GCP_REGION
svc="rehearse-${env}-${service}"
gcr=(--project "$GCP_PROJECT_ID" --region "$GCP_REGION")

image="$(pinned "$(gar_repo)" "$service" "$version")"
collector="$(pinned "$(gar_repo)" collector "$version")"

describe() { gcloud run services describe "$svc" "${gcr[@]}" --format=json; }
prev="$(describe | jq -r '[.status.traffic[]? | select(.percent == 100) | .revisionName][0] // empty')"

extra=()
if [[ "$service" == "web" ]]; then
  api_url="$(gcloud run services describe "rehearse-${env}-api" "${gcr[@]}" --format='value(status.url)')"
  extra+=(--api-url "$api_url")
fi
[[ -n "$prev" ]] && extra+=(--prev-revision "$prev")

node scripts/render-release.mjs --cloud gcp --env "$env" --service "$service" \
  --image "$image" --collector-image "$collector" --version "$version" \
  --run-id "${GITHUB_RUN_ID:-local}${GITHUB_RUN_ATTEMPT:+-$GITHUB_RUN_ATTEMPT}" \
  --project "$GCP_PROJECT_ID" --region "$GCP_REGION" \
  --grafana-endpoint "${GRAFANA_OTLP_ENDPOINT:-}" --grafana-instance-id "${GRAFANA_OTLP_INSTANCE_ID:-}" \
  "${extra[@]}" --out "/tmp/${svc}.yaml"

log "$svc: creating revision for $version at 0% traffic (serving: ${prev:-none})"
gcloud run services replace "/tmp/${svc}.yaml" "${gcr[@]}" --quiet
new="$(yq '.spec.template.metadata.name' "/tmp/${svc}.yaml")"

if [[ -n "$prev" ]]; then
  candidate_url="$(describe | jq -r '.status.traffic[] | select(.tag == "candidate") | .url')"
  bash "$(dirname "$0")/smoke.sh" "$candidate_url" "$service" "$version"

  if [[ "$canary" == "true" ]]; then
    log "$svc: canary 10% -> $new"
    gcloud run services update-traffic "$svc" "${gcr[@]}" --to-revisions "${new}=10" --quiet
    base_url="$(describe | jq -r .status.url)"
    # Poor man's canary analysis: probe for 2 minutes; any 5xx rolls back.
    # (Upgrade path: query the 5xx rate for this revision from Grafana/Mimir.)
    path="/"; [[ "$service" == "api" ]] && path="/api/stats"
    for _ in $(seq 1 24); do
      code="$(curl -s -o /dev/null -w '%{http_code}' -H 'x-tenant-id: acme-crisis-line' "$base_url$path")"
      if [[ "$code" =~ ^5 ]]; then
        gcloud run services update-traffic "$svc" "${gcr[@]}" --to-revisions "${prev}=100" --quiet
        die "$svc: canary saw HTTP $code; traffic returned to $prev"
      fi
      sleep 5
    done
  fi
fi

gcloud run services update-traffic "$svc" "${gcr[@]}" --to-latest --quiet
gcloud run services update-traffic "$svc" "${gcr[@]}" --remove-tags candidate --quiet 2>/dev/null || true
url="$(describe | jq -r .status.url)"
bash "$(dirname "$0")/smoke.sh" "$url" "$service" "$version"
protect "$image" "gcp-${env}" "$version"; protect "$collector" "gcp-${env}" "$version"
summary "| gcp-${env} | ${service} | \`${version:0:7}\` | \`${image##*@}\` | ${url} |"
log "$svc: $version serving 100% at $url"
