<#
  Step 2: Google Cloud setup (run via "2-gcp-setup.cmd").
  - Signs you in to gcloud (opens your browser twice: CLI login + application-default login)
  - Creates the Rehearse project (or reuses the one in bootstrap\settings.env) and links billing
  - Saves GCP_PROJECT_ID / GCP_REGION as user environment variables for later steps
  - Runs the first Terragrunt apply for GCP (creates the state bucket, enables APIs,
    Workload Identity Federation, Artifact Registry, secrets and the Cloud Run service shells)
  Re-running is safe: every step checks what already exists.
#>
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
. "$PSScriptRoot\lib.ps1"

$env:PATH = "$(Join-Path (Split-Path $PSScriptRoot -Parent) '.tools\bin');$env:PATH"
Require-Command gcloud 'Run 1-install-tools.cmd first, then open a NEW window.'
$settings = Read-Settings
$region = if ($settings.GCP_REGION) { $settings.GCP_REGION } else { 'us-east1' }

Step 'Signing in to Google Cloud (a browser window will open)'
$account = Capture { gcloud auth list --filter=status:ACTIVE --format='value(account)' }
if (-not $account) { Native { gcloud auth login --brief } ; $account = Capture { gcloud auth list --filter=status:ACTIVE --format='value(account)' } }
Write-Host "  signed in as $account"

Step 'Choosing the project'
$project = $settings.GCP_PROJECT_ID
if (-not $project) {
    $suffix = -join ((48..57) + (97..122) | Get-Random -Count 6 | ForEach-Object { [char]$_ })
    $project = "rehearse-$suffix"
}
$exists = Capture { gcloud projects describe $project --format='value(projectId)' }
if (-not $exists) {
    Write-Host "  creating project $project"
    Native { gcloud projects create $project --name 'Rehearse' }
} else { Write-Host "  using existing project $project" }
Save-Setting 'GCP_PROJECT_ID' $project
Save-Setting 'GCP_REGION' $region

Step 'Linking billing'
$linked = Capture { gcloud billing projects describe $project --format='value(billingEnabled)' }
if ($linked -ne 'True') {
    $accounts = @(& gcloud billing accounts list --filter='open=true' --format='value(name,displayName)' | Where-Object { $_ })
    if ($accounts.Count -eq 0) { throw 'No open billing account. Create one at https://console.cloud.google.com/billing, then re-run this step.' }
    if ($accounts.Count -eq 1) { $choice = 0 } else {
        for ($i = 0; $i -lt $accounts.Count; $i++) { Write-Host "  [$i] $($accounts[$i])" }
        $choice = [int](Read-Host '  Which billing account should Rehearse use? Enter the number')
    }
    $billingId = ($accounts[$choice] -split '\s+')[0] -replace '^billingAccounts/', ''
    Native { gcloud billing projects link $project --billing-account $billingId }
} else { Write-Host '  billing already linked' }

Step 'Application-default credentials for Terraform (a browser window will open)'
$adc = Join-Path $env:APPDATA 'gcloud\application_default_credentials.json'
if (-not (Test-Path $adc)) { Native { gcloud auth application-default login } }
Native { gcloud config set project $project }
Native { gcloud auth application-default set-quota-project $project }

$env:GCP_PROJECT_ID = $project; $env:GCP_REGION = $region

Step 'First Terragrunt apply for GCP'
Write-Host "  This creates, in project ${project}:"
Write-Host '    - a state bucket, enabled APIs, Workload Identity Federation for GitHub Actions'
Write-Host '    - an Artifact Registry repo, Secret Manager secrets (empty) and 6 Cloud Run service shells'
Write-Host '  All of it costs nothing at idle.'
Confirm-Step 'Go ahead?'
Require-Command terragrunt 'Run 1-install-tools.cmd first.'
$env:PATH = "$(Join-Path (Split-Path $PSScriptRoot -Parent) '.tools\bin');$env:PATH"
Push-Location infra/live/gcp
try { Native { terragrunt run --all --non-interactive --backend-bootstrap -- apply } } finally { Pop-Location }

Step 'Outputs for GitHub (saved to bootstrap\outputs\gcp-wif.txt)'
New-Item -ItemType Directory -Force -Path "$PSScriptRoot\outputs" | Out-Null
& "$PSScriptRoot\..\make.ps1" tf-output -Cloud gcp -Unit shared/wif | Tee-Object "$PSScriptRoot\outputs\gcp-wif.txt"
Done "GCP is set up in project $project."
