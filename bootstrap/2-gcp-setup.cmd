@echo off
rem Step 2: Google Cloud sign-in, project + billing, first Terragrunt apply.
rem Output: bootstrap\logs\2-gcp-setup.log
cd /d "%~dp0.."
if not exist "%~dp0logs" mkdir "%~dp0logs"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Transcript -Path '%~dp0logs\2-gcp-setup.log' -Force | Out-Null; try { & '%~dp0gcp-setup.ps1' } catch { Write-Host ('ERROR: ' + $_.Exception.Message) -ForegroundColor Red } finally { Stop-Transcript | Out-Null }"
pause
