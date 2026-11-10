# RehearseAI

A small roleplay-practice app (a slice of what ReflexAI does) deployed the way ReflexAI deploys:
**Cloud Run on GCP, ECS Fargate on AWS, Terraform + Terragrunt, GitHub Actions and OpenTelemetry.**
I built it to prepare for the CI/CD & developer experience deep dive: it reproduces both problems
from the brief on demand and fixes them in the pipeline. The design is in
[`docs/PLAN.md`](docs/PLAN.md) (§9 "As built" is the current state).

**Status:** GCP is live end to end (gcp-dev → gcp-uat → gcp-prod). AWS is fully written
(modules, units, workflows, release specs) but **deferred**: the AWS account is blocked by an
organization policy, so every AWS step is switched off until the `AWS_ACCOUNT_ID` repo variable
exists. Everything runs on free tiers (Cloud Run, Neon, Grafana Cloud, GitHub Actions).

## The app

Trainees practise hard conversations with a simulated caller or customer, get live coaching, and
are scored against a rubric.

- **3 organizations (tenants)**, 5 scenarios each, chosen with the switcher in the sidebar
  (`X-Tenant-Id` on every API call).
- **8 rubrics** as data (`apps/api/src/scoring/rubrics.ts`): a starting score, a pass mark and
  point rules. One engine scores them all; each scenario picks its rubric.
- **Coaching** (live tips, four 0–5 criteria, key moments) is rules-based and separate from the score.
- Pages: dashboard, scenarios (create your own), practice session, scorecard, history, rubrics
  (with a live "Try it" box). Light and dark mode.

## The two problems, fixed

**Problem 1 · Right config, wrong image (Scenario A)**

- **Build once, promote by digest.** Each merge builds every image once. The same bytes (same
  `sha256`) go to Artifact Registry and ECR, then move dev → UAT → prod. Nothing is rebuilt.
- **One release ships image + config + shape together.** The revision spec
  (`deploy/cloudrun/*.yaml`, `deploy/ecs/*.json`) and runtime config (`deploy/config/*.env.yaml`)
  live next to the code. They're rendered with the image digest into one Cloud Run revision or one
  ECS task definition. Terraform owns everything around the service but never the revision.
- **Config the image doesn't understand never takes traffic.** Config is validated in CI against
  the commit's schema, again at render time, and again when the process starts. A bad revision
  fails its startup probe and the old one keeps serving.

**Problem 2 · The review queue (Scenario B)**

- **Risk-based review.** The `Review policy` workflow reads each PR's diff (paths and dependency
  semver, never commit messages) and sets `risk:low|medium|high` plus a required `review-policy`
  status. Low risk (docs, small dev-tool bumps) auto-merges on green CI; medium needs one human
  who isn't the author; high (infra, deploy specs, workflows, migrations, config schema) needs a
  code owner. Bot approvals never count. Rules: [`scripts/review-policy/classify.mjs`](scripts/review-policy/classify.mjs).
- **The compliance "second person"** is the approval on the production deploy, recorded by GitHub.

Both run on demand from the Actions tab; see [`docs/DEMO.md`](docs/DEMO.md).

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
| API health | http://localhost:8080/health |
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
| `infra/live` | Terragrunt units (25, one state each): `gcp/{shared,dev,uat,prod}`, `aws/{shared,uat,prod}` |
| `.github/workflows` | CI, review policy, release, promote, rollback, deploy (GCP/AWS), infra plan/apply, drift, both demos |
| `scripts/review-policy` | Scenario B risk classifier (unit tested) and the script that labels PRs and sets the status |
| `demo/review-queue` | The three demo PRs for Scenario B (patches checked by CI) |
| `bootstrap` | Windows double-click launchers 1–7 for cloud setup ([`bootstrap/README.md`](bootstrap/README.md)) |
| `docs/presentation` | Animated interview slides: open `index.html`, no build step |

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
| `make demo MODE=…` / `make demo-b MODE=…` | Run the Scenario A / Scenario B demo workflows (see `docs/DEMO.md`) |
| `make test-policy` | Review policy tests + check the demo patches still apply |
| `make aws-pause` | Destroy aws-uat to save money |

## Observability

web and api send traces, metrics and logs with OpenTelemetry (`packages/telemetry`) to a Collector
sidecar, which forwards them to Grafana Cloud (locally: a Grafana container). The **Rehearse
overview** dashboard and the **API 5xx ratio** alert (> 2% for 1 minute) are code in
`deploy/grafana/`; deploys and demos add markers to the dashboard.

## Docs

| Doc | For |
|---|---|
| [`docs/PLAN.md`](docs/PLAN.md) | Design, decisions, and §9 "As built" |
| [`docs/SETUP.md`](docs/SETUP.md) · [`bootstrap/README.md`](bootstrap/README.md) | Cloud setup from scratch (macOS/Linux · Windows) |
| [`docs/DEMO.md`](docs/DEMO.md) | The interview demo script, rehearsal results, and what broke along the way |
| [`docs/presentation/`](docs/presentation/README.md) | The summary slides shown before the demo |
| [`CLAUDE.md`](CLAUDE.md) | Conventions and the rules that keep Problem 1 fixed |

## Lessons from building it

- **Platform defaults drift.** During rehearsal a newer gcloud changed how it parses flags, and
  GitHub's ruleset defaults and its handling of bot-opened PRs changed. Each one broke a working
  pipeline without a code change. The fix every time was to set the behaviour explicitly in code.
- **"Intermittent" isn't always the server.** A React effect that returned a Promise crashed pages
  only on the next re-render; a lint rule now prevents it. Neon closing idle connections crashed
  the API until the pool handled it.

