# Rehearse

A small roleplay-practice app (a slice of what ReflexAI does) deployed the way ReflexAI deploys:
**Cloud Run on GCP, ECS Fargate on AWS, Terraform + Terragrunt, GitHub Actions and OpenTelemetry.**
I built it to prepare for the CI/CD & developer experience deep dive. The design is in
[`docs/PLAN.md`](docs/PLAN.md).

The pipeline fixes both causes of Scenario A (right config, wrong image):

- **Build once, promote by digest.** Each merge builds every image once. The same bytes (same
  `sha256`) go to Artifact Registry and ECR, then move dev → UAT → prod. Nothing is rebuilt.
- **One release ships image + config + shape together.** The revision spec
  (`deploy/cloudrun/*.yaml`, `deploy/ecs/*.json`) and runtime config (`deploy/config/*.env.yaml`)
  live next to the code. They're rendered with the image digest into one Cloud Run revision or one
  ECS task definition. Terraform owns everything around the service but never the revision.
- **Config the image doesn't understand never takes traffic.** Config is validated in CI against
  the commit's schema, again at render time, and again when the process starts. A bad revision
  fails its startup probe and the old one keeps serving.

## Run it locally

```bash
make setup     # once: checks Node/Docker, installs dependencies, creates .env files
make up        # whole stack in Docker
make dev       # or: hot reload on your machine, Postgres + Grafana in Docker

# Windows (PowerShell or cmd): same commands, or double-click a launcher
.\make setup
.\make up
start-dev.cmd     # double-click: hot reload (Postgres + Grafana in Docker, web + api on Windows)
start-local.cmd   # double-click: everything in Docker
```

| What | URL |
|---|---|
| Web app | http://localhost:3000 |
| API health | http://localhost:8080/healthz |
| Grafana (traces, logs, metrics) | http://localhost:3001 (admin / admin). Opens on the **Rehearse overview** dashboard: web + API request rate, 5xx ratio, p95 latency, error logs |

Local Postgres is published on port **55432** so it can't collide with a Postgres you already run.

> **Antivirus HTTPS scanning** (e.g. Avast Web Shield) breaks `docker compose up --build`: npm downloads inside the build fail with `UNABLE_TO_VERIFY_LEAF_SIGNATURE` because containers don't trust the antivirus's certificate. Add `registry.npmjs.org` as a Web Shield exception (or pause HTTPS scanning for the build), or use `start-dev.cmd` / `make dev`.

Run `make` to list every command. **On Windows**, use `.\make <command>` instead: `make.cmd` runs `make.ps1`, a PowerShell version with the same commands (options are written `-Cloud aws -Env uat` instead of `CLOUD=aws ENV=uat`).

## Repo map

| Path | What |
|---|---|
| `apps/web` | Next.js 16 (App Router). Reads all config at request time, so one image works everywhere |
| `apps/api` | NestJS 11 + Drizzle + Postgres. Multi-tenant via `X-Tenant-Id`. Migrations run under an advisory lock |
| `packages/config` | zod schema for runtime config, plus the CLI that validates `deploy/config/*` |
| `packages/telemetry` | Shared OpenTelemetry bootstrap (traces, metrics, logs) |
| `packages/types` | API contract shared by web and api |
| `deploy/config` | Non-secret runtime config per environment, shipped with the image |
| `deploy/cloudrun`, `deploy/ecs` | Revision / task definition specs, rendered by `scripts/render-release.mjs` |
| `deploy/otel` | Collector sidecar config + image (OTLP → Grafana Cloud) |
| `deploy/scripts` | Release scripts used by the workflows (deploy, smoke, promote, rollback) |
| `deploy/grafana` | Dashboard JSON and alert definition |
| `infra/modules` | Terraform modules (GCP + AWS) |
| `infra/live` | Terragrunt units: `gcp/{shared,dev,uat,prod}`, `aws/{shared,uat,prod}` |
| `.github/workflows` | CI, release, promote, rollback, infra plan/apply, drift, Scenario A demo |

## Environments and promotion

```
merge → build once → gcp-dev (auto)
          promote(uat):  gcp-dev ──▶ gcp-uat + aws-uat
          promote(prod): gcp-uat == aws-uat ──▶ approval ──▶ gcp-prod (10% canary) ──▶ aws-prod
```

The promotion workflow reads the version from the **live** source environment, so nothing can skip
a stage. Rollback moves Cloud Run traffic to the previous revision, or points ECS at the previous
task definition.

## Common commands

| Command | What it does |
|---|---|
| `make doctor` / `make install-tools` | Check prerequisites / install pinned terraform, terragrunt, crane, actionlint, shellcheck into `.tools/bin` |
| `make check` | Everything CI checks: lint, typecheck, tests (with e2e), config validation, workflow + shell lint |
| `make scenario-a` | Reproduce Scenario A locally, then show the startup-validation fix |
| `make render` | Render every release spec into `.rendered/` to see exactly what would ship |
| `make tf-plan CLOUD=aws ENV=uat` | Terragrunt plan for one environment (or `UNIT=shared/wif`, or a whole cloud) |
| `make tf-bootstrap CLOUD=gcp` | First apply from your laptop (creates the state bucket) |
| `make promote-uat` / `make promote-prod` / `make rollback CLOUD=gcp ENV=prod` | Trigger release workflows with `gh` |
| `make aws-pause` | Destroy aws-uat to save money |

Cloud setup is in [`docs/SETUP.md`](docs/SETUP.md). The interview demo script is in
[`docs/DEMO.md`](docs/DEMO.md).
