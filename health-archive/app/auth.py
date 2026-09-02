import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Any

from app.config import APP_PASSWORD, APP_USERNAME, SECRET_KEY

COOKIE_NAME = "vitaring_session"
SESSION_DAYS = 14


def auth_enabled() -> bool:
    return bool(APP_PASSWORD)


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
    user_ok = username.strip().lower() == APP_USERNAME.lower()
    pass_ok = secrets.compare_digest(password, APP_PASSWORD)
    return user_ok and pass_ok
