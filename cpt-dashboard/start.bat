@echo off
cd /d %~dp0
python -m pip install -r requirements.txt -q
set PYTHONPATH=.
if exist .env (
  for /f "usebackq tokens=* delims=" %%a in (".env") do set %%a
)
python -m uvicorn app.main:app --host 127.0.0.1 --port 8787
pause
