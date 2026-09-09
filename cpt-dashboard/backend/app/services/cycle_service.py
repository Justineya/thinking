from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db.models import CycleScoreCache, Watchlist
from ..market import fetch_daily_bars, summarize_cycle
from ..schemas import CycleFilterItem, CycleOut

ZONE_MAP = {
    "build": "建仓区",
    "hold": "持有区",
    "warning": "警惕区",
    "harvest": "收获区",
}
CACHE_TTL_SEC = 300


def get_cycle(db: Session, ticker: str, days: int = 30, *, use_cache: bool = True) -> CycleOut:
    ticker = ticker.strip().upper()
    if use_cache:
        cached = db.scalar(
            select(CycleScoreCache).where(
                CycleScoreCache.ticker == ticker,
                CycleScoreCache.window_days == days,
            )
        )
        if cached is not None and _fresh(cached.updated_at):
            price = float(cached.price)
            high30 = float(cached.high30)
            dist = None if high30 == 0 else round((price / high30 - 1) * 100, 2)
            return CycleOut(
                ticker=ticker,
                current=price,
                high30=high30,
                low30=float(cached.low30),
                score=float(cached.score),
                zone=cached.zone,
                window=days,
                distanceToHighPct=dist,
            )

    bars = fetch_daily_bars(ticker, days=days)
    summary = summarize_cycle(bars)
    _upsert_cache(db, ticker, days, summary)
    return CycleOut(
        ticker=ticker,
        current=summary["current"],
        high30=summary["high"],
        low30=summary["low"],
        score=summary["score"],
        zone=summary["zone"],
        window=days,
        distanceToHighPct=summary.get("distanceToHighPct"),
        asOf=summary.get("asOf"),
    )


def _fresh(updated_at: datetime | None) -> bool:
    if updated_at is None:
        return False
    now = datetime.now(timezone.utc)
    ts = updated_at if updated_at.tzinfo else updated_at.replace(tzinfo=timezone.utc)
    return (now - ts).total_seconds() < CACHE_TTL_SEC


def _upsert_cache(db: Session, ticker: str, days: int, summary: dict) -> None:
    row = db.scalar(
        select(CycleScoreCache).where(
            CycleScoreCache.ticker == ticker,
            CycleScoreCache.window_days == days,
        )
    )
    if row is None:
        row = CycleScoreCache(ticker=ticker, window_days=days)
        db.add(row)
    row.score = summary["score"]
    row.price = summary["current"]
    row.high30 = summary["high"]
    row.low30 = summary["low"]
    row.zone = summary["zone"]
    row.updated_at = datetime.now(timezone.utc)
    db.commit()


def filter_cycles(
    db: Session,
    *,
    zone: str = "all",
    days: int = 30,
    q: str | None = None,
) -> list[CycleFilterItem]:
    tickers = db.scalars(
        select(Watchlist.ticker).where(Watchlist.enabled.is_(True)).order_by(Watchlist.ticker.asc())
    ).all()
    items: list[CycleFilterItem] = []
    zone_cn = ZONE_MAP.get(zone)
    for ticker in tickers:
        if q and q.upper() not in ticker.upper():
            continue
        try:
            cyc = get_cycle(db, ticker, days=days)
        except Exception:  # noqa: BLE001
            continue
        if zone != "all" and zone_cn and cyc.zone != zone_cn:
            continue
        items.append(
            CycleFilterItem(
                ticker=cyc.ticker,
                score=cyc.score,
                zone=cyc.zone,
                current=cyc.current,
                high30=cyc.high30,
                low30=cyc.low30,
                distanceToHighPct=cyc.distanceToHighPct,
            )
        )
    items.sort(key=lambda x: x.score)
    return items


def list_watchlist(db: Session) -> list[Watchlist]:
    return list(db.scalars(select(Watchlist).order_by(Watchlist.ticker.asc())).all())


def add_watchlist(db: Session, ticker: str, enabled: bool = True) -> Watchlist:
    ticker = ticker.strip().upper()
    row = db.scalar(select(Watchlist).where(Watchlist.ticker == ticker))
    if row:
        row.enabled = enabled
        db.commit()
        db.refresh(row)
        return row
    row = Watchlist(ticker=ticker, enabled=enabled)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def delete_watchlist(db: Session, ticker: str) -> bool:
    row = db.scalar(select(Watchlist).where(Watchlist.ticker == ticker.upper()))
    if not row:
        return False
    db.delete(row)
    db.commit()
    return True
