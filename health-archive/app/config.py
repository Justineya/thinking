import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

DATA_DIR = ROOT / "data"
RECORDS_DIR = DATA_DIR / "records"
DB_PATH = DATA_DIR / "health.db"

LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")

HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "8765"))

# 登录（留空 APP_PASSWORD 则本地免登录）
APP_USERNAME = os.getenv("APP_USERNAME", "admin")
APP_PASSWORD = os.getenv("APP_PASSWORD", "")
SECRET_KEY = os.getenv("SECRET_KEY") or "change-me-in-production"

# 产品名（界面显示）
APP_NAME = os.getenv("APP_NAME", "VitaRing")
APP_TAGLINE = os.getenv(
    "APP_TAGLINE", "个人健康全景 · 随手记症状 · AI 读你自己的时间线"
)
