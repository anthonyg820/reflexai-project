<#
.SYNOPSIS
  Rehearse developer commands for Windows: the PowerShell equivalent of the Makefile.

.DESCRIPTION
  Run with no arguments (or "help") to list commands. Works in Windows PowerShell 5.1
  and PowerShell 7+. From cmd.exe or PowerShell you can also use the make.cmd wrapper:
      .\make setup
      .\make tf-plan -Cloud aws -Env uat

  If scripts are blocked by execution policy, make.cmd bypasses it for this file only,
  or run:  powershell -ExecutionPolicy Bypass -File .\make.ps1 <command>

.EXAMPLE
  .\make.ps1 setup
.EXAMPLE
  .\make.ps1 up
.EXAMPLE
  .\make.ps1 tf-plan -Cloud gcp -Unit shared/wif
.EXAMPLE
  .\make.ps1 rollback -Cloud gcp -Env prod
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string] $Target = 'help',

    [ValidateSet('gcp', 'aws')]
    [string] $Cloud = 'gcp',

    [Alias('Env')]
    [ValidateSet('', 'dev', 'uat', 'prod')]
    [string] $Environment = '',

    # Terragrunt unit path under infra/live/<cloud>, e.g. shared/wif
    [string] $Unit = '',

    # Docker Compose service for "logs"
    [string] $Service = '',

    # Scenario A demo mode for "demo"
    [ValidateSet('', 'legacy-order', 'guarded', 'recover')]
    [string] $Mode = '',

    # install-tools: also install Node, Docker Desktop, gh, gcloud and aws CLIs with winget
    [switch] $All
)

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

# ---- Pinned tool versions (CI uses the same Terraform/Terragrunt pins) -------
$TerraformVersion  = '1.13.4'
$TerragruntVersion = '0.99.5'
$ActionlintVersion = '1.7.7'
$ShellcheckVersion = '0.10.0'
$CraneVersion      = '0.21.7'
$NodeMajor         = [int](Get-Content (Join-Path $PSScriptRoot '.nvmrc') -Raw).Trim()

# Repo-local tool dir, so nothing is installed system-wide.
$ToolsDir = Join-Path $PSScriptRoot '.tools\bin'
if (-not (($env:PATH -split ';') -contains $ToolsDir)) { $env:PATH = "$ToolsDir;$env:PATH" }

$LocalDb     = 'postgres://postgres:rehearse@localhost:55432/rehearse'
$LocalTestDb = 'postgres://postgres:rehearse@localhost:55432/rehearse_test'

# Account settings written by the bootstrap scripts (GCP_PROJECT_ID, AWS_ACCOUNT_ID, ...).
# Values already set in the environment win.
$settingsFile = Join-Path $PSScriptRoot 'bootstrap\settings.env'
if (Test-Path $settingsFile) {
    foreach ($line in Get-Content $settingsFile) {
        if ($line -match '^\s*([A-Z_]+)\s*=\s*(.*?)\s*$' -and -not [Environment]::GetEnvironmentVariable($Matches[1])) {
            [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], 'Process')
        }
    }
}

$env:TURBO_TELEMETRY_DISABLED = '1'
$env:NEXT_TELEMETRY_DISABLED  = '1'

# ---- Helpers ----------------------------------------------------------------

function Exec {
    # Run a native command and fail if it exits non-zero.
    param([Parameter(Mandatory)] [scriptblock] $Command)
    # Native tools (docker, pnpm) write progress to stderr. When output is redirected,
    # Windows PowerShell turns those lines into errors, so judge success by exit code only.
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { & $Command 2>&1 | ForEach-Object { if ($_ -is [System.Management.Automation.ErrorRecord]) { $_.Exception.Message } else { $_ } } }
    finally { $ErrorActionPreference = $previous }
    if ($LASTEXITCODE -ne 0) { throw "Command failed with exit code ${LASTEXITCODE}: $Command" }
}

