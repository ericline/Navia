#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Activate virtual environment
if [ -f "$ROOT/backend/.venv/Scripts/activate" ]; then
  VENV="$ROOT/backend/.venv"
  source "$VENV/Scripts/activate"
elif [ -f "$ROOT/backend/.venv/bin/activate" ]; then
  VENV="$ROOT/backend/.venv"
  source "$VENV/bin/activate"
elif [ -f "$ROOT/.venv/Scripts/activate" ]; then
  VENV="$ROOT/.venv"
  source "$VENV/Scripts/activate"
elif [ -f "$ROOT/.venv/bin/activate" ]; then
  VENV="$ROOT/.venv"
  source "$VENV/bin/activate"
else
  echo "ERROR: Virtual environment not found."
  echo "Run: cd backend && python -m venv .venv && .venv/Scripts/activate && pip install -r requirements.txt"
  exit 1
fi

cd "$ROOT/backend"
pip install -q -r requirements.txt
echo "Starting backend at http://127.0.0.1:8000"
uvicorn main:app --reload --port 8000
