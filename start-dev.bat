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

echo Cleaning up old Node.js ghost processes...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM next-router-worker.exe >nul 2>&1

echo Starting Next.js dev server on port %PORT%...
set PORT=%PORT%
set NODE_OPTIONS=--max_old_space_size=4096
npm run dev
