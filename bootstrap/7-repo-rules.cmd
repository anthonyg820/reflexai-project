@echo off
rem Step 7: repository rules for the Scenario B review policy (rulesets, auto-merge).
rem Output: bootstrap\logs\7-repo-rules.log
cd /d "%~dp0.."
if not exist "%~dp0logs" mkdir "%~dp0logs"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Transcript -Path '%~dp0logs\7-repo-rules.log' -Force | Out-Null; try { & '%~dp0repo-rules.ps1' } catch { Write-Host ('ERROR: ' + $_.Exception.Message) -ForegroundColor Red } finally { Stop-Transcript | Out-Null }"
pause
