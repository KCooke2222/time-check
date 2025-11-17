# PowerShell script to start both backend and frontend
# Usage: .\start-dev.ps1

Write-Host "Starting backend and frontend..."

# Start backend in new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; .\venv\Scripts\Activate.ps1; python run.py"

# Wait a second then start frontend
Start-Sleep -Seconds 1
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev"

Write-Host "Backend and frontend started in separate windows."
