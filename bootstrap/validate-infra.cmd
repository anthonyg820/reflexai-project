@echo off
rem Formats Terraform/Terragrunt files, then runs terraform validate on every module, and logs to bootstrap\logs\validate-infra.log
cd /d "%~dp0.."
if not exist "%~dp0logs" mkdir "%~dp0logs"
powershell -NoProfile -ExecutionPolicy Bypass -Command "& '.\make.ps1' tf-fmt *>&1; & '.\make.ps1' tf-validate *>&1 | Tee-Object -FilePath '%~dp0logs\validate-infra.log'"
pause
