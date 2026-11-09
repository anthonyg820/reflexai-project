#!/usr/bin/env bash
# Deploy one service to ECS as ONE task definition revision (image digest +
# config + shape). The ECS deployment circuit breaker rolls back automatically
# if new tasks fail health checks; we then fail the job.
#
# Usage: aws-deploy.sh <env> <api|web> <version>
source "$(dirname "$0")/lib.sh"
env="$1" service="$2" version="$3"
require AWS_ACCOUNT_ID AWS_REGION
svc="rehearse-${env}-${service}" cluster="rehearse-${env}"

image="$(pinned "$(ecr_repo)" "$service" "$version")"
collector="$(pinned "$(ecr_repo)" collector "$version")"
alb_dns="$(aws elbv2 describe-load-balancers --names "rehearse-${env}" --query 'LoadBalancers[0].DNSName' --output text)"

extra=()
[[ "$service" == "web" ]] && extra+=(--api-url "http://${alb_dns}")

node scripts/render-release.mjs --cloud aws --env "$env" --service "$service" \
  --image "$image" --collector-image "$collector" --version "$version" \
  --account-id "$AWS_ACCOUNT_ID" --region "$AWS_REGION" \
  --grafana-endpoint "${GRAFANA_OTLP_ENDPOINT:-}" --grafana-instance-id "${GRAFANA_OTLP_INSTANCE_ID:-}" \
  "${extra[@]}" --out "/tmp/${svc}.json"

taskdef="$(aws ecs register-task-definition --cli-input-json "file:///tmp/${svc}.json" --query 'taskDefinition.taskDefinitionArn' --output text)"
log "$svc: registered $taskdef"

aws ecs update-service --cluster "$cluster" --service "$svc" --task-definition "$taskdef" --desired-count 1 >/dev/null
log "$svc: waiting for the deployment to finish (circuit breaker rolls back on failure)"
aws ecs wait services-stable --cluster "$cluster" --services "$svc" || true

# shellcheck disable=SC2016 # backticks are JMESPath literals
state="$(aws ecs describe-services --cluster "$cluster" --services "$svc" --query 'services[0].deployments[?status==`PRIMARY`]|[0].[taskDefinition,rolloutState]' --output text)"
read -r primary rollout <<<"$state"
if [[ "$primary" != "$taskdef" || "$rollout" != "COMPLETED" ]]; then
  # Retire the failed revision so rollback.sh can never pick it.
  aws ecs deregister-task-definition --task-definition "$taskdef" >/dev/null || true
  die "$svc: deployment did not complete (primary=$primary rollout=$rollout); ECS rolled back"
fi

base="http://${alb_dns}"
if [[ "$service" == "api" ]]; then
  # /health on the ALB goes to web; check the api through its /api/* rule.
  curl -fsS --max-time 10 -H 'x-tenant-id: acme-crisis-line' "$base/api/stats" >/dev/null || die "api smoke failed"
  log "smoke OK: api @ $base/api"
else
  bash "$(dirname "$0")/smoke.sh" "$base" web "$version"
fi
protect "$image" "aws-${env}" "$version"; protect "$collector" "aws-${env}" "$version"
summary "| aws-${env} | ${service} | \`${version:0:7}\` | \`${image##*@}\` | ${base} |"
