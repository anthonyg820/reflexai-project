#!/usr/bin/env bash
# Roll one environment back to the previous release, web first then api.
#   GCP: move 100% traffic to the previous ready revision (instant, no new revision)
#   AWS: point the service at the previous task definition revision
#
# Usage: rollback.sh <gcp|aws> <env>
source "$(dirname "$0")/lib.sh"
cloud="$1" env="$2"
for service in web api; do
  svc="rehearse-${env}-${service}"
  if [[ "$cloud" == "gcp" ]]; then
    require GCP_PROJECT_ID GCP_REGION
    gcr=(--project "$GCP_PROJECT_ID" --region "$GCP_REGION")
    current="$(gcloud run services describe "$svc" "${gcr[@]}" --format=json | jq -r '[.status.traffic[]? | select(.percent == 100) | .revisionName][0]')"
    target="$(gcloud run revisions list --service "$svc" "${gcr[@]}" --format=json \
      | jq -r --arg cur "$current" 'map(select(.metadata.labels.app == "rehearse"))
          | sort_by(.metadata.creationTimestamp) | reverse
          | (map(.metadata.name) | index($cur)) as $i
          | if $i == null then empty else .[$i + 1:] end
          | map(select(any(.status.conditions[]?; .type == "Ready" and .status == "True")))
          | .[0].metadata.name // empty')"
    [[ -n "$target" ]] || die "$svc: no earlier ready revision to roll back to"
    gcloud run services update-traffic "$svc" "${gcr[@]}" --to-revisions "${target}=100" --quiet
    log "$svc: $current -> $target"
  else
    require AWS_REGION
    cluster="rehearse-${env}"
    current="$(aws ecs describe-services --cluster "$cluster" --services "$svc" --query 'services[0].taskDefinition' --output text)"
    target="$(aws ecs list-task-definitions --family-prefix "$svc" --sort DESC --query 'taskDefinitionArns' --output json \
      | jq -r --arg cur "$current" '(index($cur)) as $i | if $i == null then empty else .[$i + 1] // empty end')"
    [[ -n "$target" && "$target" != *":1" ]] || die "$svc: no earlier release to roll back to"
    aws ecs update-service --cluster "$cluster" --service "$svc" --task-definition "$target" >/dev/null
    aws ecs wait services-stable --cluster "$cluster" --services "$svc"
    log "$svc: $current -> $target"
  fi
done
