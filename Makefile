# Rehearse developer commands.  Run `make` (or `make help`) to list them.
#
# Works on macOS, Linux and WSL. On Windows, run it from WSL (recommended) or
# Git Bash; `make install-tools` only knows Linux/macOS binaries.

SHELL := /usr/bin/env bash
.SHELLFLAGS := -euo pipefail -c
.DEFAULT_GOAL := help
MAKEFLAGS += --no-print-directory

# ---- Pinned tool versions (CI uses the same Terraform/Terragrunt pins) -------
TERRAFORM_VERSION  ?= 1.13.4
TERRAGRUNT_VERSION ?= 0.99.5
ACTIONLINT_VERSION ?= 1.7.7
SHELLCHECK_VERSION ?= 0.10.0
CRANE_VERSION      ?= 0.21.7
NODE_MAJOR         := $(shell cat .nvmrc)

# Repo-local tool dir, so nothing is installed system-wide.
TOOLS_DIR := $(CURDIR)/.tools/bin
export PATH := $(TOOLS_DIR):$(PATH)

UNAME_S := $(shell uname -s)
UNAME_M := $(shell uname -m)
OS      := $(if $(filter Darwin,$(UNAME_S)),darwin,linux)
ARCH    := $(if $(filter arm64 aarch64,$(UNAME_M)),arm64,amd64)

# ---- Terraform / Terragrunt targeting ---------------------------------------
# make tf-plan CLOUD=aws ENV=uat     -> infra/live/aws/uat
# make tf-plan CLOUD=gcp             -> infra/live/gcp (all units)
# make tf-plan CLOUD=gcp UNIT=shared/wif
CLOUD ?= gcp
ENV   ?=
UNIT  ?=
TG_DIR := infra/live/$(CLOUD)$(if $(UNIT),/$(UNIT),$(if $(ENV),/$(ENV)))

# ---- Local database ----------------------------------------------------------
LOCAL_DB      := postgres://postgres:rehearse@localhost:55432/rehearse
LOCAL_TEST_DB := postgres://postgres:rehearse@localhost:55432/rehearse_test
COMPOSE       := docker compose

# Account settings written by the bootstrap scripts (GCP_PROJECT_ID, AWS_ACCOUNT_ID, ...).
# (Make gives these precedence over the environment.)
-include bootstrap/settings.env
export GCP_PROJECT_ID GCP_REGION AWS_ACCOUNT_ID AWS_REGION

export TURBO_TELEMETRY_DISABLED := 1
export NEXT_TELEMETRY_DISABLED  := 1

##@ Getting started

