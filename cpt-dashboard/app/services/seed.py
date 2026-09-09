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
    "000660.KS",  # SK Hynix / SKUU underlying
]

# Synced from Futu App screenshot (保证金综合账户 9635) — 2026-09-09
DEFAULT_PORTFOLIO = [
    {"symbol": "COHX", "underlying": "COHR", "shares": "270", "cost_price": "25.354"},
    {"symbol": "AAOX", "underlying": "AAOI", "shares": "420", "cost_price": "12.682"},
    {"symbol": "RKLB", "underlying": "RKLB", "shares": "60", "cost_price": "69.933"},
    {"symbol": "SNXX", "underlying": "SNDK", "shares": "180", "cost_price": "15.621"},
    {"symbol": "AXTI", "underlying": "AXTI", "shares": "40", "cost_price": "63.10"},
    {"symbol": "AXTX", "underlying": "AXTI", "shares": "300", "cost_price": "7.103"},
    {"symbol": "WOLF", "underlying": "WOLF", "shares": "50", "cost_price": "26.00"},
    {"symbol": "MULL", "underlying": "MU", "shares": "55", "cost_price": "22.757"},
    {"symbol": "SKUU", "underlying": "000660.KS", "shares": "29", "cost_price": "24.055"},
    {"symbol": "CRDO", "underlying": "CRDO", "shares": "5", "cost_price": "167.00"},
    {"symbol": "CRWV", "underlying": "CRWV", "shares": "7", "cost_price": "84.00"},
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
