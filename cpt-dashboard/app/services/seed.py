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
    "SNDK",
    "MU",
    "QQQ",
    "SNOW",
    "ADBE",
    "LITE",
    "CIEN",
]

# Synced from Futu App screenshot (保证金综合账户 9635) — 2026-10-02
# App cost is remaining-lot average (realized P&L already carved out).
# Snapshot: MV≈19562 · holding P/L≈-3102 · today≈+455
# Notable realized: AAOX≈-3286 · COHX≈-3918 · AXTX≈+2203 · SNXX≈+100
# budget_used_pct: rough ladder usage so decision engine can reserve ammo
DEFAULT_PORTFOLIO = [
    {"symbol": "AAOX", "underlying": "AAOI", "shares": "380", "cost_price": "10.234", "last_buy_price": "10.234", "budget_used_pct": "0.55"},
    {"symbol": "COHX", "underlying": "COHR", "shares": "150", "cost_price": "25.119", "last_buy_price": "25.119", "budget_used_pct": "0.55"},
    {"symbol": "AXTX", "underlying": "AXTI", "shares": "70", "cost_price": "33.147", "last_buy_price": "33.147", "budget_used_pct": "0.45"},
    {"symbol": "TQQQ", "underlying": "QQQ", "shares": "20", "cost_price": "80.60", "last_buy_price": "80.60", "budget_used_pct": "0.25"},
    {"symbol": "SNOW", "underlying": "SNOW", "shares": "4", "cost_price": "344.72", "last_buy_price": "344.72", "budget_used_pct": "0.20"},
    {"symbol": "ADBE", "underlying": "ADBE", "shares": "5", "cost_price": "241.286", "last_buy_price": "241.286", "budget_used_pct": "0.20"},
    {"symbol": "MULL", "underlying": "MU", "shares": "40", "cost_price": "27.614", "last_buy_price": "27.614", "budget_used_pct": "0.30"},
    {"symbol": "SNXX", "underlying": "SNDK", "shares": "61", "cost_price": "17.912", "last_buy_price": "17.912", "budget_used_pct": "0.30"},
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

    replace = bool(settings.seed_replace_portfolio)

    has_watch = (await db.execute(select(WatchlistItem.id).limit(1))).scalar_one_or_none()
    if has_watch is None or replace:
        if replace and has_watch is not None:
            for row in (await db.execute(select(WatchlistItem))).scalars().all():
                await db.delete(row)
            await db.commit()
        for ticker in DEFAULT_WATCHLIST:
            db.add(WatchlistItem(ticker=ticker, enabled=True))
        await db.commit()

    has_hold = (await db.execute(select(PortfolioHolding.id).limit(1))).scalar_one_or_none()
    if has_hold is None or replace:
        if replace and has_hold is not None:
            for row in (await db.execute(select(PortfolioHolding))).scalars().all():
                await db.delete(row)
            await db.commit()
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
