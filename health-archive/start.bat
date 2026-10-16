@echo off
chcp 65001 >nul
cd /d "%~dp0"

where python >nul 2>&1
if errorlevel 1 (
  echo 未找到 Python。请先安装 Python 3.11+ 并勾选 Add to PATH。
  echo https://www.python.org/downloads/
  pause
  exit /b 1
)

if not exist .env copy .env.example .env

echo 安装依赖...
python -m pip install -r requirements.txt
if errorlevel 1 (
  echo pip 安装失败
  pause
  exit /b 1
)

echo.
echo 浏览器打开: http://127.0.0.1:8765/login
echo 账号 admin   密码 vitaring
echo.
python -m app.main
pause
