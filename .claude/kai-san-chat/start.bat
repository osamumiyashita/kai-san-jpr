@echo off
cd /d "%~dp0"
:: If ksc is already running, just opens browser (safe for Claude PTY sessions)
:: Use --force to kill existing instance and restart fresh
if "%1"=="--force" (
  echo Force restart: killing existing ksc...
  for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":10001 " ^| findstr LISTENING') do (
    taskkill /F /PID %%p >nul 2>&1
  )
  timeout /t 2 /nobreak >nul
)
node server.js %*
pause
