#!/bin/bash
# Kai-san Chat — Mac/Linux launcher
cd "$(dirname "$0")"

# Kill existing
pkill -f "node server.js" 2>/dev/null
sleep 1

# Install deps if needed
[ -d node_modules ] || npm install

# Start
node server.js
