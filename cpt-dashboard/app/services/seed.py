from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.portfolio import PortfolioHolding
from app.models.watchlist import WatchlistItem

DEFAULT_WATCHLIST = [
    "COHR",
    "AAOI",
    "AXTI",
    "WOLF",
    "CRDO",
    "SNDK",
    "MU",
    "RKLB",
    "CRWV",
]

DEFAULT_PORTFOLIO = [
    {"symbol": "COHX", "underlying": "COHR", "shares": "270", "cost_price": "25.35"},
]


async def seed_if_empty(db: AsyncSession) -> None:
    has_watch = (await db.execute(select(WatchlistItem.id).limit(1))).scalar_one_or_none()
    if has_watch is None:
        for ticker in DEFAULT_WATCHLIST:
            db.add(WatchlistItem(ticker=ticker, enabled=True))
        await db.commit()

    has_hold = (await db.execute(select(PortfolioHolding.id).limit(1))).scalar_one_or_none()
    if has_hold is None:
        for row in DEFAULT_PORTFOLIO:
            db.add(PortfolioHolding(**row))
        await db.commit()
