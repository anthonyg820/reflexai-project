# Interview demo script (about 10 minutes)

## 1. The pipeline in one picture (2 min)
Open `docs/PLAN.md` §3.2 or the Actions tab. Three points:
- Merge builds once. The **Release** summary shows the digests, and the **mirror** job proves ECR
  holds the same `sha256`.
- **Promote** reads the version from the live environment and refuses to promote if gcp-uat and
  aws-uat differ, or if the digests differ between clouds.
- Only `production` needs a human, once. Then GCP prod runs a 10% canary before AWS prod starts.

## 2. Scenario A, reproduced (3 min)
1. Open the Grafana dashboard and the gcp-dev web URL side by side.
2. Run **Demo: Scenario A** with `mode=legacy-order`. This changes config on the running service
   with the old image, the same order as the old Terraform-first job.
3. The dashboard home page errors for every tenant, the 5xx panel spikes and the alert fires. The
   job summary counts the errors.
4. Run **Demo: Scenario A** with `mode=recover`. The normal release path redeploys a known-good
   revision.

## 3. Scenario A, guarded (2 min)
1. Run **Demo: Scenario A** with `mode=guarded`. It's the same bad config, but with startup validation.
2. The new revision fails its startup probe. The summary shows 30/30 OK and 100% traffic still on
   the old revision. Logs show `Invalid configuration … SCORING_RUBRIC`.
3. Point out that CI would have rejected this before it got this far: `pnpm validate:config` and the
   renderer both refuse an unknown rubric for this commit.

## 4. Rollback and drift (1 min)
- **Rollback** with `cloud=gcp env=prod` moves traffic to the previous revision in seconds.
- **Drift detection** runs nightly and opens an issue for anything changed outside Terraform.

## 5. Scenario B talking points (2 min)
- Renovate risk tiers: low-risk updates merge themselves on green, and they still flow
  dev → UAT → prod with a human approving prod (the compliance "second person").
- CODEOWNERS means only risky paths need a platform reviewer.
- Make required checks trustworthy first (quarantine flaky tests, `turbo --affected`), so human
  review focuses on intent.
