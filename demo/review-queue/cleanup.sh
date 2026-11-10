#!/usr/bin/env bash
# Scenario B demo: close the demo PRs and delete every demo/* branch, so the
# next run starts from nothing. Safe to run any time; main is never touched.
# Needs GH_TOKEN and GITHUB_REPOSITORY.
set -euo pipefail
repo="${GITHUB_REPOSITORY:?}"

gh pr list --repo "$repo" --state open --base demo/queue-base --json number -q '.[].number' | while read -r n; do
  gh pr close "$n" --repo "$repo" --comment "Closed by the Scenario B demo cleanup." >/dev/null && echo "closed #$n"
done
gh pr list --repo "$repo" --state open --json number,headRefName -q '.[] | select(.headRefName | startswith("demo/")) | .number' | while read -r n; do
  gh pr close "$n" --repo "$repo" >/dev/null && echo "closed #$n"
done

gh api "repos/$repo/git/matching-refs/heads/demo/" -q '.[].ref' | while read -r ref; do
  gh api -X DELETE "repos/$repo/git/$ref" >/dev/null && echo "deleted ${ref#refs/heads/}"
done
echo "cleanup done"
