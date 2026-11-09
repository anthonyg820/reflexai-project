@echo off
rem Double-click to run Rehearse locally in Docker and open it in your browser.
rem Output is also written to start-local.log.
cd /d "%~dp0"
echo Starting Rehearse (first run builds the images; this can take a few minutes)...
echo Output: %~dp0start-local.log
call "%~dp0make.cmd" up > "%~dp0start-local.log" 2>&1
set RC=%ERRORLEVEL%
type "%~dp0start-local.log"
if not "%RC%"=="0" (
  echo.
  echo Startup failed. Is Docker Desktop running?
  pause
  exit /b 1
)
start "" http://localhost:3000
start "" http://localhost:3001
echo.
echo Rehearse is running. Stop it with: make down
pause
