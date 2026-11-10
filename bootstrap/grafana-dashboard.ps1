<#
  Step 6: load the Rehearse dashboard into Grafana Cloud (run via "6-grafana-dashboard.cmd").
  Asks for your Grafana Cloud URL (remembered in settings.env) and a service account
  token (hidden, never stored), then runs scripts/grafana-import.mjs against it: the
  dashboard plus the "Rehearse API 5xx ratio" alert rule (needs an Admin token).
  Optionally stores a token in GitHub so deploys and demos add markers to the dashboard.
  Re-run any time deploy/grafana/ changes.
#>
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
. "$PSScriptRoot\lib.ps1"
Require-Command node 'Install Node.js (step 1 installs it).'
$settings = Read-Settings

Step 'Grafana Cloud stack'
$url = $settings.GRAFANA_URL
if ($url) { Write-Host "  using $url (from settings.env)" }
else {
    $url = (Read-Host '  Your stack URL, e.g. https://yourstack.grafana.net').Trim().TrimEnd('/')
    if ($url -notmatch '^https://') { throw 'The URL must start with https://' }
    Save-Setting 'GRAFANA_URL' $url
}

Step 'Service account token'
Write-Host '  In Grafana: Administration > Users and access > Service accounts > Add service account'
Write-Host '  (role Admin: needed for the alert rule and the home dashboard; Editor imports only the dashboard)'
Write-Host '  > Add service account token.'
$secure = Read-Host -AsSecureString '  Token (hidden)'
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }

Step 'Importing dashboards'
Use-ProcessEnv @{ GRAFANA_URL = $url; GRAFANA_TOKEN = $token } { Native { node scripts/grafana-import.mjs } }
Step 'Deploy markers from GitHub Actions (optional)'
Write-Host '  Deploys and the Scenario A demo can draw markers on the dashboard. That needs a token'
Write-Host '  stored as a GitHub secret: create a second service account token with the Editor role'
Write-Host '  (do not reuse the Admin one), or press Enter to skip.'
$secure = Read-Host -AsSecureString '  Editor token for GitHub (hidden, Enter to skip)'
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $annotationToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
if ($annotationToken) {
    $env:PATH = "$(Join-Path (Split-Path $PSScriptRoot -Parent) '.tools\bin');$env:PATH"
    Require-Command gh 'Run 1-install-tools.cmd first, then open a NEW window.'
    $repo = (& gh repo view --json nameWithOwner -q .nameWithOwner | Out-String).Trim()
    Native { gh variable set GRAFANA_URL --repo $repo --body $url }
    Native { gh secret set GRAFANA_ANNOTATION_TOKEN --repo $repo --body $annotationToken }
    Write-Host "  GRAFANA_URL variable and GRAFANA_ANNOTATION_TOKEN secret set on $repo"
} else { Write-Host '  skipped' }

Done "Open $url/d/rehearse-overview (alert rules: $url/alerting/list)"
