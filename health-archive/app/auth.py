import base64
import hashlib
import hmac
import json
import time
from typing import Any

from app.config import APP_PASSWORD, APP_USERNAME, AUTH_DISABLED, SECRET_KEY

COOKIE_NAME = "vitaring_session"
SESSION_DAYS = 14


def auth_enabled() -> bool:
    return not AUTH_DISABLED


def _sign(data: str) -> str:
    return hmac.new(SECRET_KEY.encode(), data.encode(), hashlib.sha256).hexdigest()


def create_session_token(username: str) -> str:
    payload = {
        "u": username,
        "exp": int(time.time()) + SESSION_DAYS * 86400,
    }
    data = base64.urlsafe_b64encode(
        json.dumps(payload, separators=(",", ":")).encode()
    ).decode()
    return f"{data}.{_sign(data)}"


def verify_session_token(token: str | None) -> dict[str, Any] | None:
    if not token or "." not in token:
        return None
    data, sig = token.rsplit(".", 1)
    if not hmac.compare_digest(_sign(data), sig):
        return None
    try:
        payload = json.loads(base64.urlsafe_b64decode(data.encode()))
    except (json.JSONDecodeError, ValueError):
        return None
    if payload.get("exp", 0) < time.time():
        return None
    return payload


def verify_credentials(username: str, password: str) -> bool:
    if not auth_enabled():
        return True
    user_ok = hmac.compare_digest(
        username.strip().lower().encode(),
        APP_USERNAME.strip().lower().encode(),
    )
    expected = APP_PASSWORD.encode()
    given = password.encode()
    # compare_digest 要求等长，先哈希避免长度不同时报错或直接失败
    pass_ok = hmac.compare_digest(
        hashlib.sha256(given).digest(),
        hashlib.sha256(expected).digest(),
    )
    return bool(user_ok and pass_ok)
