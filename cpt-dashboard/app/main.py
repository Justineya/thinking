from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes.cycle import router as cycle_router
from app.api.routes.futu import router as futu_router
from app.api.routes.portfolio import router as portfolio_router
from app.core.config import get_settings
from app.core.database import SessionLocal, engine
from app.models import Base
from app.services.market import LEVERAGE_MAP, fetch_daily_bars
from app.services.seed import seed_if_empty

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    if get_settings().seed_on_startup:
        async with SessionLocal() as db:
            await seed_if_empty(db)
    yield
    await engine.dispose()


app = FastAPI(title="CPT Dashboard API", version="2.0.0", lifespan=lifespan, docs_url="/docs")
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(portfolio_router, prefix="/api")
app.include_router(cycle_router, prefix="/api")
app.include_router(futu_router, prefix="/api")


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


@app.get("/")
async def index():
    return FileResponse(FRONTEND / "index.html")


if FRONTEND.exists():
    app.mount("/static", StaticFiles(directory=FRONTEND), name="static")
