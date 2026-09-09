from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from app.api.routes.auth import router as auth_router
from app.api.routes.cycle import router as cycle_router
from app.api.routes.futu import router as futu_router
from app.api.routes.portfolio import router as portfolio_router
from app.core.config import get_settings
from app.core.database import SessionLocal, engine, ensure_schema
from app.models import Base
from app.services.market import LEVERAGE_MAP, fetch_daily_bars
from app.services.seed import seed_if_empty
from app.api.routes.decision import router as decision_router

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"

PUBLIC_PATHS = {
    "/login",
    "/api/auth/login",
    "/api/health",
    "/health",
    "/docs",
    "/openapi.json",
    "/redoc",
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await ensure_schema()
    if get_settings().seed_on_startup:
        async with SessionLocal() as db:
            await seed_if_empty(db)
    yield
    await engine.dispose()


app = FastAPI(title="CPT Dashboard API", version="2.0.0", lifespan=lifespan, docs_url="/docs")


@app.middleware("http")
async def auth_gate(request: Request, call_next):
    # Runs inside SessionMiddleware (registered later = outer).
    path = request.url.path
    if path in PUBLIC_PATHS or path.startswith("/static") or path.startswith("/api/auth/"):
        return await call_next(request)

    logged_in = bool(request.session.get("user"))
    if not logged_in:
        if path.startswith("/api/"):
            return JSONResponse({"detail": "未登录"}, status_code=401)
        if path == "/" or path.endswith(".html"):
            return RedirectResponse("/login", status_code=302)
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Outermost so session is available to auth_gate
app.add_middleware(
    SessionMiddleware,
    secret_key=get_settings().session_secret,
    session_cookie="cpt_session",
    same_site="lax",
    https_only=False,
    max_age=60 * 60 * 24 * 14,
)

app.include_router(auth_router, prefix="/api")
app.include_router(portfolio_router, prefix="/api")
app.include_router(cycle_router, prefix="/api")
app.include_router(futu_router, prefix="/api")
app.include_router(decision_router, prefix="/api")


@app.get("/health")
@app.get("/api/health")
async def health():
    dialect = engine.url.get_backend_name()
    return {
        "ok": True,
        "status": "ok",
        "service": "cpt-dashboard",
        "db": dialect,
        "db_scheme": engine.url.drivername,
    }


@app.get("/api/market/bars")
async def market_bars(
    symbol: str = Query(..., min_length=1, max_length=20),
    days: int = Query(30, ge=5, le=120),
):
    try:
        import asyncio

        bars = await asyncio.to_thread(fetch_daily_bars, symbol, days)
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"market fetch failed for {symbol.upper()}: {exc}") from exc
    return {"symbol": symbol.upper(), "days": days, "bars": bars}


@app.get("/api/meta/leverage-map")
async def leverage_map():
    return {"map": LEVERAGE_MAP}


@app.get("/login")
async def login_page(request: Request):
    if request.session.get("user"):
        return RedirectResponse("/", status_code=302)
    return FileResponse(FRONTEND / "login.html")


@app.get("/")
async def index():
    return FileResponse(FRONTEND / "index.html")


if FRONTEND.exists():
    app.mount("/static", StaticFiles(directory=FRONTEND), name="static")
