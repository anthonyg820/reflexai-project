#!/usr/bin/env bash
# Shared helpers for release scripts. Expects to run from the repo root.
set -euo pipefail

log() { printf '\033[1m==> %s\033[0m\n' "$*" >&2; }
die() { printf '::error::%s\n' "$*" >&2; exit 1; }
require() { for v in "$@"; do [[ -n "${!v:-}" ]] || die "missing required env var: $v"; done; }

gar_repo() { echo "${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/rehearse"; }
ecr_repo() { echo "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/rehearse"; }

# Resolve an immutable sha-<version> tag to a digest-pinned reference.
pinned() { # <repo> <image> <version>
  local ref="$1/$2:sha-$3" digest
  digest="$(crane digest "$ref")" || die "image not found: $ref (was it built?)"
  echo "$1/$2@${digest}"
}

# Add a deployed-<env>-<sha> tag so registry cleanup never deletes what an
# environment (or its rollback target) runs. Immutable tags still allow new tags.
protect() { # <pinned-ref> <cloud-env> <version>
  crane tag "$1" "deployed-$2-${3:0:12}" 2>/dev/null || true
}

summary() { [[ -n "${GITHUB_STEP_SUMMARY:-}" ]] && echo "$*" >> "$GITHUB_STEP_SUMMARY" || true; }
