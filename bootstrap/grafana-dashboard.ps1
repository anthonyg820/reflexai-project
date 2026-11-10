<#
  Step 6: load the Rehearse dashboard into Grafana Cloud (run via "6-grafana-dashboard.cmd").
  Asks for your Grafana Cloud URL (remembered in settings.env) and a service account
  token (hidden, never stored), then runs scripts/grafana-import.mjs against it.
  Re-run any time deploy/grafana/rehearse-overview.json changes.
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
Write-Host '  (role Editor, or Admin to also make Rehearse the home dashboard) > Add service account token.'
$secure = Read-Host -AsSecureString '  Token (hidden)'
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }

Step 'Importing dashboards'
Use-ProcessEnv @{ GRAFANA_URL = $url; GRAFANA_TOKEN = $token } { Native { node scripts/grafana-import.mjs } }
Done "Open $url/d/rehearse-overview"
