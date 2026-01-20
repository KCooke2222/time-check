#!/bin/bash
# Bash script to start both backend and frontend
# Usage: ./start-dev.sh

echo "Starting backend and frontend..."

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Start backend in new terminal
gnome-terminal -- bash -c "cd '$SCRIPT_DIR/backend'; source venv/bin/activate; python run.py; exec bash" &

# Wait a second then start frontend
sleep 1
gnome-terminal -- bash -c "cd '$SCRIPT_DIR/frontend'; npm run dev; exec bash" &

echo "Backend and frontend started in separate terminals."
