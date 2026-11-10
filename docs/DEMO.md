# Interview demo runbook

Both scenarios run on demand from the **Actions** tab (or `make demo …` / `make demo-b …`,
`.\make demo -Mode …` on Windows). Every run resets its own state first, so you can repeat any
step as often as you like, in any order.

**One-time setup (done):** launchers 1–7 in `bootstrap/`. `6-grafana-dashboard.cmd` ran with an
Admin token (dashboard + the 5xx alert rule) and stored an Editor token for deploy markers;
`7-repo-rules.cmd` created the `main` and `demo-queue` rulesets and turned on auto-merge.
If either is ever re-created, re-run that launcher; both are safe to repeat.

**Opening:** present `docs/presentation/index.html` full screen (press `F`, arrow keys to move).
Eight slides: 1 goal · 2 stack · 3 one digest, one release (GCP / AWS tabs) · 4 CI/CD (click a
phase for details; `A` approves prod) · 5 Problem 1 · 6 Problem 2 · 7 the review policy · 8 live
demo, whose links go straight to the app, Actions and Grafana.

**The day before:** promote the latest release so UAT and prod have every fix (**Promote**
`target=uat`, then `target=prod` and approve), and do one practice run of each scenario.

**Before the interview (5 min):**
1. Run **Demo: Scenario A** with `mode=recover` (dev back on the last release).
2. Run **Demo: Scenario B** with `mode=cleanup`.
3. Open tabs: Grafana dashboard (`/d/rehearse-overview`, last 30 minutes, auto-refresh 10s),
   Grafana Alerting (`/alerting/list`), the Actions tab, the gcp-dev web URL.

---

## 1. The pipeline in one picture (2 min)
Slides 3–4, `docs/PLAN.md` §3.2, or the last **Release** and **Promote** runs:
- Merge builds each image **once**; the Release summary lists the digests.
- **Promote** reads the version running in the previous stage, checks digests, and deploys the
  same bytes. Nothing is rebuilt per environment.
- Only `production` needs a person (the compliance second approval). GCP prod gets a 10% canary.

## 2. Scenario A: right config, wrong image

### 2a. Reproduce the incident (`mode=legacy-order`, ~9 min end to end)
1. Start **Demo: Scenario A**, `mode=legacy-order` (defaults: 4 minutes of traffic, auto-recover on).
2. Talk while it runs. The job pushes `SCORING_RUBRIC=rubric-c` (the environment's default rubric) to the running `rehearse-dev-api`
   **with the old image**, the order the old Terraform-first job used.
3. Open the app's **Rubrics** page: it stays up and says the configured `rubric-c` is unknown to this
   release, which is exactly the mismatch.
4. Watch Grafana: a purple "demo" marker, the API 5xx panel jumps to 100%, the web dashboard page
   errors for every tenant, and about 2 minutes in **Rehearse API 5xx ratio** fires. The alert
   noticed, not a person.
5. Job summary: the timeline (config pushed → new revision took traffic → first user error) and
   the OK/error counts.
6. The `recover` job then redeploys the last real release through the normal path, like the new
   image finally arriving. The whole run takes about as long as their outage did.

### 2b. Same change, guarded (`mode=guarded`, ~5 min)
1. Run `mode=guarded`: the same config with startup validation (the default).
2. Summary: **all requests OK**; the newest revision is `Ready: False`, 100% of traffic stays on the
   old revision. Logs show `Invalid configuration … SCORING_RUBRIC`.
3. Point out the earlier gates: CI (`pnpm validate:config`) and the release renderer reject
   `rubric-c` for this commit, so a real release never gets this far.

### 2c. "The image in production is not the one that was tested" (`mode=rebuild-drift`, ~5 min)
1. Run `mode=rebuild-drift`. It rebuilds the api image from the exact deployed commit.
2. Summary: released digest ≠ rebuilt digest (same commit, different bytes), and dev, UAT and prod
   all run **one** digest because promotion copies by digest.

### 2d. The fix, in one sentence each
- Build once, deploy by digest (`release.yml`, `promote.yml`).
- Image + config + revision shape ship as one revision (`scripts/render-release.mjs`); Terraform
  owns only the service shell and ignores the revision.
- Config is validated in CI, at render time and at startup; bad revisions never get traffic.
- Canary + 5xx alert + deploy markers catch what's left, before a customer does.

## 3. Scenario B: the review queue

### 3a. Open the queue (`mode=open`, ~5 min until the low-risk PR merges)
1. Run **Demo: Scenario B**, `mode=open`. It copies `main` to `demo/queue-base` and opens three PRs:
   | PR | Policy says | What happens |
   |---|---|---|
   | Real dev-tooling dependency update from npm | `risk:low` | Merges itself when CI is green. No human. |
   | Agent-written bug fix + test (`agent` label) | `risk:medium` | Waits for one human approval; bot approvals never count |
   | Infra change (UAT api becomes private) | `risk:high` | Waits for a platform code owner (ruleset + policy) |
2. Open the PR list: risk labels, the `review-policy` status with its reason, CI running.
   Slide 7 has the rules behind each label (when it runs, what it reads, first match wins).
3. A few minutes later the low-risk PR is merged by auto-merge.
4. Approve the agent fix. The **Review policy** workflow re-runs, the status turns green, and you
   can merge it. Approve the infra PR the same way (you're the code owner).

### 3b. Talking points
- The policy is code (`scripts/review-policy/classify.mjs`, unit tested). Rules are by path and
  dependency semver, read from the diff: not commit messages or PR titles, and not trust in who
  (or what) wrote the change. A hand-added `risk:` label is corrected on the next run, and the
  rules always run from `main`, so a PR can't change its own verdict.
- Humans spend review time on intent and risk; required checks (lint, types, tests, config,
  render, image scan) handle the mechanics, so they must be trustworthy (quarantine flaky tests).
- Compliance's "second person" sits on the **production deployment** (Promote → approve), which
  GitHub records with who approved which build. Every change still flows dev → UAT → prod.
- With a real team: turn on "Prevent self-review" on `production` (it's off here because I'm the
  only reviewer), and use Renovate's schedule and grouping (`renovate.json`) to batch updates.

### 3c. Reset
Run `mode=cleanup` (or just `mode=open` again). It closes the demo PRs and deletes every `demo/*`
branch; `main` is never touched.

## 4. Rollback and drift (1 min)
- **Rollback** with `cloud=gcp env=prod` moves traffic to the previous revision in seconds.
- **Drift detection** runs nightly and opens an issue for anything changed outside Terraform.

## Local fallback (no internet)
`make scenario-a` / `.\make scenario-a` shows Scenario A in 10 seconds on your laptop, and
`make test-policy` runs the review-policy tests.
