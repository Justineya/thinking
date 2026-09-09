from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cycle import CycleScore
from app.models.portfolio import PortfolioHolding
from app.models.watchlist import WatchlistItem
from app.schemas.cycle import CycleRead, CycleUpsert
from app.services.cycle_engine import (
    calculate_score,
    distance_to_high_pct,
    zone_from_score,
)
from app.services.market import fetch_daily_bars


def to_cycle_read(row: CycleScore) -> CycleRead:
    return CycleRead(
        ticker=row.ticker,
        window_days=row.window_days,
        current_price=row.current_price,
        period_low=row.period_low,
        period_high=row.period_high,
        score=row.score,
        zone=row.zone,
        distance_to_high_pct=distance_to_high_pct(row.current_price, row.period_high),
        updated_at=row.updated_at,
    )


async def upsert_cycle(db: AsyncSession, payload: CycleUpsert) -> CycleScore:
    score = calculate_score(payload.current_price, payload.period_low, payload.period_high)
    zone = zone_from_score(score)
    values = payload.model_dump() | {
        "score": score,
        "zone": zone,
        "updated_at": datetime.now(timezone.utc),
    }
    stmt = (
        insert(CycleScore)
        .values(**values)
        .on_conflict_do_update(
            index_elements=[CycleScore.ticker, CycleScore.window_days],
            set_={
                "current_price": values["current_price"],
                "period_low": values["period_low"],
                "period_high": values["period_high"],
                "score": values["score"],
                "zone": values["zone"],
                "updated_at": values["updated_at"],
            },
        )
        .returning(CycleScore)
    )
    row = (await db.execute(stmt)).scalar_one()
    await db.commit()
    return row


async def refresh_ticker(db: AsyncSession, ticker: str, window_days: int = 30) -> CycleScore:
    bars = await asyncio.to_thread(fetch_daily_bars, ticker, window_days)
    highs = [Decimal(str(b["high"])) for b in bars]
    lows = [Decimal(str(b["low"])) for b in bars]
    current = Decimal(str(bars[-1]["close"]))
    payload = CycleUpsert(
        ticker=ticker,
        window_days=window_days,
        current_price=current,
        period_low=min(lows),
        period_high=max(highs),
    )
    return await upsert_cycle(db, payload)


async def refresh_universe(db: AsyncSession, window_days: int = 30) -> list[CycleRead]:
    watch = (
        await db.execute(select(WatchlistItem.ticker).where(WatchlistItem.enabled.is_(True)))
    ).scalars().all()
    holds = (await db.execute(select(PortfolioHolding))).scalars().all()
    tickers = {t.upper() for t in watch}
    for h in holds:
        tickers.add(h.symbol.upper())
        tickers.add(h.underlying.upper())

    out: list[CycleRead] = []
    for ticker in sorted(tickers):
        try:
            row = await refresh_ticker(db, ticker, window_days)
            out.append(to_cycle_read(row))
        except Exception:  # noqa: BLE001
            continue
    out.sort(key=lambda x: (x.score, x.ticker))
    return out
