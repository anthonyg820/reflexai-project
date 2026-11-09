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

Accounts needed first: Google Cloud with billing (step 2), AWS (step 3), Neon with five
branches `gcp-dev`, `gcp-uat`, `gcp-prod`, `aws-uat`, `aws-prod` and Grafana Cloud (step 4).

On macOS/Linux, `docs/SETUP.md` has the same steps as `make` commands.
