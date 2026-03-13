#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONTEND="$ROOT/frontend"

# Install dependencies if node_modules is missing or package-lock.json changed
if [ ! -d "$FRONTEND/node_modules" ]; then
  echo "node_modules not found — running npm install..."
  cd "$FRONTEND" && npm install
fi

cd "$FRONTEND"
echo "Starting frontend at http://localhost:3000"
npm run dev
