#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
python3 -m pip install -q -r requirements.txt
[[ -f .env ]] || cp .env.example .env
echo "打开 http://127.0.0.1:8765/login"
echo "账号 admin  密码 vitaring"
python3 -m app.main
