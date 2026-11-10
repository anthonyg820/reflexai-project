# CLAUDE.md

## Prompt log (always do this)
At the start of every turn, append the user's prompt to `docs/prompts.md` **before doing any other work**.
- Copy the prompt word for word. Don't summarize, fix typos or reword it.
- Use the next number in sequence and the local time (America/New_York), in this format:

  ```
  ---

  ### <n>. <Day YYYY-MM-DD HH:MM>

  <prompt text>

  **Claude:**

  <Claude's reply>
  ```
- At the end of the turn, add Claude's reply under that entry's `**Claude:**` marker (the final reply, plus any progress messages sent mid-turn, labelled). Condense long tables or file lists if needed, but keep the substance.
- Leave out attached file contents and system or tool messages; log only what the user typed.
- Never edit or remove earlier entries (only the current entry's reply may be filled in).
- Exception to word-for-word: replace secrets (tokens, passwords, keys, connection strings) with `[REDACTED]`. The repo is public.

## Keep this file current (always do this)
Update this CLAUDE.md in the same turn whenever something it describes changes, such as the stack, environments, principles, repo layout, conventions or commands. Also update it when the user states a new standing preference or workflow rule. Keep it short; detailed design belongs in `docs/PLAN.md`.

## Project context
- Mock app ("Rehearse") built to prepare for the ReflexAI Senior Platform Engineer technical deep dive (CI/CD & developer experience), Wed 2026-11-11.
- The design, stack, scope and timeline are in `docs/PLAN.md` (§9 "As built" wins over earlier sections). Treat it as the source of truth and update it when decisions change. Cloud bootstrap: `docs/SETUP.md`. Interview demo: `docs/DEMO.md`.
- Stack: TypeScript (strict), Next.js 16 + NestJS 11, Drizzle + Postgres (Neon), pnpm + Turborepo, Terraform + Terragrunt, GitHub Actions, GCP Cloud Run + AWS ECS Fargate, OpenTelemetry → Grafana.
- Environments: gcp-dev (auto on merge) → gcp-uat + aws-uat (manual promote) → approval → gcp-prod (canary) → aws-prod.
- **AWS is currently deferred** (the user's AWS account is blocked by an organization SCP). Everything must keep working GCP-only: AWS jobs/steps are gated on the `AWS_ACCOUNT_ID` repo variable (workflows) and `AWS_READY=true` in `bootstrap/settings.env` (scripts).
- Keep costs low: prefer free tiers and open source, no NAT gateways, and tear down AWS environments when they're not in use.

## Observability
- Alert rules live in `deploy/grafana/alerting/*.json` and are provisioned by `scripts/grafana-import.mjs` (needs an Admin token on Grafana Cloud).
- web and api both use `packages/telemetry` (OTel NodeSDK; the web loads it from `instrumentation.ts`, with OTel/pino in `serverExternalPackages`). Server-side logging goes through pino (`apps/web/lib/logger.ts`, nestjs-pino in the api).
- The dashboard lives in `deploy/grafana/rehearse-overview.json`. `scripts/grafana-import.mjs` loads it into local Grafana on `make up` / `make dev` (`make grafana-import` to reload). When changing the dashboard, keep panels working without the `cloud_provider` label: it only exists behind the cloud Collector.

## Web UI
- Design: the "Rehearse UI refresh" canvas (sidebar layout, Space Grotesk headings, Inter body text). Colors are tokens in `apps/web/app/globals.css`; dark mode overrides them under `[data-theme="dark"]`. The sidebar toggle stores a `theme` cookie; with no cookie, an inline script follows the OS setting. Use the tokens (`bg-card`, `text-muted`, `bg-accent-soft`…), never raw hex values in components.
- Fonts are self-hosted via `@fontsource-variable/*` (npm). Don't use `next/font/google`: it downloads at build time, and Avast blocks that on the user's machine.
- Coaching (live coach panel, scorecard criteria, key moments) is rules-based in `apps/api/src/scoring/coaching.ts`. It's separate from the rubric score, which stays the Scenario A switch.
- The Rubrics page (`/rubrics`, API `GET /api/rubrics` + `POST /api/rubrics/preview`) explains each rubric from `scoring/rubric-info.ts`. A test requires an entry for every rubric, so add one when you add a rubric. The page never throws on an unknown `SCORING_RUBRIC`; it shows a warning instead.

## Review policy (Scenario B)
- `scripts/review-policy/classify.mjs` decides `risk:low|medium|high` by path and dependency semver; the `review-policy` commit status is a required check (rulesets from `bootstrap/7-repo-rules.cmd`). New platform paths go in both `HIGH_RISK_PATHS` and `.github/CODEOWNERS`.
- The demo PRs come from `demo/review-queue/*.patch`; CI checks they still apply, so update a patch when you change the code it touches.

## Gotchas
- Health endpoint is `/health`, never `/healthz`: Cloud Run's front end reserves paths ending in `z` and returns its own 404.

## Rules that keep Scenario A fixed (don't break these)
- Build each image once per commit; deploy only by digest (`…@sha256:`). Never rebuild per environment.
- Image + runtime config + revision shape ship together: `deploy/cloudrun/*.yaml` or `deploy/ecs/*.json`, rendered by `scripts/render-release.mjs` with `deploy/config/<cloud>-<env>.env.yaml`.
- Terraform owns service shells (identity, IAM, networking, secret containers) and must keep ignoring the revision/task definition.
- Every new runtime config key goes in `packages/config` (zod schema) first. `deploy/config/*` holds only non-secret values; secrets come from Secret Manager / SSM.
- No build-time environment in the web app: no `NEXT_PUBLIC_*`, no `next.config` rewrites.
- Migrations must be backward compatible with the previous release (expand/contract).
- Naming conventions link Terraform and release specs: `rehearse-<env>-<svc>` (services, runtime SA, task family), `rehearse-<env>-ecs-exec`, `/rehearse/<env>/<secret>` (SSM), `rehearse-<env>-<secret>` (GCP secrets).

## Commands
- Cloud bootstrap on Windows: double-click launchers in `bootstrap/` (1 tools, 2 GCP, 3 AWS, 4 secrets, 5 GitHub, 6 Grafana Cloud dashboard + alert, 7 repo rules for Scenario B); state in git-ignored `bootstrap/settings.env` (the Makefile and `make.ps1` load it, so no user-level env vars are needed; setting those on Windows hangs for ~1 min), logs in `bootstrap/logs/`. Claude can't type in the user's terminals, so new interactive steps should be launchers too.
- Local Postgres is on host port 55432 (not 5432/5433: the user's machine runs its own Postgres). The user's Windows machine has Avast HTTPS scanning, so npm downloads in Docker builds need `registry.npmjs.org` excluded from Web Shield (done). The web image is Debian-based (`node:22-bookworm-slim`) because Next.js's musl binaries crash on that Docker Desktop; `make up` builds images one at a time.
Use the Makefile on Linux/macOS/WSL (`make` lists everything) and `make.ps1` on Windows (`.\make <command> -Cloud aws -Env uat`, via `make.cmd`). They expose the same commands: when adding or changing a target, update BOTH, and keep tool version pins identical (also in `.github/actions/setup-iac`). Keep `make.ps1` ASCII-only and compatible with Windows PowerShell 5.1.
- `make setup` (once), `make up` / `make down` (Docker stack: web :3000, api :8080, Grafana :3001), `make dev` (hot reload)
- `make check`: everything CI checks (lint, typecheck, tests incl. API e2e, config validation, actionlint, shellcheck)
- `make install-tools`: pinned terraform/terragrunt/crane/actionlint/shellcheck into `.tools/bin` (same pins as CI)
- Demos (`docs/DEMO.md`): `make demo MODE=legacy-order|guarded|rebuild-drift|recover` (Scenario A on gcp-dev), `make demo-b MODE=open|cleanup` (Scenario B PRs against the throwaway `demo/queue-base` branch). Each run resets its own state; keep it that way.
- `make render`, `make scenario-a`, `make test-policy`, `make tf-plan CLOUD=gcp|aws [ENV=… | UNIT=…]`, `make promote-uat|promote-prod`, `make rollback CLOUD=… ENV=…`
- Terragrunt uses the v0.99 CLI: `terragrunt run --all -- plan`. Tool version pins live at the top of the Makefile and in `.github/actions/setup-iac`.
