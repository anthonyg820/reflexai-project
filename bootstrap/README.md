# Bootstrap (Windows, double-click)

Run these once, in order. Each opens a console window and logs to `bootstrap\logs\`.
Values the steps discover (project ID, account ID, Grafana endpoint) go in
`bootstrap\settings.env`, which git ignores. Secrets are never written to disk.

| Step | What it does | You do |
|---|---|---|
| `1-install-tools.cmd` | Terraform, Terragrunt, crane, actionlint, shellcheck into `.tools\bin`; gcloud, AWS CLI, gh via winget | Click **Yes** on admin prompts |
| `2-gcp-setup.cmd` | gcloud sign-in, creates project `rehearse-xxxxxx`, links billing, first Terragrunt apply for GCP | Sign in twice in the browser, type `y` |
| `3-aws-setup.cmd` | AWS credentials check (`aws configure` if needed), first Terragrunt apply for AWS | Paste an IAM admin access key, type `y` |
| `4-secrets.cmd` | Stores Neon URLs and the Grafana token in Secret Manager / SSM | Paste values (hidden) |
| `5-github-setup.cmd` | Repo variables + deployment environments (`production` with you as reviewer) | Sign in to GitHub in the browser |
| `6-grafana-dashboard.cmd` | Loads the dashboard and the 5xx alert rule into Grafana Cloud; optionally stores an annotation token in GitHub for deploy markers (re-run after `deploy/grafana/` changes) | Paste your stack URL once, an **Admin** service account token, and optionally an **Editor** token |
| `7-repo-rules.cmd` | Scenario B repo rules: rulesets for `main` and `demo/queue-base` (required checks, code-owner review), auto-merge, lets Actions open PRs | Nothing (uses your `gh` sign-in) |

Accounts needed first: Google Cloud with billing (step 2), AWS (step 3), Neon with a branch per
environment (`gcp-dev`, `gcp-uat`, `gcp-prod`, plus `aws-uat`, `aws-prod` once AWS exists) and
Grafana Cloud (step 4). Use Neon's **direct** connection strings (pooling off).

**AWS is optional.** Steps 4 and 5 and the workflows run GCP-only until step 3 has completed
(`AWS_READY=true` in `settings.env`, `AWS_ACCOUNT_ID` repo variable); re-run 4 and 5 afterwards.

On macOS/Linux, `docs/SETUP.md` has the same steps as `make` commands.
