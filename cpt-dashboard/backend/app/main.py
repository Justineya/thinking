from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .market import LEVERAGE_MAP, fetch_daily_bars, summarize_cycle

ROOT = Path(__file__).resolve().parents[2]
FRONTEND = ROOT / "frontend"

app = FastAPI(title="CPT Dashboard", docs_url="/docs")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "service": "cpt-dashboard"}


@app.get("/api/market/bars")
def market_bars(
    symbol: str = Query(..., min_length=1, max_length=20),
    days: int = Query(30, ge=5, le=120),
) -> dict:
    try:
        bars = fetch_daily_bars(symbol, days=days)
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            502,
            f"market fetch failed for {symbol.upper()}: {exc}",
        ) from exc
    return {"symbol": symbol.upper(), "days": days, "bars": bars}


@app.get("/api/cycle/{symbol}")
def cycle(symbol: str, days: int = Query(30, ge=5, le=120)) -> dict:
    try:
        bars = fetch_daily_bars(symbol, days=days)
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"market fetch failed: {exc}") from exc
    summary = summarize_cycle(bars)
    underlying = LEVERAGE_MAP.get(symbol.upper())
    return {
        "ticker": symbol.upper(),
        "underlying": underlying,
        "window": days,
        **summary,
        "high30" if days == 30 else f"high{days}": summary["high"],
        "low30" if days == 30 else f"low{days}": summary["low"],
    }


@app.get("/api/meta/leverage-map")
def leverage_map() -> dict:
    return {"map": LEVERAGE_MAP}


@app.get("/")
def index() -> FileResponse:
    return FileResponse(FRONTEND / "index.html")


if FRONTEND.exists():
    app.mount("/static", StaticFiles(directory=FRONTEND), name="static")


def main() -> None:
    import uvicorn

    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8787, reload=False)


if __name__ == "__main__":
    main()
