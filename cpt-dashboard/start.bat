@echo off
cd /d "%~dp0"
python -m pip install -r requirements.txt -q
set PYTHONPATH=.
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8787
pause
