@echo off
rem Step 1: install Terraform, Terragrunt, crane, actionlint, shellcheck (into .tools\bin)
rem and the gcloud, aws and gh CLIs (with winget). Output: bootstrap\logs\1-install-tools.log
cd /d "%~dp0.."
if not exist "%~dp0logs" mkdir "%~dp0logs"
powershell -NoProfile -ExecutionPolicy Bypass -Command "& '.\make.ps1' install-tools -All 2>&1 | Tee-Object -FilePath '%~dp0logs\1-install-tools.log'"
echo.
echo Finished. Close this window. (New CLIs are on PATH in windows opened from now on.)
pause
