#!/usr/bin/env bash
# Print the version (git SHA) currently serving 100% in an environment.
# Promotion copies exactly this version to the next environment, so the live
# environment is the source of truth -- no separate bookkeeping to drift.
#
# Usage: current-version.sh <gcp|aws> <env>
source "$(dirname "$0")/lib.sh"
cloud="$1" env="$2"
versions=()
for service in api web; do
  svc="rehearse-${env}-${service}"
  if [[ "$cloud" == "gcp" ]]; then
    require GCP_PROJECT_ID GCP_REGION
    rev="$(gcloud run services describe "$svc" --project "$GCP_PROJECT_ID" --region "$GCP_REGION" --format=json \
      | jq -r '[.status.traffic[]? | select(.percent == 100) | .revisionName][0] // empty')"
    [[ -n "$rev" ]] || die "$svc has no revision at 100% traffic"
    v="$(gcloud run revisions describe "$rev" --project "$GCP_PROJECT_ID" --region "$GCP_REGION" --format=json \
      | jq -r '.metadata.labels["rehearse-version"] // empty')"
  else
    require AWS_REGION
    td="$(aws ecs describe-services --cluster "rehearse-${env}" --services "$svc" --query 'services[0].taskDefinition' --output text)"
    v="$(aws ecs describe-task-definition --task-definition "$td" --include TAGS --query "tags[?key=='rehearse-version'].value|[0]" --output text)"
  fi
  [[ -n "$v" && "$v" != "None" ]] || die "$svc: no rehearse-version found (never released?)"
  versions+=("$v")
done
[[ "${versions[0]}" == "${versions[1]}" ]] || die "${cloud}-${env}: api (${versions[0]}) and web (${versions[1]}) differ; finish or roll back that release first"
echo "${versions[0]}"
