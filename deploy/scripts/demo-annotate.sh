#!/usr/bin/env bash
# Add a Grafana annotation (shown on the Rehearse dashboard next to the deploy
# markers). A no-op unless GRAFANA_URL and GRAFANA_TOKEN are set; never fails.
#
# Usage: demo-annotate.sh <text> [extra-tag ...]
text="$1"; shift
[[ -n "${GRAFANA_URL:-}" && -n "${GRAFANA_TOKEN:-}" ]] || exit 0
tags="$(jq -cn --args '["deploy","demo"] + $ARGS.positional' "$@")"
body="$(jq -cn --arg text "$text" --argjson tags "$tags" '{text: $text, tags: $tags}')"
curl -fsS -m 10 -X POST "${GRAFANA_URL%/}/api/annotations" \
  -H "Authorization: Bearer $GRAFANA_TOKEN" -H 'content-type: application/json' -d "$body" >/dev/null \
  || echo "::warning::Grafana annotation failed (check GRAFANA_ANNOTATION_TOKEN)"
exit 0
