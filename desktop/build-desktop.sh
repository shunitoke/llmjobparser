#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Building Linux desktop binary (includes frontend build)..."

if [[ ! -d backend/.venv ]]; then
  python3 -m venv backend/.venv
fi

# shellcheck disable=SC1091
source backend/.venv/bin/activate

pip install -U pip
pip install -r backend/requirements.txt
pip install -r desktop/requirements.txt

python desktop/build.py

echo "Build complete: desktop/dist/vibejob"
ls -lh desktop/dist/vibejob
file desktop/dist/vibejob
