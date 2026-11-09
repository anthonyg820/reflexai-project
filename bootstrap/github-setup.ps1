<#
  Step 5: GitHub settings (run via "5-github-setup.cmd").
  - Signs in to gh (browser) if needed
  - Sets the repository variables the workflows read (from Terraform outputs + settings.env)
  - Creates the deployment environments: gcp-dev, gcp-uat, gcp-prod, aws-uat, aws-prod
    (main branch only) and "production" with you as required reviewer
#>
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
. "$PSScriptRoot\lib.ps1"
$env:PATH = "$(Join-Path (Split-Path $PSScriptRoot -Parent) '.tools\bin');$env:PATH"
Require-Command gh 'Run 1-install-tools.cmd first, then open a NEW window.'
$settings = Read-Settings
foreach ($k in 'GCP_PROJECT_ID', 'GCP_REGION', 'GRAFANA_OTLP_ENDPOINT', 'GRAFANA_OTLP_INSTANCE_ID') {
    if (-not $settings[$k]) { throw "$k missing from bootstrap\settings.env: run steps 2-4 first." }
}
$env:GCP_PROJECT_ID = $settings.GCP_PROJECT_ID
$aws = $settings.AWS_READY -eq 'true'
if ($aws) { $env:AWS_ACCOUNT_ID = $settings.AWS_ACCOUNT_ID }
else { Write-Host '  AWS not set up yet: configuring GCP only. Re-run this step after step 3; the workflows add AWS automatically.' -ForegroundColor Yellow }

Step 'Signing in to GitHub'
Capture { gh auth status } | Out-Null; $ok = $LASTEXITCODE -eq 0
if (-not $ok) { & gh auth login --web --git-protocol https }
$repo = (& gh repo view --json nameWithOwner -q .nameWithOwner | Out-String).Trim()
Write-Host "  repository $repo"

function TgOutput([string] $Dir, [string] $Name) {
    Push-Location $Dir
    try { return (& terragrunt output -raw $Name | Out-String).Trim() } finally { Pop-Location }
}

Step 'Reading Terraform outputs'
$vars = [ordered]@{
    GCP_PROJECT_ID           = $settings.GCP_PROJECT_ID
    GCP_REGION               = $settings.GCP_REGION
    GCP_WIF_PROVIDER         = TgOutput 'infra/live/gcp/shared/wif' 'workload_identity_provider'
    GCP_DEPLOYER_SA          = TgOutput 'infra/live/gcp/shared/wif' 'deployer_service_account'
    GCP_TERRAFORM_SA         = TgOutput 'infra/live/gcp/shared/wif' 'terraform_service_account'
    GRAFANA_OTLP_ENDPOINT    = $settings.GRAFANA_OTLP_ENDPOINT
    GRAFANA_OTLP_INSTANCE_ID = $settings.GRAFANA_OTLP_INSTANCE_ID
}

if ($aws) {
    $vars['AWS_ACCOUNT_ID'] = $settings.AWS_ACCOUNT_ID
    $vars['AWS_REGION'] = $settings.AWS_REGION
    $vars['AWS_DEPLOYER_ROLE_ARN'] = TgOutput 'infra/live/aws/shared/oidc' 'deployer_role_arn'
    $vars['AWS_TERRAFORM_ROLE_ARN'] = TgOutput 'infra/live/aws/shared/oidc' 'terraform_role_arn'
}

Step 'Setting repository variables'
foreach ($k in $vars.Keys) {
    if (-not $vars[$k]) { throw "No value for $k" }
    Native { gh variable set $k --repo $repo --body $vars[$k] }
    Write-Host "  $k"
}

function Put-Environment([string] $Name, [hashtable] $Body) {
    $json = ($Body | ConvertTo-Json -Depth 5 -Compress)
    $json | & gh api -X PUT "repos/$repo/environments/$Name" --input - | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "could not create environment $Name" }
    Capture { gh api -X POST "repos/$repo/environments/$Name/deployment-branch-policies" -f name=main } | Out-Null
    Write-Host "  $Name"
}

Step 'Creating deployment environments'
$branchPolicy = @{ protected_branches = $false; custom_branch_policies = $true }
$envNames = @('gcp-dev', 'gcp-uat', 'gcp-prod'); if ($aws) { $envNames += 'aws-uat', 'aws-prod' }
foreach ($name in $envNames) {
    Put-Environment $name @{ deployment_branch_policy = $branchPolicy }
}
$me = (& gh api user -q .id | Out-String).Trim()
try {
    Put-Environment 'production' @{
        deployment_branch_policy = $branchPolicy
        prevent_self_review      = $false
        reviewers                = @(@{ type = 'User'; id = [long]$me })
    }
} catch {
    Write-Warning 'Could not add a required reviewer to "production". Private repos need a paid GitHub plan for this; making the repo public enables it for free.'
    Put-Environment 'production' @{ deployment_branch_policy = $branchPolicy }
}
Done "GitHub is configured. Push to main (or re-run the Release workflow) to deploy gcp-dev."
