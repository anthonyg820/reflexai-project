@echo off
rem Step 3: AWS credentials, first Terragrunt apply.
rem Output: bootstrap\logs\3-aws-setup.log
cd /d "%~dp0.."
if not exist "%~dp0logs" mkdir "%~dp0logs"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Transcript -Path '%~dp0logs\3-aws-setup.log' -Force | Out-Null; try { & '%~dp0aws-setup.ps1' } catch { Write-Host ('ERROR: ' + $_.Exception.Message) -ForegroundColor Red } finally { Stop-Transcript | Out-Null }"
pause