function Test-Command([string] $Name) {
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Write-Step([string] $Text) { Write-Host $Text -ForegroundColor Cyan }
function Write-Ok([string] $Text) { Write-Host $Text -ForegroundColor Green }

function Use-Env {
    # Run a block with extra environment variables, then restore them.
    param([hashtable] $Vars, [scriptblock] $Block)
    $saved = @{}
    foreach ($k in $Vars.Keys) {
        $saved[$k] = [Environment]::GetEnvironmentVariable($k, 'Process')
        [Environment]::SetEnvironmentVariable($k, [string]$Vars[$k], 'Process')
    }
    try { & $Block }
    finally {
        foreach ($k in $saved.Keys) { [Environment]::SetEnvironmentVariable($k, $saved[$k], 'Process') }
    }
}

function Get-HttpStatus([string] $Url, [hashtable] $Headers = @{}) {
    try {
        return [int](Invoke-WebRequest -Uri $Url -Headers $Headers -UseBasicParsing -TimeoutSec 5).StatusCode
    }
    catch {
        if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode }
        return 0
    }
}

function Save-Download([string] $Url, [string] $OutFile) {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $ProgressPreference = 'SilentlyContinue' # makes Invoke-WebRequest much faster on 5.1
    Invoke-WebRequest -Uri $Url -OutFile $OutFile -UseBasicParsing
}

function Get-TgDir {
    $dir = "infra/live/$Cloud"
    if ($Unit) { $dir = "$dir/$Unit" } elseif ($Environment) { $dir = "$dir/$Environment" }
    return $dir
}

function Assert-TfEnv {
    if (-not (Test-Command 'terragrunt')) { throw "terragrunt not found: run .\make install-tools" }
    if ($Cloud -eq 'gcp' -and -not $env:GCP_PROJECT_ID) { throw 'Set $env:GCP_PROJECT_ID (and optionally $env:GCP_REGION) first' }
    if ($Cloud -eq 'aws' -and -not $env:AWS_ACCOUNT_ID) { throw 'Set $env:AWS_ACCOUNT_ID (and optionally $env:AWS_REGION) first' }
    $dir = Get-TgDir
    if (-not (Test-Path $dir)) { throw "No such Terragrunt dir: $dir" }
    Write-Step "-> $dir"
    return $dir
}

function Invoke-Terragrunt([string[]] $TgArgs) {
    $dir = Assert-TfEnv
    Push-Location $dir
    # Called directly (not through Exec) so Terragrunt's y/n prompts reach the console.
    try {
        & terragrunt @TgArgs
        if ($LASTEXITCODE -ne 0) { throw "terragrunt exited with code $LASTEXITCODE" }
    }
    finally { Pop-Location }
}

function Assert-Node {
    if (-not (Test-Command 'node')) { throw "Node $NodeMajor is required: winget install OpenJS.NodeJS.LTS (or nvm-windows)" }
    $major = [int](& node -p "process.versions.node.split('.')[0]")
    if ($major -lt $NodeMajor) { throw "Node >= $NodeMajor required (found $(& node --version))" }
    if (-not (Test-Command 'docker')) { Write-Warning "docker not found; 'up' and 'dev' need Docker Desktop" }
}

function Install-Tool([string] $Name, [scriptblock] $Installer) {
    $exe = Join-Path $ToolsDir "$Name.exe"
    if (Test-Path $exe) { Write-Host "  $Name already installed"; return }
    Write-Host "  installing $Name"
    $tmp = Join-Path ([IO.Path]::GetTempPath()) ("rehearse-" + [guid]::NewGuid())
    New-Item -ItemType Directory -Path $tmp | Out-Null
    # One failed download shouldn't stop the rest (or the winget installs).
    try { & $Installer $tmp $exe }
    catch { Write-Warning "could not install ${Name}: $($_.Exception.Message)" }
    finally { Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue }
}

