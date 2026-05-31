#!/bin/bash
# Start backend and frontend in the background, stream logs to terminal
# Usage: ./start-dev.sh
# Stop with Ctrl+C

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

cleanup() {
    echo "Shutting down..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}
trap cleanup SIGINT SIGTERM

echo "Starting backend..."
cd "$SCRIPT_DIR/backend"
source .venv/bin/activate
python3 run.py 2>&1 | sed 's/^/[backend] /' &
BACKEND_PID=$!

echo "Starting frontend..."
cd "$SCRIPT_DIR/frontend"
npm run dev 2>&1 | sed 's/^/[frontend] /' &
FRONTEND_PID=$!

echo "Both started. Press Ctrl+C to stop."
wait $BACKEND_PID $FRONTEND_PID
