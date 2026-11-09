# Cloud setup

You need: a GCP project with billing, an AWS account, a Neon account, a Grafana Cloud account (free
tier), and the `gcloud`, `aws`, `terraform` (≥ 1.10) and `terragrunt` (≥ 0.90) CLIs.
Everything below stays inside free tiers except ECS Fargate and the ALB
(about $2.50–3/day with both AWS environments up).

**On Windows, the double-click launchers in `bootstrap/` do all of this for you; see `bootstrap/README.md`.** Otherwise swap `make X CLOUD=gcp` for `.\make X -Cloud gcp`, and set variables with
`$env:GCP_PROJECT_ID = '...'` instead of `export`.

## 1. Shell variables

```bash
export GCP_PROJECT_ID=<your-project-id>  GCP_REGION=us-east1
export AWS_ACCOUNT_ID=<12-digit-id>      AWS_REGION=us-east-1
gcloud auth application-default login
aws configure sso   # or any credentials with admin on the account
```

## 2. Bootstrap infrastructure (one time, from your laptop)

The first apply runs locally because CI's identities don't exist yet. `--backend-bootstrap` creates
the state buckets (`<project>-tfstate` in GCS, `rehearse-tfstate-<account>` in S3).

```bash
make install-tools          # terraform + terragrunt pinned to CI's versions
make tf-bootstrap CLOUD=gcp
make tf-bootstrap CLOUD=aws
```

Then read the outputs you need for GitHub:

```bash
make tf-output CLOUD=gcp UNIT=shared/wif
make tf-output CLOUD=aws UNIT=shared/oidc
```

## 3. Secret values (never in Terraform state)

Create a Neon project with one branch per environment (`dev`, `uat`, `prod`, `aws-uat`, `aws-prod`).
Copy each pooled connection string (with `sslmode=require`). In Grafana Cloud, open
**Connections → OpenTelemetry (OTLP)** and copy the endpoint, the instance ID and a token.

```bash
for env in dev uat prod; do
  printf '%s' '<neon url for gcp-'$env'>' | gcloud secrets versions add rehearse-$env-database-url --data-file=-
  printf '%s' '<grafana token>'           | gcloud secrets versions add rehearse-$env-grafana-otlp-token --data-file=-
done
for env in uat prod; do
  aws ssm put-parameter --overwrite --type SecureString --name /rehearse/$env/database-url --value '<neon url for aws-'$env'>'
  aws ssm put-parameter --overwrite --type SecureString --name /rehearse/$env/grafana-otlp-token --value '<grafana token>'
done
```

## 4. GitHub settings

**Repository variables** (Settings → Secrets and variables → Actions → Variables):

| Variable | Value |
|---|---|
| `GCP_PROJECT_ID`, `GCP_REGION` | as above |
| `GCP_WIF_PROVIDER` | `workload_identity_provider` output |
| `GCP_DEPLOYER_SA`, `GCP_TERRAFORM_SA` | service account outputs |
| `AWS_ACCOUNT_ID`, `AWS_REGION` | as above |
| `AWS_DEPLOYER_ROLE_ARN`, `AWS_TERRAFORM_ROLE_ARN` | role outputs |
| `GRAFANA_OTLP_ENDPOINT`, `GRAFANA_OTLP_INSTANCE_ID` | from Grafana Cloud |
| `GRAFANA_URL` *(optional)* | e.g. `https://you.grafana.net`, for deploy annotations |

**Optional secrets:** `GRAFANA_ANNOTATION_TOKEN` (a Grafana service account token with the
Annotations writer role) and `SLACK_WEBHOOK_URL`.

**Environments** (Settings → Environments). Create `gcp-dev`, `gcp-uat`, `gcp-prod`, `aws-uat` and
`aws-prod`, each limited to the `main` branch. Create `production` with **required reviewers**:
yourself, with "Prevent self-review" turned off so a solo developer can approve.

**Branch protection on `main`:** require the `CI` checks and one approval, and turn on the merge
queue. Install the Renovate GitHub app for dependency PRs.

## 5. First release

Push to `main`. **Release** builds the three images once, copies them to ECR by digest, and deploys
gcp-dev. Then run **Promote** with `target=uat`, and after that `target=prod`.

Import `deploy/grafana/rehearse-overview.json` into Grafana (Dashboards → New → Import) and create
the alert in `deploy/grafana/alerts.md`.

## Tear down

```bash
make aws-pause                  # destroy aws-uat when you're not demoing
make tf-destroy CLOUD=aws       # everything on AWS, after the interview
```

GCP costs nothing at idle (Cloud Run scales to zero), so you can leave it.

## Notes and known trade-offs

- One GCP project and one AWS account hold every environment, to keep the demo simple. Production
  would use a project or account per environment.
- The CI Terraform identities are broad (editor / AdministratorAccess). A real setup would split
  plan and apply roles and add permission boundaries.
- The Cloud Run api is public so the web proxy can reach it. A real setup would use
  internal ingress with IAM-authenticated service-to-service calls.
- Migrations run at api startup under a Postgres advisory lock (expand-only). At scale they'd run as
  a separate job before the rollout.
