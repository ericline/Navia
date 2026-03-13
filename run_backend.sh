#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Activate virtual environment
if [ -f "$ROOT/backend/.venv/bin/activate" ]; then
  VENV="$ROOT/backend/.venv"
elif [ -f "$ROOT/.venv/bin/activate" ]; then
  VENV="$ROOT/.venv"
else
  echo "ERROR: Virtual environment not found."
  echo "Run: cd backend && python3.11 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
  exit 1
fi

source "$VENV/bin/activate"

cd "$ROOT/backend"
echo "Starting backend at http://127.0.0.1:8000"
uvicorn main:app --reload --port 8000
