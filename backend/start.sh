#!/bin/bash
set -e

echo "Starting Deja Backend Services..."

# Start the Python FastAPI bridge in the background
echo "Starting Memory Bridge (Port 8000)..."
python3 memory_bridge.py &
PYTHON_PID=$!

# Wait a second for it to initialize
sleep 2

# Start the Node Express Gateway in the foreground
echo "Starting Gateway Engine (Port ${PORT:-5051})..."
node server.js &
NODE_PID=$!

# Wait for any process to exit
wait -n

# Exit with status of process that exited first
exit $?
