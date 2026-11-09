# Shared helpers for the bootstrap scripts.
$SettingsFile = Join-Path $PSScriptRoot 'settings.env'

function Step([string] $Text) { Write-Host ''; Write-Host "==> $Text" -ForegroundColor Cyan }
function Done([string] $Text) { Write-Host ''; Write-Host "DONE: $Text" -ForegroundColor Green }

function Require-Command([string] $Name, [string] $Hint) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) { throw "$Name not found. $Hint" }
}

function Native([scriptblock] $Command) {
    # Run a native command; native tools print progress on stderr, so judge by exit code.
    $previous = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    try { & $Command } finally { $ErrorActionPreference = $previous }
    if ($LASTEXITCODE -ne 0) { throw "Command failed (exit $LASTEXITCODE): $Command" }
}

function Read-Settings {
    $s = @{}
    if (Test-Path $SettingsFile) {
        foreach ($line in Get-Content $SettingsFile) {
            if ($line -match '^\s*([A-Z_]+)\s*=\s*(.*)\s*$') { $s[$Matches[1]] = $Matches[2] }
        }
    }
    return $s
}

function Save-Setting([string] $Key, [string] $Value) {
    $s = Read-Settings; $s[$Key] = $Value
    $lines = @('# Written by the bootstrap scripts. Not secret, but specific to your accounts (git-ignored).')
    foreach ($k in ($s.Keys | Sort-Object)) { $lines += "$k=$($s[$k])" }
    Set-Content -Path $SettingsFile -Value $lines -Encoding ascii
}
