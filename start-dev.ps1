# PowerShell script to start both backend and frontend in Windows Terminal tabs
# Usage: .\start-dev.ps1

# Check if Windows Terminal is available
$wtInstalled = Get-Command wt -ErrorAction SilentlyContinue

if ($wtInstalled) {
    Write-Host "Starting backend and frontend in Windows Terminal tabs..."

    # Start Windows Terminal with two tabs
    wt -w 0 new-tab --title "Backend" -d "$PSScriptRoot\backend" pwsh -NoExit -Command ".\venv\Scripts\Activate.ps1; python run.py" `; new-tab --title "Frontend" -d "$PSScriptRoot\frontend" pwsh -NoExit -Command "npm run dev"
} else {
    Write-Host "Windows Terminal not found. Starting in separate windows..."

    # Fallback: start in separate PowerShell windows
    Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; .\venv\Scripts\Activate.ps1; python run.py"
    Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev"
}
