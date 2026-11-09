@echo off
rem Double-click to run Rehearse with hot reload: Postgres + Grafana in Docker, web + api on this machine.
rem Close this window to stop.
cd /d "%~dp0"
call "%~dp0make.cmd" setup
if errorlevel 1 (
  pause
  exit /b 1
)
start "" cmd /c "timeout /t 40 /nobreak >nul & start http://localhost:3000"
call "%~dp0make.cmd" dev
pause
