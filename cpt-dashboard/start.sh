#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
python3 -m pip install -r requirements.txt -q
export PYTHONPATH=.
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi
# Requires PostgreSQL. Example:
# DATABASE_URL=postgresql+asyncpg://cpt:cpt@127.0.0.1:5432/cpt
python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8787
