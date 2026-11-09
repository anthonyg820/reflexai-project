@echo off
rem Step 4: store Neon + Grafana secrets in GCP Secret Manager and AWS SSM (input hidden; not logged).
rem Output: bootstrap\logs\4-secrets.log
cd /d "%~dp0.."
if not exist "%~dp0logs" mkdir "%~dp0logs"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Transcript -Path '%~dp0logs\4-secrets.log' -Force | Out-Null; try { & '%~dp0secrets.ps1' } catch { Write-Host ('ERROR: ' + $_.Exception.Message) -ForegroundColor Red } finally { Stop-Transcript | Out-Null }"
pause
