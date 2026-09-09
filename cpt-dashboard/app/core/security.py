from __future__ import annotations

import hashlib
import hmac
import secrets

from app.core.config import get_settings


def hash_password(password: str) -> str:
    """PBKDF2-SHA256 hash. Format: pbkdf2_sha256$iterations$salt$hexdigest"""
    iterations = 200_000
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        iterations,
    ).hex()
    return f"pbkdf2_sha256${iterations}${salt}${digest}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algo, iters_s, salt, digest = password_hash.split("$", 3)
        if algo != "pbkdf2_sha256":
            return False
        iterations = int(iters_s)
        check = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            iterations,
        ).hex()
        return hmac.compare_digest(check, digest)
    except Exception:  # noqa: BLE001
        return False


def session_secret() -> str:
    return get_settings().session_secret
