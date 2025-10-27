@echo off
REM Batch script to start both backend and frontend in Windows Terminal tabs
REM Usage: start-dev.bat

where wt >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Starting backend and frontend in Windows Terminal tabs...
    wt -w 0 new-tab --title "Backend" -d "%~dp0backend" cmd /k "venv\Scripts\activate.bat && python run.py" ; new-tab --title "Frontend" -d "%~dp0frontend" cmd /k "npm run dev"
) else (
    echo Windows Terminal not found. Starting in separate windows...
    start "Backend" cmd /k "cd /d %~dp0backend && venv\Scripts\activate.bat && python run.py"
    start "Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"
)
