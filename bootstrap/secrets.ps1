<#
  Step 4: secret values (run via "4-secrets.cmd").
  Prompts for each value (input is hidden) and stores it directly in GCP Secret
  Manager and AWS SSM Parameter Store. Values never touch disk, git or Terraform state.
  Also records the non-secret Grafana OTLP endpoint and instance ID for the GitHub step.
#>
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
. "$PSScriptRoot\lib.ps1"
$settings = Read-Settings
if (-not $settings.GCP_PROJECT_ID) { throw 'GCP_PROJECT_ID missing: run step 2 first.' }
$project = $settings.GCP_PROJECT_ID; $region = $settings.AWS_REGION
# AWS is optional until step 3 has completed (AWS_READY=true in settings.env).
$aws = $settings.AWS_READY -eq 'true'
if (-not $aws) { Write-Host '  AWS not set up yet: storing GCP secrets only. Re-run this step after step 3.' -ForegroundColor Yellow }

function Read-Secret([string] $Prompt) {
    $secure = Read-Host -AsSecureString $Prompt
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

function Set-GcpSecret([string] $Id, [string] $Value) {
    $tmp = New-TemporaryFile
    try {
        [IO.File]::WriteAllText($tmp, $Value)  # no trailing newline
        Native { gcloud secrets versions add $Id --project $project --data-file $tmp | Out-Null }
    } finally { Remove-Item $tmp -Force }
    Write-Host "  stored $Id (GCP)"
}

function Set-AwsParam([string] $Name, [string] $Value) {
    Native { aws ssm put-parameter --region $region --name $Name --type SecureString --overwrite --value $Value | Out-Null }
    Write-Host "  stored $Name (AWS)"
}

Step 'Grafana Cloud (Connections > OpenTelemetry (OTLP) in your Grafana Cloud portal)'
$endpoint = Read-Host '  OTLP endpoint (e.g. https://otlp-gateway-prod-us-east-0.grafana.net/otlp)'
$instance = Read-Host '  Instance ID (a number)'
Save-Setting 'GRAFANA_OTLP_ENDPOINT' $endpoint.Trim()
Save-Setting 'GRAFANA_OTLP_INSTANCE_ID' $instance.Trim()
$token = Read-Secret '  API token (hidden)'
foreach ($e in 'dev', 'uat', 'prod') { Set-GcpSecret "rehearse-$e-grafana-otlp-token" $token }
if ($aws) { foreach ($e in 'uat', 'prod') { Set-AwsParam "/rehearse/$e/grafana-otlp-token" $token } }

Step 'Neon connection strings (one branch per environment; use the DIRECT URL, not the pooled one: migrations take a Postgres advisory lock, which pooling breaks)'
foreach ($e in 'dev', 'uat', 'prod') { Set-GcpSecret "rehearse-$e-database-url" (Read-Secret "  gcp-$e DATABASE_URL (hidden)") }
if ($aws) { foreach ($e in 'uat', 'prod') { Set-AwsParam "/rehearse/$e/database-url" (Read-Secret "  aws-$e DATABASE_URL (hidden)") } }
Done 'All secrets stored.'