function Invoke-Pnpm([string[]] $PnpmArgs) { Exec { & pnpm @PnpmArgs } }

function Initialize-TestDb {
    Exec { docker compose up -d --wait postgres }
    $exists = (& docker compose exec -T postgres psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'rehearse_test'" | Out-String).Trim()
    if ($exists -ne '1') { Exec { docker compose exec -T postgres psql -U postgres -c "CREATE DATABASE rehearse_test" } | Out-Null }
}

function Watch-LatestRun([string] $Workflow) {
    Start-Sleep -Seconds 3
    $id = (& gh run list --workflow $Workflow --limit 1 --json databaseId -q '.[0].databaseId' | Out-String).Trim()
    Exec { gh run watch $id }
}

# ---- Commands ---------------------------------------------------------------
# Ordered so "help" prints them grouped, in the same order as the Makefile.

$Commands = [ordered]@{}
function Add-Command([string] $Name, [string] $Group, [string] $Description, [scriptblock] $Action) {
    $Commands[$Name] = [pscustomobject]@{ Group = $Group; Description = $Description; Action = $Action }
}

# Getting started
Add-Command 'help' 'Getting started' 'Show this help' {
    Write-Host ''
    Write-Host 'Usage: .\make <command> [-Cloud gcp|aws] [-Env dev|uat|prod] [-Unit path] [-Service name] [-Mode mode]'
    $group = ''
    foreach ($name in $Commands.Keys) {
        $c = $Commands[$name]
        if ($c.Group -ne $group) { $group = $c.Group; Write-Host ''; Write-Host $group -ForegroundColor White }
        Write-Host ('  {0,-18}' -f $name) -ForegroundColor Cyan -NoNewline
        Write-Host " $($c.Description)"
    }
    Write-Host ''
}

Add-Command 'setup' 'Getting started' 'One-time local setup: pnpm, dependencies, .env files, shared packages' {
    Assert-Node
    $ErrorActionPreference = 'Continue' # Windows PowerShell treats redirected stderr as errors
    & corepack enable 2>$null
    $ErrorActionPreference = 'Stop'
    if ($LASTEXITCODE -ne 0) { Write-Warning "'corepack enable' failed (it may need an admin shell). If pnpm is missing: npm install -g pnpm" }
    Invoke-Pnpm @('install', '--frozen-lockfile')
    foreach ($f in @('apps/api/.env', 'apps/web/.env')) {
        if (-not (Test-Path $f)) { Copy-Item "$f.example" $f; Write-Host "created $f" }
    }
    Invoke-Pnpm @('turbo', 'run', 'build', '--filter=./packages/*')
    Write-Host ''
    Write-Ok "Ready.  Next: '.\make up' (everything in Docker) or '.\make dev' (hot reload)."
}

Add-Command 'doctor' 'Getting started' 'Check which tools are installed (required and optional)' {
    function Check([string] $Name, [string[]] $VersionArgs, [string] $Hint) {
        if (Test-Command $Name) {
            $ErrorActionPreference = 'Continue'
            $v = (& $Name @VersionArgs 2>&1 | Select-Object -First 1 | Out-String).Trim()
            Write-Host '  [ok] ' -ForegroundColor Green -NoNewline; Write-Host ('{0,-11} {1}' -f $Name, $v)
        }
        else {
            Write-Host '  [--] ' -ForegroundColor Red -NoNewline; Write-Host ('{0,-11} {1}' -f $Name, $Hint)
        }
    }
    Write-Host 'Required for local development:'
    Check 'node'   @('--version') "winget install OpenJS.NodeJS.LTS  (need Node $NodeMajor+)"
    Check 'pnpm'   @('--version') 'corepack enable   (or: npm install -g pnpm)'
    Check 'docker' @('--version') 'winget install Docker.DockerDesktop'
    Write-Host 'Infrastructure and release (.\make install-tools):'
    Check 'terraform'  @('version')   '.\make install-tools'
    Check 'terragrunt' @('--version') '.\make install-tools'
    Check 'crane'      @('version')   '.\make install-tools'
    Check 'actionlint' @('--version') '.\make install-tools'
    Check 'shellcheck' @('--version') '.\make install-tools'
    Write-Host 'Cloud CLIs (.\make install-tools -All installs these with winget):'
    Check 'gcloud' @('--version') 'winget install Google.CloudSDK'
    Check 'aws'    @('--version') 'winget install Amazon.AWSCLI'
    Check 'gh'     @('--version') 'winget install GitHub.cli   (needed for promote/rollback)'
}

# Prerequisite binaries
Add-Command 'install-tools' 'Prerequisite binaries' 'Install pinned terraform, terragrunt, crane, actionlint, shellcheck into .tools\bin (-All: also winget installs)' {
    New-Item -ItemType Directory -Force -Path $ToolsDir | Out-Null

    Install-Tool 'terraform' {
        param($tmp, $exe)
        Save-Download "https://releases.hashicorp.com/terraform/$TerraformVersion/terraform_${TerraformVersion}_windows_amd64.zip" "$tmp\tf.zip"
        Expand-Archive "$tmp\tf.zip" -DestinationPath $tmp -Force
        Move-Item "$tmp\terraform.exe" $exe
    }
    Install-Tool 'terragrunt' {
        param($tmp, $exe)
        Save-Download "https://github.com/gruntwork-io/terragrunt/releases/download/v$TerragruntVersion/terragrunt_windows_amd64.exe" $exe
    }
    Install-Tool 'actionlint' {
        param($tmp, $exe)
        Save-Download "https://github.com/rhysd/actionlint/releases/download/v$ActionlintVersion/actionlint_${ActionlintVersion}_windows_amd64.zip" "$tmp\al.zip"
        Expand-Archive "$tmp\al.zip" -DestinationPath $tmp -Force
        Move-Item "$tmp\actionlint.exe" $exe
    }
    Install-Tool 'shellcheck' {
        param($tmp, $exe)
        Save-Download "https://github.com/koalaman/shellcheck/releases/download/v$ShellcheckVersion/shellcheck-v$ShellcheckVersion.zip" "$tmp\sc.zip"
        Expand-Archive "$tmp\sc.zip" -DestinationPath $tmp -Force
        Get-ChildItem $tmp -Recurse -Filter 'shellcheck.exe' | Select-Object -First 1 | Move-Item -Destination $exe
    }
    Install-Tool 'crane' {
        param($tmp, $exe)
        Save-Download "https://github.com/google/go-containerregistry/releases/download/v$CraneVersion/go-containerregistry_Windows_x86_64.tar.gz" "$tmp\crane.tgz"
        Exec { tar -xzf "$tmp\crane.tgz" -C $tmp crane.exe }
        Move-Item "$tmp\crane.exe" $exe
    }

    if ($All) {
        if (-not (Test-Command 'winget')) { throw 'winget not found (install "App Installer" from the Microsoft Store)' }
        $pkgs = [ordered]@{ node = 'OpenJS.NodeJS.LTS'; docker = 'Docker.DockerDesktop'; gh = 'GitHub.cli'; gcloud = 'Google.CloudSDK'; aws = 'Amazon.AWSCLI' }
        foreach ($cmd in $pkgs.Keys) {
            if (Test-Command $cmd) { Write-Host "  $cmd already installed"; continue }
            Write-Host "  winget install $($pkgs[$cmd])"
            & winget install --id $pkgs[$cmd] -e --accept-source-agreements --accept-package-agreements
        }
        Write-Warning 'Open a new terminal so newly installed CLIs are on PATH.'
    }

    Write-Host ''
    Write-Host 'Installed into .tools\bin (this script adds it to PATH automatically).'
    Write-Host "To use them in your own shell:  `$env:PATH = `"$ToolsDir;`$env:PATH`""
    if (-not $All) {
        foreach ($cmd in @('gcloud', 'aws', 'gh')) {
            if (-not (Test-Command $cmd)) { Write-Host "$cmd not found: run '.\make install-tools -All' or see '.\make doctor'" }
        }
    }
}

# Run locally
Add-Command 'up' 'Run locally' 'Run the full stack in Docker: web :3000, api :8080, Grafana :3001' {
    # Build one image at a time: parallel Next.js + Nest builds can exhaust Docker's memory (exit 137).
    Exec { docker compose build api }
    Exec { docker compose build web }
    Exec { docker compose up -d }
    Exec { node scripts/grafana-import.mjs }
    Write-Host ''
    Write-Host '  web      http://localhost:3000'
    Write-Host '  api      http://localhost:8080/healthz'
    Write-Host '  grafana  http://localhost:3001  (admin / admin)'
}
Add-Command 'down' 'Run locally' 'Stop the Docker stack (keeps the database volume)' { Exec { docker compose down } }
Add-Command 'logs' 'Run locally' 'Follow logs from the Docker stack (-Service api to filter)' {
    if ($Service) { Exec { docker compose logs -f $Service } } else { Exec { docker compose logs -f } }
}
Add-Command 'ps' 'Run locally' 'Show Docker stack status' { Exec { docker compose ps } }
Add-Command 'deps-up' 'Run locally' "Start only Postgres + Grafana LGTM (for 'dev')" {
    Exec { docker compose up -d --wait postgres lgtm }
    Exec { node scripts/grafana-import.mjs }
}
Add-Command 'dev' 'Run locally' 'Hot-reload web + api on your machine against Dockerized Postgres + Grafana' {
    if (-not (Test-Path 'apps/api/.env')) { throw "Run '.\make setup' first" }
    & $Commands['deps-up'].Action
    Invoke-Pnpm @('dev')
}
Add-Command 'grafana-import' 'Run locally' '(Re)load the Rehearse dashboard into local Grafana and make it the home page' {
    Exec { node scripts/grafana-import.mjs }
}
Add-Command 'open' 'Run locally' 'Open the web app and Grafana in your browser' {
    Start-Process 'http://localhost:3000'
    Start-Process 'http://localhost:3001'
}

# Quality
Add-Command 'check' 'Quality (what CI runs)' 'Everything CI checks before a merge' {
    foreach ($c in @('lint', 'typecheck', 'test', 'validate-config', 'lint-workflows', 'lint-shell')) {
        Write-Step "== $c"
        & $Commands[$c].Action
    }
    Write-Ok 'All checks passed.'
}
Add-Command 'build' 'Quality (what CI runs)' 'Build all packages and apps' { Invoke-Pnpm @('turbo', 'run', 'build') }
Add-Command 'lint' 'Quality (what CI runs)' 'ESLint across the monorepo' { Invoke-Pnpm @('turbo', 'run', 'lint') }
Add-Command 'typecheck' 'Quality (what CI runs)' 'TypeScript type checks' { Invoke-Pnpm @('turbo', 'run', 'typecheck') }
Add-Command 'test' 'Quality (what CI runs)' 'Unit + API e2e tests (uses the Dockerized Postgres)' {
    Initialize-TestDb
    Use-Env @{ DATABASE_URL_TEST = $LocalTestDb } { Invoke-Pnpm @('turbo', 'run', 'test') }
}
Add-Command 'test-unit' 'Quality (what CI runs)' 'Unit tests only (no database needed)' { Invoke-Pnpm @('turbo', 'run', 'test') }
Add-Command 'validate-config' 'Quality (what CI runs)' "Validate deploy/config/* against this commit's config schema" {
    Invoke-Pnpm @('--filter', '@rehearse/config', 'build') | Out-Null
    Invoke-Pnpm @('validate:config')
}
Add-Command 'lint-workflows' 'Quality (what CI runs)' 'Lint GitHub Actions workflows' {
    if (-not (Test-Command 'actionlint')) { throw "actionlint not found: run '.\make install-tools'" }
    Exec { actionlint }
}
Add-Command 'lint-shell' 'Quality (what CI runs)' 'Lint release shell scripts' {
    if (-not (Test-Command 'shellcheck')) { throw "shellcheck not found: run '.\make install-tools'" }
    $scripts = (Get-ChildItem deploy/scripts -Filter *.sh | ForEach-Object { "deploy/scripts/$($_.Name)" })
    Exec { shellcheck -x -P deploy/scripts @scripts }
}
Add-Command 'render' 'Quality (what CI runs)' 'Render every release spec with dummy digests into .rendered\ (to inspect what would ship)' {
    Invoke-Pnpm @('--filter', '@rehearse/config', 'build') | Out-Null
    New-Item -ItemType Directory -Force -Path '.rendered' | Out-Null
    $digest = 'sha256:' + ('0' * 64)
    $ErrorActionPreference = 'Continue'
    $version = (& git rev-parse --verify -q HEAD 2>$null | Out-String).Trim()
    $ErrorActionPreference = 'Stop'
    if (-not $version) { $version = 'local' }
    foreach ($ce in @('gcp:dev', 'gcp:uat', 'gcp:prod', 'aws:uat', 'aws:prod')) {
        $c, $e = $ce -split ':'
        foreach ($s in @('api', 'web')) {
            $ext = if ($c -eq 'gcp') { 'yaml' } else { 'json' }
            Exec {
                node scripts/render-release.mjs --cloud $c --env $e --service $s `
                    --image "registry/$s@$digest" --collector-image "registry/collector@$digest" --version $version `
                    --project demo-project --account-id 000000000000 --region us-east-1 --api-url https://api.example `
                    --grafana-endpoint https://otlp.example --grafana-instance-id 1 --out ".rendered/$c-$e-$s.$ext"
            }
        }
    }
}

# Database
Add-Command 'db-shell' 'Database (local)' 'psql into the local database' {
    & docker compose exec postgres psql -U postgres -d rehearse # interactive: no output capture
}
Add-Command 'db-reset' 'Database (local)' 'Drop and recreate the local database (migrations + seed run on next api start)' {
    Exec { docker compose exec -T postgres psql -U postgres -c "DROP DATABASE IF EXISTS rehearse WITH (FORCE)" -c "CREATE DATABASE rehearse" }
    Write-Host "Database reset. Restart the api ('.\make up', or re-run '.\make dev') to migrate and seed."
}

# Scenario A
Add-Command 'scenario-a' 'Scenario A, locally' 'Show both behaviours locally: lazy config -> 500s, startup validation -> refuses to start' {
    & $Commands['deps-up'].Action
    Invoke-Pnpm @('turbo', 'run', 'build', '--filter=@rehearse/api...') | Out-Null
    $base = @{ DEPLOY_ENV = 'local'; CLOUD_PROVIDER = 'local'; DATABASE_URL = $LocalDb; OTEL_SDK_DISABLED = 'true'; PORT = '8099'; SCORING_RUBRIC = 'rubric-c' }
    $tenant = @{ 'x-tenant-id' = 'acme-crisis-line' }
    $log = Join-Path ([IO.Path]::GetTempPath()) 'rehearse-scenario-a.log'

    Write-Host ''
    Write-Host '1) Legacy behaviour: new config, old code, lazy validation' -ForegroundColor White
    $lazy = $base.Clone(); $lazy['CONFIG_VALIDATION'] = 'lazy'; $lazy['MIGRATE_ON_START'] = 'true'
    $proc = Use-Env $lazy {
        Start-Process -FilePath 'node' -ArgumentList '--require', './dist/otel.js', 'dist/main.js' `
            -WorkingDirectory (Join-Path $PSScriptRoot 'apps/api') -NoNewWindow -PassThru -RedirectStandardOutput $log -RedirectStandardError "$log.err"
    }
    try {
        for ($i = 0; $i -lt 20; $i++) { if ((Get-HttpStatus 'http://localhost:8099/healthz') -eq 200) { break }; Start-Sleep -Milliseconds 500 }
        Write-Host "   /healthz       -> $(Get-HttpStatus 'http://localhost:8099/healthz') (looks healthy, so it gets traffic)"
        Write-Host "   /api/stats     -> $(Get-HttpStatus 'http://localhost:8099/api/stats' $tenant) (every tenant gets server errors)"
    }
    finally { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }

    Write-Host ''
    Write-Host '2) The fix: same config, startup validation' -ForegroundColor White
    Push-Location apps/api
    try {
        Use-Env $base {
            $ErrorActionPreference = 'Continue' # node writes the fatal config error to stderr
            & node --require ./dist/otel.js dist/main.js 2>&1 | ForEach-Object { "   $_" }
        }
        if ($LASTEXITCODE -ne 0) { Write-Host '   -> process exits before listening: the startup probe fails and the old revision keeps serving' }
    }
    finally { Pop-Location }

    Write-Host ''
    Write-Host '3) And CI would have caught it first:' -ForegroundColor White
    Write-Host '   pnpm validate:config / render-release.mjs reject unknown rubrics for this commit.'
}

# Infrastructure
Add-Command 'tf-fmt' 'Infrastructure (Terraform + Terragrunt)' 'Format Terraform modules and Terragrunt files' {
    Exec { terraform fmt -recursive infra/modules }
    Push-Location infra/live; try { Exec { terragrunt hcl fmt } } finally { Pop-Location }
}
Add-Command 'tf-fmt-check' 'Infrastructure (Terraform + Terragrunt)' 'Check formatting without changing files (CI does this)' {
    Exec { terraform fmt -check -recursive -diff infra/modules }
    Push-Location infra/live; try { Exec { terragrunt hcl fmt --check } } finally { Pop-Location }
}
Add-Command 'tf-validate' 'Infrastructure (Terraform + Terragrunt)' 'terraform validate every module (no cloud credentials needed)' {
    # Share provider downloads between modules (otherwise ~150 MB per module).
    $env:TF_PLUGIN_CACHE_DIR = Join-Path $PSScriptRoot '.tools\tf-plugin-cache'
    New-Item -ItemType Directory -Force -Path $env:TF_PLUGIN_CACHE_DIR | Out-Null
    foreach ($m in Get-ChildItem infra/modules -Directory) {
        Write-Step "-> infra/modules/$($m.Name)"
        Push-Location $m.FullName
        try {
            Exec { terraform init -backend=false -input=false } | Out-Null
            Exec { terraform validate -no-color }
        }
        finally { Pop-Location }
    }
}
Add-Command 'tf-bootstrap' 'Infrastructure (Terraform + Terragrunt)' 'First apply from your laptop: creates state bucket + everything (-Cloud gcp|aws)' {
    Invoke-Terragrunt @('run', '--all', '--backend-bootstrap', '--', 'apply')
}
Add-Command 'tf-plan' 'Infrastructure (Terraform + Terragrunt)' 'Plan (-Cloud gcp|aws [-Env dev|uat|prod | -Unit shared/wif])' {
    Invoke-Terragrunt @('run', '--all', '--', 'plan')
}
Add-Command 'tf-apply' 'Infrastructure (Terraform + Terragrunt)' 'Apply (-Cloud ... [-Env ... | -Unit ...]); normally CI applies on merge' {
    Invoke-Terragrunt @('run', '--all', '--', 'apply')
}
Add-Command 'tf-output' 'Infrastructure (Terraform + Terragrunt)' 'Show outputs (-Unit shared/wif or shared/oidc for the GitHub variables)' {
    Invoke-Terragrunt @('run', '--all', '--', 'output')
}
Add-Command 'tf-destroy' 'Infrastructure (Terraform + Terragrunt)' 'Destroy (asks for confirmation), e.g. -Cloud aws -Env uat' {
    $dir = Get-TgDir
    $answer = Read-Host "Destroy everything under $dir? Type the path to confirm"
    if ($answer -ne $dir) { throw 'Aborted' }
    Invoke-Terragrunt @('run', '--all', '--', 'destroy')
}
Add-Command 'aws-pause' 'Infrastructure (Terraform + Terragrunt)' "Save money: destroy aws-uat (keeps prod and shared). Recreate with: tf-apply -Cloud aws -Env uat" {
    $script:Cloud = 'aws'; $script:Environment = 'uat'; $script:Unit = ''
    & $Commands['tf-destroy'].Action
}

# Releases
Add-Command 'promote-uat' 'Releases (GitHub Actions via gh)' "Promote what's in gcp-dev to gcp-uat + aws-uat" {
    Exec { gh workflow run promote.yml -f target=uat }
    Watch-LatestRun 'promote.yml'
}
Add-Command 'promote-prod' 'Releases (GitHub Actions via gh)' "Promote what's in UAT to prod (waits for the production approval)" {
    Exec { gh workflow run promote.yml -f target=prod }
    Watch-LatestRun 'promote.yml'
}
Add-Command 'rollback' 'Releases (GitHub Actions via gh)' 'Roll back an environment: rollback -Cloud gcp -Env prod' {
    if (-not $Environment) { throw 'Usage: .\make rollback -Cloud gcp|aws -Env dev|uat|prod' }
    Exec { gh workflow run rollback.yml -f "cloud=$Cloud" -f "environment=$Environment" }
}
Add-Command 'demo' 'Releases (GitHub Actions via gh)' 'Run the Scenario A demo workflow on gcp-dev: demo -Mode legacy-order|guarded|recover' {
    if (-not $Mode) { throw 'Usage: .\make demo -Mode legacy-order|guarded|recover' }
    Exec { gh workflow run demo-scenario-a.yml -f "mode=$Mode" }
}
Add-Command 'status' 'Releases (GitHub Actions via gh)' 'Recent release / promote / infra runs' {
    foreach ($w in @('release.yml', 'promote.yml', 'infra-apply.yml')) {
        Write-Step "-- $w"
        Exec { gh run list --workflow $w --limit 3 }
    }
}

# Housekeeping
Add-Command 'clean' 'Housekeeping' 'Remove build outputs and caches (keeps node_modules and tools)' {
    $paths = @('apps/api/dist', 'apps/web/.next', '.turbo', '.rendered') +
        (Get-ChildItem packages -Directory | ForEach-Object { "packages/$($_.Name)/dist"; "packages/$($_.Name)/.turbo" }) +
        @('apps/api/.turbo', 'apps/web/.turbo')
    foreach ($p in $paths) { if (Test-Path $p) { Remove-Item $p -Recurse -Force } }
    Get-ChildItem infra -Directory -Recurse -Force -Filter '.terragrunt-cache' -ErrorAction SilentlyContinue |
        ForEach-Object { Remove-Item $_.FullName -Recurse -Force }
}
Add-Command 'nuke' 'Housekeeping' 'clean + remove node_modules, .tools and the local database volume' {
    & $Commands['clean'].Action
    foreach ($p in @('node_modules', '.tools') + (Get-ChildItem apps, packages -Directory | ForEach-Object { Join-Path $_.FullName 'node_modules' })) {
        if (Test-Path $p) { Remove-Item $p -Recurse -Force }
    }
    Exec { docker compose down -v }
}

# ---- Dispatch ---------------------------------------------------------------
if (-not $Commands.Contains($Target)) {
    Write-Host "Unknown command '$Target'." -ForegroundColor Red
    & $Commands['help'].Action
    exit 1
}
try {
    & $Commands[$Target].Action
}
catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