.PHONY: help
help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage: make \033[36m<target>\033[0m [CLOUD=gcp|aws ENV=dev|uat|prod UNIT=path]\n"} \
	  /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 } \
	  /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) }' $(MAKEFILE_LIST)

.PHONY: setup
setup: doctor-required ## One-time local setup: pnpm, dependencies, .env files, shared packages
	@corepack enable >/dev/null 2>&1 || echo "corepack not available; make sure pnpm is installed"
	pnpm install --frozen-lockfile
	@for f in apps/api/.env apps/web/.env; do \
	  if [[ ! -f $$f ]]; then cp $$f.example $$f; echo "created $$f"; fi; \
	done
	pnpm turbo run build --filter='./packages/*'
	@echo -e "\n\033[32mReady.\033[0m  Next: 'make up' (everything in Docker) or 'make dev' (hot reload)."

.PHONY: doctor
doctor: ## Check which tools are installed (required and optional)
	@check() { if command -v $$1 >/dev/null 2>&1; then printf "  \033[32m✓\033[0m %-11s %s\n" "$$1" "$$($$2 2>&1 | head -1)"; \
	  else printf "  \033[31m✗\033[0m %-11s %s\n" "$$1" "$$3"; fi; }; \
	echo "Required for local development:"; \
	check node "node --version" "install Node $(NODE_MAJOR) (nvm install / brew install node@$(NODE_MAJOR))"; \
	check pnpm "pnpm --version" "run: corepack enable"; \
	check docker "docker --version" "install Docker Desktop or Docker Engine"; \
	echo "Infrastructure and release (make install-tools):"; \
	check terraform "terraform version" "make install-tools"; \
	check terragrunt "terragrunt --version" "make install-tools"; \
	check crane "crane version" "make install-tools"; \
	check actionlint "actionlint --version" "make install-tools"; \
	check shellcheck "shellcheck --version" "make install-tools"; \
	echo "Cloud CLIs (installed separately, see 'make install-tools'):"; \
	check gcloud "gcloud --version" "https://cloud.google.com/sdk/docs/install"; \
	check aws "aws --version" "https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"; \
	check gh "gh --version" "https://cli.github.com (needed for make promote/rollback)"

.PHONY: doctor-required
doctor-required:
	@command -v node >/dev/null || { echo "Node $(NODE_MAJOR) is required"; exit 1; }
	@[[ "$$(node -p 'process.versions.node.split(".")[0]')" -ge $(NODE_MAJOR) ]] || { echo "Node >= $(NODE_MAJOR) required (found $$(node --version))"; exit 1; }
	@command -v docker >/dev/null || echo "warning: docker not found; 'make up' and 'make dev' need it"

##@ Prerequisite binaries

.PHONY: install-tools
install-tools: $(TOOLS_DIR)/terraform $(TOOLS_DIR)/terragrunt $(TOOLS_DIR)/actionlint $(TOOLS_DIR)/shellcheck $(TOOLS_DIR)/crane ## Install pinned terraform, terragrunt, crane, actionlint, shellcheck into .tools/bin
	@echo -e "\nInstalled into .tools/bin (make adds it to PATH automatically)."
	@echo "To use them outside make:  export PATH=\"$(TOOLS_DIR):\$$PATH\""
	@command -v gcloud >/dev/null || echo "gcloud CLI not found: brew install --cask google-cloud-sdk, or https://cloud.google.com/sdk/docs/install"
	@command -v aws >/dev/null    || echo "aws CLI not found:    brew install awscli, or https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"

$(TOOLS_DIR):
	@mkdir -p $@

# Use a tool already on PATH; otherwise install the pinned version.
ensure-%:
	@command -v $* >/dev/null 2>&1 || $(MAKE) $(TOOLS_DIR)/$*

$(TOOLS_DIR)/terraform: | $(TOOLS_DIR)
	@command -v unzip >/dev/null || { echo "unzip is required (apt install unzip / brew install unzip)"; exit 1; }
	@echo "installing terraform $(TERRAFORM_VERSION)"
	@tmp=$$(mktemp -d); curl -fsSL -o $$tmp/tf.zip \
	  https://releases.hashicorp.com/terraform/$(TERRAFORM_VERSION)/terraform_$(TERRAFORM_VERSION)_$(OS)_$(ARCH).zip; \
	  unzip -qo $$tmp/tf.zip terraform -d $(TOOLS_DIR); rm -rf $$tmp

$(TOOLS_DIR)/terragrunt: | $(TOOLS_DIR)
	@echo "installing terragrunt $(TERRAGRUNT_VERSION)"
	@curl -fsSL -o $@ https://github.com/gruntwork-io/terragrunt/releases/download/v$(TERRAGRUNT_VERSION)/terragrunt_$(OS)_$(ARCH)
	@chmod +x $@

$(TOOLS_DIR)/actionlint: | $(TOOLS_DIR)
	@echo "installing actionlint $(ACTIONLINT_VERSION)"
	@curl -fsSL https://github.com/rhysd/actionlint/releases/download/v$(ACTIONLINT_VERSION)/actionlint_$(ACTIONLINT_VERSION)_$(OS)_$(ARCH).tar.gz \
	  | tar -xz -C $(TOOLS_DIR) actionlint

$(TOOLS_DIR)/shellcheck: | $(TOOLS_DIR)
	@echo "installing shellcheck $(SHELLCHECK_VERSION)"
	@arch=$(if $(filter arm64,$(ARCH)),aarch64,x86_64); tmp=$$(mktemp -d); \
	  curl -fsSL https://github.com/koalaman/shellcheck/releases/download/v$(SHELLCHECK_VERSION)/shellcheck-v$(SHELLCHECK_VERSION).$(OS).$$arch.tar.xz \
	  | tar -xJ -C $$tmp; mv $$tmp/shellcheck-v$(SHELLCHECK_VERSION)/shellcheck $@; rm -rf $$tmp

$(TOOLS_DIR)/crane: | $(TOOLS_DIR)
	@echo "installing crane $(CRANE_VERSION)"
	@os=$(if $(filter darwin,$(OS)),Darwin,Linux); arch=$(if $(filter arm64,$(ARCH)),arm64,x86_64); \
	  curl -fsSL https://github.com/google/go-containerregistry/releases/download/v$(CRANE_VERSION)/go-containerregistry_$${os}_$${arch}.tar.gz \
	  | tar -xz -C $(TOOLS_DIR) crane

##@ Run locally

.PHONY: up
up: ## Run the full stack in Docker: web :3000, api :8080, Grafana :3001
	@# Build one image at a time: parallel Next.js + Nest builds can exhaust Docker's memory (exit 137).
	$(COMPOSE) build api
	$(COMPOSE) build web
	$(COMPOSE) up -d
	@node scripts/grafana-import.mjs
	@echo -e "\n  web      http://localhost:3000\n  api      http://localhost:8080/health\n  grafana  http://localhost:3001  (admin / admin)\n"

.PHONY: down
down: ## Stop the Docker stack (keeps the database volume)
	$(COMPOSE) down

.PHONY: logs
logs: ## Follow logs from the Docker stack (SERVICE=api to filter)
	$(COMPOSE) logs -f $(SERVICE)

.PHONY: ps
ps: ## Show Docker stack status
	$(COMPOSE) ps

.PHONY: deps-up
deps-up: ## Start only Postgres + Grafana LGTM (for 'make dev')
	$(COMPOSE) up -d --wait postgres lgtm
	@node scripts/grafana-import.mjs

.PHONY: dev
dev: deps-up ## Hot-reload web + api on your machine against Dockerized Postgres + Grafana
	@[[ -f apps/api/.env ]] || { echo "run 'make setup' first"; exit 1; }
	pnpm dev

.PHONY: open
open: ## Open the web app and Grafana in your browser
	@for u in http://localhost:3000 http://localhost:3001; do \
	  (command -v open >/dev/null && open $$u) || (command -v xdg-open >/dev/null && xdg-open $$u) || echo $$u; done

.PHONY: grafana-import
grafana-import: ## (Re)load the Rehearse dashboard into local Grafana and make it the home page
	node scripts/grafana-import.mjs

##@ Quality (what CI runs)

.PHONY: check
check: lint typecheck test validate-config lint-workflows lint-shell ## Everything CI checks before a merge

.PHONY: build
build: ## Build all packages and apps
	pnpm turbo run build

.PHONY: lint
lint: ## ESLint across the monorepo
	pnpm turbo run lint

.PHONY: typecheck
typecheck: ## TypeScript type checks
	pnpm turbo run typecheck

.PHONY: test
test: test-db ## Unit + API e2e tests (uses the Dockerized Postgres)
	DATABASE_URL_TEST=$(LOCAL_TEST_DB) pnpm turbo run test

.PHONY: test-unit
test-unit: ## Unit tests only (no database needed)
	pnpm turbo run test

.PHONY: test-db
test-db:
	@$(COMPOSE) up -d --wait postgres
	@$(COMPOSE) exec -T postgres psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'rehearse_test'" | grep -q 1 \
	  || $(COMPOSE) exec -T postgres psql -U postgres -c "CREATE DATABASE rehearse_test" >/dev/null

.PHONY: validate-config
validate-config: ## Validate deploy/config/* against this commit's config schema
	@pnpm --filter @rehearse/config build >/dev/null
	pnpm validate:config

.PHONY: lint-workflows
lint-workflows: ensure-actionlint ## Lint GitHub Actions workflows
	actionlint

.PHONY: lint-shell
lint-shell: ensure-shellcheck ## Lint release shell scripts
	shellcheck -x -P deploy/scripts deploy/scripts/*.sh

.PHONY: render
render: ## Render every release spec with dummy digests into .rendered/ (to inspect what would ship)
	@pnpm --filter @rehearse/config build >/dev/null
	@mkdir -p .rendered; d="sha256:$$(printf '0%.0s' $$(seq 64))"; \
	v="$$(git rev-parse --verify -q HEAD 2>/dev/null || echo local)"; \
	for ce in gcp:dev gcp:uat gcp:prod aws:uat aws:prod; do c=$${ce%%:*}; e=$${ce##*:}; \
	  for s in api web; do ext=$$([[ $$c == gcp ]] && echo yaml || echo json); \
	    node scripts/render-release.mjs --cloud $$c --env $$e --service $$s \
	      --image registry/$$s@$$d --collector-image registry/collector@$$d --version $$v \
	      --project demo-project --account-id 000000000000 --region us-east-1 --api-url https://api.example \
	      --grafana-endpoint https://otlp.example --grafana-instance-id 1 --out .rendered/$$c-$$e-$$s.$$ext; \
	  done; done

##@ Database (local)

.PHONY: db-shell
db-shell: ## psql into the local database
	$(COMPOSE) exec postgres psql -U postgres -d rehearse

.PHONY: db-reset
db-reset: ## Drop and recreate the local database (migrations + seed run on next api start)
	$(COMPOSE) exec -T postgres psql -U postgres -c "DROP DATABASE IF EXISTS rehearse WITH (FORCE)" -c "CREATE DATABASE rehearse"
	@echo "Database reset. Restart the api (make up, or re-run make dev) to migrate and seed."

##@ Scenario A, locally

.PHONY: scenario-a
scenario-a: deps-up ## Show both behaviours locally: lazy config -> 500s, startup validation -> refuses to start
	@pnpm turbo run build --filter=@rehearse/api... >/dev/null
	@echo -e "\n\033[1m1) Legacy behaviour: new config, old code, lazy validation\033[0m"
	@cd apps/api && (DEPLOY_ENV=local CLOUD_PROVIDER=local DATABASE_URL=$(LOCAL_DB) MIGRATE_ON_START=true OTEL_SDK_DISABLED=true \
	  PORT=8099 SCORING_RUBRIC=rubric-c CONFIG_VALIDATION=lazy node --require ./dist/otel.js dist/main.js >/tmp/rehearse-scenario-a.log 2>&1 & echo $$! > /tmp/rehearse-scenario-a.pid)
	@for _ in $$(seq 1 20); do curl -fs localhost:8099/health >/dev/null && break; sleep 0.5; done
	@echo -n "   /health       -> "; curl -s -o /dev/null -w '%{http_code} (looks healthy, so it gets traffic)\n' localhost:8099/health
	@echo -n "   /api/stats     -> "; curl -s -o /dev/null -w '%{http_code} (every tenant gets server errors)\n' -H 'x-tenant-id: acme-crisis-line' localhost:8099/api/stats
	@kill $$(cat /tmp/rehearse-scenario-a.pid) 2>/dev/null || true
	@echo -e "\n\033[1m2) The fix: same config, startup validation\033[0m"
	@cd apps/api && DEPLOY_ENV=local CLOUD_PROVIDER=local DATABASE_URL=$(LOCAL_DB) OTEL_SDK_DISABLED=true PORT=8099 \
	  SCORING_RUBRIC=rubric-c node --require ./dist/otel.js dist/main.js 2>&1 | sed 's/^/   /' || \
	  echo "   -> process exits before listening: the startup probe fails and the old revision keeps serving"
	@echo -e "\n\033[1m3) And CI would have caught it first:\033[0m"
	@echo "   pnpm validate:config / render-release.mjs reject unknown rubrics for this commit."

##@ Infrastructure (Terraform + Terragrunt)

.PHONY: tf-env-check
tf-env-check:
	@command -v terragrunt >/dev/null || { echo "terragrunt not found: make install-tools"; exit 1; }
	@if [[ "$(CLOUD)" == "gcp" ]]; then [[ -n "$${GCP_PROJECT_ID:-}" ]] || { echo "export GCP_PROJECT_ID (and optionally GCP_REGION) first"; exit 1; }; \
	 elif [[ "$(CLOUD)" == "aws" ]]; then [[ -n "$${AWS_ACCOUNT_ID:-}" ]] || { echo "export AWS_ACCOUNT_ID (and optionally AWS_REGION) first"; exit 1; }; \
	 else echo "CLOUD must be gcp or aws"; exit 1; fi
	@[[ -d "$(TG_DIR)" ]] || { echo "no such Terragrunt dir: $(TG_DIR)"; exit 1; }
	@echo "→ $(TG_DIR)"

.PHONY: tf-fmt
tf-fmt: ## Format Terraform modules and Terragrunt files
	terraform fmt -recursive infra/modules
	cd infra/live && terragrunt hcl fmt

.PHONY: tf-fmt-check
tf-fmt-check: ## Check formatting without changing files (CI does this)
	terraform fmt -check -recursive -diff infra/modules
	cd infra/live && terragrunt hcl fmt --check

.PHONY: tf-validate
tf-validate: ## terraform validate every module (no cloud credentials needed)
	@mkdir -p .tools/tf-plugin-cache; export TF_PLUGIN_CACHE_DIR=$(CURDIR)/.tools/tf-plugin-cache; for m in infra/modules/*/; do echo "→ $$m"; \
	  (cd $$m && terraform init -backend=false -input=false >/dev/null && terraform validate -no-color) || exit 1; done

.PHONY: tf-bootstrap
tf-bootstrap: tf-env-check ## First apply from your laptop: creates state bucket + everything (CLOUD=gcp|aws)
	cd $(TG_DIR) && terragrunt run --all --backend-bootstrap -- apply

.PHONY: tf-plan
tf-plan: tf-env-check ## Plan (CLOUD=gcp|aws [ENV=dev|uat|prod | UNIT=shared/wif])
	cd $(TG_DIR) && terragrunt run --all -- plan

.PHONY: tf-apply
tf-apply: tf-env-check ## Apply (CLOUD=... [ENV=... | UNIT=...]); normally CI applies on merge
	cd $(TG_DIR) && terragrunt run --all -- apply

.PHONY: tf-output
tf-output: tf-env-check ## Show outputs (UNIT=shared/wif or shared/oidc for the GitHub variables)
	cd $(TG_DIR) && terragrunt run --all -- output

.PHONY: tf-destroy
tf-destroy: tf-env-check ## Destroy (asks for confirmation). e.g. make tf-destroy CLOUD=aws ENV=uat
	@read -r -p "Destroy everything under $(TG_DIR)? Type the path to confirm: " ans; [[ "$$ans" == "$(TG_DIR)" ]] || { echo "aborted"; exit 1; }
	cd $(TG_DIR) && terragrunt run --all -- destroy

.PHONY: aws-pause
aws-pause: ## Save money: destroy aws-uat (keeps prod and shared). Recreate with make tf-apply CLOUD=aws ENV=uat
	@$(MAKE) tf-destroy CLOUD=aws ENV=uat

##@ Releases (GitHub Actions via gh)

.PHONY: promote-uat
promote-uat: ## Promote what's in gcp-dev to gcp-uat + aws-uat
	gh workflow run promote.yml -f target=uat && sleep 3 && gh run watch "$$(gh run list --workflow promote.yml --limit 1 --json databaseId -q '.[0].databaseId')"

.PHONY: promote-prod
promote-prod: ## Promote what's in UAT to prod (waits for the production approval)
	gh workflow run promote.yml -f target=prod && sleep 3 && gh run watch "$$(gh run list --workflow promote.yml --limit 1 --json databaseId -q '.[0].databaseId')"

.PHONY: rollback
rollback: ## Roll back an environment: make rollback CLOUD=gcp ENV=prod
	@[[ -n "$(ENV)" ]] || { echo "usage: make rollback CLOUD=gcp|aws ENV=dev|uat|prod"; exit 1; }
	gh workflow run rollback.yml -f cloud=$(CLOUD) -f environment=$(ENV)

.PHONY: demo
demo: ## Run the Scenario A demo workflow on gcp-dev: make demo MODE=legacy-order|guarded|recover
	@[[ -n "$(MODE)" ]] || { echo "usage: make demo MODE=legacy-order|guarded|recover"; exit 1; }
	gh workflow run demo-scenario-a.yml -f mode=$(MODE)

.PHONY: status
status: ## Recent release / promote / infra runs
	@for w in release.yml promote.yml infra-apply.yml; do echo "── $$w"; gh run list --workflow $$w --limit 3; done

##@ Housekeeping

.PHONY: clean
clean: ## Remove build outputs and caches (keeps node_modules and tools)
	rm -rf apps/*/dist packages/*/dist apps/web/.next .turbo apps/*/.turbo packages/*/.turbo .rendered
	find infra -type d -name .terragrunt-cache -prune -exec rm -rf {} +

.PHONY: nuke
nuke: clean ## clean + remove node_modules, .tools and the local database volume
	rm -rf node_modules apps/*/node_modules packages/*/node_modules .tools
	$(COMPOSE) down -v
