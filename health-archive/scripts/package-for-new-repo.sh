#!/usr/bin/env bash
# Copy this project to a new directory, ready for git init.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEST="${1:-}"

if [[ -z "$DEST" ]]; then
  echo "Usage: $0 <destination-directory>"
  echo "Example: $0 ~/projects/health-log"
  exit 1
fi

mkdir -p "$DEST"

rsync -av --delete \
  --exclude '.venv/' \
  --exclude 'data/health.db' \
  --exclude 'data/records/*' \
  --exclude '.env' \
  --exclude '__pycache__/' \
  --exclude '*.pyc' \
  --exclude '.git/' \
  "$ROOT/" "$DEST/"

# Ensure empty data dirs exist
mkdir -p "$DEST/data/records"
touch "$DEST/data/records/.gitkeep"

echo ""
echo "Packaged to: $DEST"
echo "Next:"
echo "  cd $DEST"
echo "  cp .env.example .env   # add LLM_API_KEY"
echo "  bash scripts/setup.sh"
echo "  git init && git add . && git commit -m 'Initial commit'"
