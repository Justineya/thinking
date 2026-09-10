from __future__ import annotations

import asyncio
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cycle import CycleScore
from app.models.portfolio import PortfolioHolding
from app.models.watchlist import WatchlistItem
from app.services import cycle_service
from app.services.decision_engine import DecisionCard, cycle_metrics_from_bars, decide
from app.services.market import fetch_daily_bars
from app.services.sectors import peers_of


async def _score_for(db: AsyncSession, ticker: str, window_days: int = 30) -> float | None:
    row = await db.get(CycleScore, (ticker.upper(), window_days))
    if row is not None:
        return float(row.score)
    try:
        refreshed = await cycle_service.refresh_ticker(db, ticker, window_days)
        return float(refreshed.score)
    except Exception:  # noqa: BLE001
        return None


async def sector_temperature(db: AsyncSession, underlying: str, window_days: int = 30) -> float:
    peers = peers_of(underlying)
    scores: list[float] = []
    for t in peers:
        s = await _score_for(db, t, window_days)
        if s is not None:
            scores.append(s)
    if not scores:
        own = await _score_for(db, underlying, window_days)
        return float(own or 5.0)
    scores.sort()
    mid = len(scores) // 2
    if len(scores) % 2:
        return scores[mid]
    return (scores[mid - 1] + scores[mid]) / 2


async def build_card_for_holding(
    db: AsyncSession,
    holding: PortfolioHolding,
    *,
    window_days: int = 30,
) -> DecisionCard:
    symbol = holding.symbol.upper()
    underlying = holding.underlying.upper()
    has_position = float(holding.shares) > 0

    bars = await asyncio.to_thread(fetch_daily_bars, underlying, max(120, window_days * 4))
    metrics = cycle_metrics_from_bars(bars, window_days=window_days)
    # Prefer live cycle cache score for P when available (consistent with scanner)
    cached = await _score_for(db, underlying, window_days)
    position_score = float(cached) if cached is not None else float(metrics["position_score"])

    sector_score = await sector_temperature(db, underlying, window_days)

    last_buy = float(holding.last_buy_price) if getattr(holding, "last_buy_price", None) else float(holding.cost_price)
    # Prefer holding ticker price for PnL / gap when available
    hold_bars = None
    try:
        if symbol != underlying:
            hold_bars = await asyncio.to_thread(fetch_daily_bars, symbol, 15)
    except Exception:  # noqa: BLE001
        hold_bars = None
    current_px = float(hold_bars[-1]["close"]) if hold_bars else float(metrics["current"] or last_buy)

    change_from_last_buy = None
    if last_buy > 0:
        change_from_last_buy = (last_buy - current_px) / last_buy  # >0 means cheaper than last buy

    profit_pct = None
    if last_buy > 0:
        profit_pct = (current_px / last_buy - 1.0) * 100.0

    usage = float(holding.budget_used_pct) if getattr(holding, "budget_used_pct", None) is not None else (
        0.55 if has_position else 0.0
    )

    return decide(
        symbol=symbol,
        underlying=underlying,
        position_score=position_score,
        sector_score=sector_score,
        time_progress=float(metrics["time_progress"]),
        cycle_range_pct=float(metrics["cycle_range_pct"]),
        change_from_last_buy=change_from_last_buy,
        position_usage=usage,
        profit_pct=profit_pct,
        failed_breakout=bool(metrics["failed_breakout"]),
        has_position=has_position,
    )


async def build_cards(
    db: AsyncSession,
    *,
    window_days: int = 30,
    include_watchlist_empty: bool = False,
) -> list[DecisionCard]:
    holdings = (
        await db.execute(select(PortfolioHolding).order_by(PortfolioHolding.id.asc()))
    ).scalars().all()
    cards: list[DecisionCard] = []
    seen_und: set[str] = set()

    for h in holdings:
        try:
            cards.append(await build_card_for_holding(db, h, window_days=window_days))
            seen_und.add(h.underlying.upper())
        except Exception:  # noqa: BLE001
            continue

    if include_watchlist_empty:
        watch = (
            await db.execute(select(WatchlistItem).where(WatchlistItem.enabled.is_(True)))
        ).scalars().all()
        for w in watch:
            t = w.ticker.upper()
            if t in seen_und:
                continue
            # synthetic empty holding for watchlist-only names
            fake = PortfolioHolding(
                symbol=t,
                underlying=t,
                shares=Decimal("0"),
                cost_price=Decimal("0"),
            )
            # bypass shares>0 check via decide has_position=False — build_card uses shares
            try:
                bars = await asyncio.to_thread(fetch_daily_bars, t, max(120, window_days * 4))
                metrics = cycle_metrics_from_bars(bars, window_days=window_days)
                cached = await _score_for(db, t, window_days)
                p = float(cached) if cached is not None else float(metrics["position_score"])
                s = await sector_temperature(db, t, window_days)
                cards.append(
                    decide(
                        symbol=t,
                        underlying=t,
                        position_score=p,
                        sector_score=s,
                        time_progress=float(metrics["time_progress"]),
                        cycle_range_pct=float(metrics["cycle_range_pct"]),
                        change_from_last_buy=None,
                        position_usage=0.0,
                        profit_pct=None,
                        failed_breakout=bool(metrics["failed_breakout"]),
                        has_position=False,
                    )
                )
            except Exception:  # noqa: BLE001
                continue

    # Prefer actionable non-hold first, then by score
    rank = {"明显减仓": 0, "部分止盈": 1, "正常建仓": 2, "试探建仓": 3, "加仓": 4, "持有": 5}
    cards.sort(key=lambda c: (rank.get(c.action, 9), c.position_score or 99))
    return cards
