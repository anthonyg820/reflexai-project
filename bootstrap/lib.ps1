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

function Capture([scriptblock] $Command) {
    # Run a native command for its output only. Stderr is discarded and never fatal:
    # Windows PowerShell 5.1 turns redirected stderr into terminating errors otherwise.
    $previous = $ErrorActionPreference; $ErrorActionPreference = 'SilentlyContinue'
    try { return ((& $Command 2>$null) | Out-String).Trim() } catch { return '' } finally { $ErrorActionPreference = $previous }
}

function Confirm-Step([string] $Question) {
    # Ask until we get a clear answer. A stray Enter (e.g. left over from 'aws configure') re-asks instead of aborting.
    try { $Host.UI.RawUI.FlushInputBuffer() } catch { }  # drop keys pressed while earlier steps ran
    while ($true) {
        $answer = (Read-Host "  $Question (y/n)").Trim().ToLower()
        if ($answer -in 'y', 'yes') { return }
        if ($answer -in 'n', 'no') { throw 'Stopped before applying. Re-run this step when ready.' }
        Write-Host '  Please type y or n.'
    }
}

function Use-ProcessEnv([hashtable] $Vars, [scriptblock] $Block) {
    # Set environment variables for this process only, run the block, then remove them.
    foreach ($k in $Vars.Keys) { [Environment]::SetEnvironmentVariable($k, $Vars[$k], 'Process') }
    try { & $Block } finally { foreach ($k in $Vars.Keys) { [Environment]::SetEnvironmentVariable($k, $null, 'Process') } }
}
