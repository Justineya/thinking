from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.cycle import CycleScore
from app.models.watchlist import WatchlistItem
from app.schemas.cycle import CycleRead, CycleUpsert, WatchlistIn, WatchlistOut, ZoneKey
from app.services import cycle_service
from app.services.cycle_service import to_cycle_read

router = APIRouter(tags=["cycle"])


@router.put("/cycle", response_model=CycleRead)
async def upsert_cycle(payload: CycleUpsert, db: AsyncSession = Depends(get_db)):
    row = await cycle_service.upsert_cycle(db, payload)
    return to_cycle_read(row)


@router.post("/cycle/refresh", response_model=list[CycleRead])
async def refresh_cycles(
    window_days: int = Query(default=30, ge=5, le=120),
    db: AsyncSession = Depends(get_db),
):
    """Pull Yahoo bars for watchlist + holdings and upsert cycle_scores."""
    return await cycle_service.refresh_universe(db, window_days=window_days)


@router.get("/cycle", response_model=list[CycleRead])
async def filter_cycles(
    zone: ZoneKey | None = None,
    min_score: Decimal | None = Query(default=None, ge=0, le=10),
    max_score: Decimal | None = Query(default=None, ge=0, le=10),
    window_days: int = Query(default=30, ge=5, le=120),
    search: str | None = None,
    q: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    refresh: bool = False,
    db: AsyncSession = Depends(get_db),
):
    if refresh:
        await cycle_service.refresh_universe(db, window_days=window_days)

    filters = [CycleScore.window_days == window_days]
    if zone:
        filters.append(CycleScore.zone == zone)
    if min_score is not None:
        filters.append(CycleScore.score >= min_score)
    if max_score is not None:
        filters.append(CycleScore.score <= max_score)
    needle = (search or q or "").strip()
    if needle:
        filters.append(CycleScore.ticker.ilike(f"%{needle}%"))

    watch = (
        await db.execute(select(WatchlistItem.ticker).where(WatchlistItem.enabled.is_(True)))
    ).scalars().all()
    if watch:
        filters.append(CycleScore.ticker.in_([t.upper() for t in watch]))

    stmt = (
        select(CycleScore)
        .where(and_(*filters))
        .order_by(CycleScore.score, CycleScore.ticker)
        .limit(limit)
        .offset(offset)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [to_cycle_read(row) for row in rows]


# Compatibility alias — must be registered before /cycle/{ticker}
@router.get("/cycle/filter", response_model=list[CycleRead], include_in_schema=False)
async def filter_cycles_alias(
    zone: ZoneKey | None = None,
    days: int = Query(default=30, ge=5, le=120),
    q: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    return await filter_cycles(zone=zone, window_days=days, q=q, db=db)


@router.get("/cycle/{ticker}", response_model=CycleRead)
async def get_cycle(
    ticker: str,
    window_days: int = Query(default=30, ge=5, le=120),
    refresh: bool = False,
    db: AsyncSession = Depends(get_db),
):
    ticker = ticker.upper()
    row = await db.get(CycleScore, (ticker, window_days))
    if row is None or refresh:
        try:
            row = await cycle_service.refresh_ticker(db, ticker, window_days)
        except LookupError as exc:
            raise HTTPException(404, str(exc)) from exc
        except Exception as exc:  # noqa: BLE001
            if row is None:
                raise HTTPException(502, f"cycle failed for {ticker}: {exc}") from exc
    return to_cycle_read(row)


@router.get("/watchlist", response_model=list[WatchlistOut])
async def list_watchlist(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(WatchlistItem).order_by(WatchlistItem.ticker.asc()))).scalars().all()
    return rows


@router.post("/watchlist", response_model=WatchlistOut)
async def add_watchlist(body: WatchlistIn, db: AsyncSession = Depends(get_db)):
    row = (
        await db.execute(select(WatchlistItem).where(WatchlistItem.ticker == body.ticker))
    ).scalar_one_or_none()
    if row:
        row.enabled = body.enabled
    else:
        row = WatchlistItem(ticker=body.ticker, enabled=body.enabled)
        db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


@router.delete("/watchlist/{ticker}")
async def delete_watchlist(ticker: str, db: AsyncSession = Depends(get_db)):
    row = (
        await db.execute(select(WatchlistItem).where(WatchlistItem.ticker == ticker.upper()))
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "ticker not in watchlist")
    await db.delete(row)
    await db.commit()
    return {"ok": True}
