import html
from pathlib import Path

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, RedirectResponse, Response

from app.auth import COOKIE_NAME, auth_enabled, create_session_token, verify_session_token
from app.config import APP_NAME, APP_TAGLINE, ROOT

STATIC_DIR = ROOT / "app" / "static"
LOGIN_TEMPLATE = STATIC_DIR / "login.html"


def render_login(next_path: str = "/", error: str = "") -> str:
    tpl = LOGIN_TEMPLATE.read_text(encoding="utf-8")
    error_block = ""
    if error:
        error_block = f'<p class="auth-error" role="alert">{html.escape(error)}</p>'
    return (
        tpl.replace("{{APP_NAME}}", html.escape(APP_NAME))
        .replace("{{APP_TAGLINE}}", html.escape(APP_TAGLINE))
        .replace("{{NEXT}}", html.escape(next_path or "/"))
        .replace("{{ERROR_BLOCK}}", error_block)
    )


def _is_public(path: str) -> bool:
    if path.startswith("/static/"):
        return True
    return path in ("/login", "/api/health")


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if not auth_enabled() or _is_public(request.url.path):
            return await call_next(request)

        session = verify_session_token(request.cookies.get(COOKIE_NAME))
        if session:
            request.state.user = session.get("u")
            return await call_next(request)

        if request.url.path.startswith("/api/"):
            return JSONResponse({"detail": "未登录，请先登录"}, status_code=401)

        if request.url.path == "/login":
            return await call_next(request)

        nxt = request.url.path
        if request.url.query:
            nxt = f"{nxt}?{request.url.query}"
        return RedirectResponse(url=f"/login?next={nxt}", status_code=303)


def set_session_cookie(response: Response, username: str) -> None:
    response.set_cookie(
        COOKIE_NAME,
        create_session_token(username),
        httponly=True,
        samesite="lax",
        max_age=14 * 86400,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")
