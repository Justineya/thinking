from __future__ import annotations

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import hash_password
from app.models.portfolio import PortfolioHolding
from app.models.user import User
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
# budget_used_pct: rough ladder usage so decision engine can reserve ammo
DEFAULT_PORTFOLIO = [
    {"symbol": "COHX", "underlying": "COHR", "shares": "270", "cost_price": "25.354", "last_buy_price": "25.354", "budget_used_pct": "0.55"},
    {"symbol": "AAOX", "underlying": "AAOI", "shares": "420", "cost_price": "12.682", "last_buy_price": "12.682", "budget_used_pct": "0.55"},
    {"symbol": "RKLB", "underlying": "RKLB", "shares": "60", "cost_price": "69.933", "last_buy_price": "69.933", "budget_used_pct": "0.35"},
    {"symbol": "SNXX", "underlying": "SNDK", "shares": "180", "cost_price": "15.621", "last_buy_price": "15.621", "budget_used_pct": "0.55"},
    {"symbol": "AXTI", "underlying": "AXTI", "shares": "40", "cost_price": "63.10", "last_buy_price": "63.10", "budget_used_pct": "0.35"},
    {"symbol": "AXTX", "underlying": "AXTI", "shares": "300", "cost_price": "7.103", "last_buy_price": "7.103", "budget_used_pct": "0.35"},
    {"symbol": "WOLF", "underlying": "WOLF", "shares": "50", "cost_price": "26.00", "last_buy_price": "26.00", "budget_used_pct": "0.35"},
    {"symbol": "MULL", "underlying": "MU", "shares": "55", "cost_price": "22.757", "last_buy_price": "22.757", "budget_used_pct": "0.35"},
    {"symbol": "SKUU", "underlying": "000660.KS", "shares": "29", "cost_price": "24.055", "last_buy_price": "24.055", "budget_used_pct": "0.35"},
    {"symbol": "CRDO", "underlying": "CRDO", "shares": "5", "cost_price": "167.00", "last_buy_price": "167.00", "budget_used_pct": "0.20"},
    {"symbol": "CRWV", "underlying": "CRWV", "shares": "7", "cost_price": "84.00", "last_buy_price": "84.00", "budget_used_pct": "0.20"},
]


async def seed_if_empty(db: AsyncSession) -> None:
    settings = get_settings()
    if settings.admin_username and settings.admin_password:
        admin = (
            await db.execute(select(User).where(User.username == settings.admin_username))
        ).scalar_one_or_none()
        if admin is None:
            db.add(
                User(
                    username=settings.admin_username,
                    password_hash=hash_password(settings.admin_password),
                    is_active=True,
                )
            )
            await db.commit()

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
    else:
        # Backfill decision fields for existing rows
        rows = (await db.execute(select(PortfolioHolding))).scalars().all()
        changed = False
        defaults = {r["symbol"]: r for r in DEFAULT_PORTFOLIO}
        for row in rows:
            if row.last_buy_price is None:
                row.last_buy_price = row.cost_price
                changed = True
            if row.budget_used_pct is None:
                d = defaults.get(row.symbol)
                row.budget_used_pct = Decimal(d["budget_used_pct"]) if d else Decimal("0.35")
                changed = True
        if changed:
            await db.commit()
