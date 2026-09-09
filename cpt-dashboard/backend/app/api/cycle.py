from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..db.database import get_db
from ..schemas import CycleFilterItem, CycleOut, WatchlistIn, WatchlistOut
from ..services import cycle_service

router = APIRouter(prefix="/api", tags=["cycle"])


@router.get("/cycle/filter", response_model=list[CycleFilterItem])
def cycle_filter(
    zone: str = Query("all", pattern="^(all|build|hold|warning|harvest)$"),
    days: int = Query(30, ge=5, le=120),
    q: str | None = None,
    db: Session = Depends(get_db),
) -> list[CycleFilterItem]:
    return cycle_service.filter_cycles(db, zone=zone, days=days, q=q)


@router.get("/cycle/{ticker}", response_model=CycleOut)
def cycle_one(
    ticker: str,
    days: int = Query(30, ge=5, le=120),
    db: Session = Depends(get_db),
) -> CycleOut:
    try:
        return cycle_service.get_cycle(db, ticker, days=days)
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"cycle failed for {ticker}: {exc}") from exc


@router.get("/watchlist", response_model=list[WatchlistOut])
def get_watchlist(db: Session = Depends(get_db)) -> list[WatchlistOut]:
    return [WatchlistOut.model_validate(x) for x in cycle_service.list_watchlist(db)]


@router.post("/watchlist", response_model=WatchlistOut)
def post_watchlist(body: WatchlistIn, db: Session = Depends(get_db)) -> WatchlistOut:
    row = cycle_service.add_watchlist(db, body.ticker, body.enabled)
    return WatchlistOut.model_validate(row)


@router.delete("/watchlist/{ticker}")
def remove_watchlist(ticker: str, db: Session = Depends(get_db)) -> dict:
    ok = cycle_service.delete_watchlist(db, ticker)
    if not ok:
        raise HTTPException(404, "ticker not in watchlist")
    return {"ok": True}
