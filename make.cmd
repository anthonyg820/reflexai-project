@echo off
rem Windows entry point: "make <command> [options]" runs make.ps1 (PowerShell 7 if installed, else Windows PowerShell).
rem Bypasses the execution policy for this one script only.
where pwsh >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0make.ps1" %*
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0make.ps1" %*
)
exit /b %ERRORLEVEL%
