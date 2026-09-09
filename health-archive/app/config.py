import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")


def _env(name: str, default: str = "") -> str:
    raw = os.getenv(name, default)
    if raw is None:
        return default
    value = str(raw).strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        value = value[1:-1].strip()
    return value


DATA_DIR = ROOT / "data"
RECORDS_DIR = DATA_DIR / "records"
DB_PATH = DATA_DIR / "health.db"

LLM_API_KEY = _env("LLM_API_KEY")
LLM_BASE_URL = _env("LLM_BASE_URL", "https://api.openai.com/v1")
LLM_MODEL = _env("LLM_MODEL", "gpt-4o-mini")

HOST = _env("HOST", "127.0.0.1")
PORT = int(_env("PORT", "8765") or "8765")

APP_USERNAME = _env("APP_USERNAME", "admin") or "admin"
# 空密码会当成默认 vitaring，保证登录页能出来。不想登录时设 AUTH_DISABLED=1
APP_PASSWORD = _env("APP_PASSWORD") or "vitaring"
AUTH_DISABLED = _env("AUTH_DISABLED").lower() in {"1", "true", "yes"}
SECRET_KEY = _env("SECRET_KEY") or "change-me-in-production"

APP_NAME = _env("APP_NAME", "VitaRing") or "VitaRing"
APP_TAGLINE = _env(
    "APP_TAGLINE",
    "个人健康全景 · 随手记症状 · AI 读你自己的时间线",
)
