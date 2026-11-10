@echo off
rem Step 6: load the Rehearse dashboard into Grafana Cloud (token input hidden; not logged).
rem Output: bootstrap\logs\6-grafana-dashboard.log
cd /d "%~dp0.."
if not exist "%~dp0logs" mkdir "%~dp0logs"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Transcript -Path '%~dp0logs\6-grafana-dashboard.log' -Force | Out-Null; try { & '%~dp0grafana-dashboard.ps1' } catch { Write-Host ('ERROR: ' + $_.Exception.Message) -ForegroundColor Red } finally { Stop-Transcript | Out-Null }"
pause
