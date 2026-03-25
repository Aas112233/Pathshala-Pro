@echo off
setlocal enabledelayedexpansion

set PORT=3001

echo Checking for processes using port %PORT%...
:: Find and kill any process using port 3001
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :%PORT% ^| findstr LISTENING') do (
    set PID=%%a
    echo Killing process tree with PID !PID! using port %PORT%...
    taskkill /F /T /PID !PID! >nul 2>&1
    if errorlevel 1 (
        echo Failed to kill process !PID!
    ) else (
        echo Process !PID! killed successfully
    )
)

echo Checking for existing Node.js processes related to this project...
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*Pathshala-Pro*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; Write-Host \"Killed Node.js process: $($_.ProcessId)\" }"

echo Starting Next.js dev server on port %PORT%...
set PORT=%PORT%
npm run dev
