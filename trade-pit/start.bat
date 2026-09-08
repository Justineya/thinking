@echo off
cd /d "%~dp0"
python -m pip install -r requirements.txt -q
python -m app.main
pause
