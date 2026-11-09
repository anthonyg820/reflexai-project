@echo off
rem Step 5: GitHub repository variables and deployment environments.
rem Output: bootstrap\logs\5-github-setup.log
cd /d "%~dp0.."
if not exist "%~dp0logs" mkdir "%~dp0logs"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Transcript -Path '%~dp0logs\5-github-setup.log' -Force | Out-Null; try { & '%~dp0github-setup.ps1' } catch { Write-Host ('ERROR: ' + $_.Exception.Message) -ForegroundColor Red } finally { Stop-Transcript | Out-Null }"
pause
