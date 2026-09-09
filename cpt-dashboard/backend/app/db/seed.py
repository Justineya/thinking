from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..market import LEVERAGE_MAP
from .models import Portfolio, Watchlist

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

# Example holdings from conversation (editable via API)
DEFAULT_PORTFOLIO = [
    {"symbol": "COHX", "underlying": "COHR", "shares": 270, "cost_price": 25.35},
]


def seed_if_empty(db: Session) -> None:
    if db.scalar(select(Watchlist.id).limit(1)) is None:
        for ticker in DEFAULT_WATCHLIST:
            db.add(Watchlist(ticker=ticker, enabled=True))
        db.commit()

    if db.scalar(select(Portfolio.id).limit(1)) is None:
        for row in DEFAULT_PORTFOLIO:
            und = row["underlying"] or LEVERAGE_MAP.get(row["symbol"], row["symbol"])
            db.add(
                Portfolio(
                    symbol=row["symbol"],
                    underlying=und,
                    shares=row["shares"],
                    cost_price=row["cost_price"],
                )
            )
        db.commit()
