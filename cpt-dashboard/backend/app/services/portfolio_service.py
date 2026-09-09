from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db.models import Portfolio
from ..market import LEVERAGE_MAP, fetch_daily_bars, summarize_cycle
from ..schemas import PortfolioIn, PortfolioOut


def _num(v) -> float:
    return float(v)


def list_portfolio(db: Session, *, enrich: bool = True, days: int = 30) -> list[PortfolioOut]:
    rows = db.scalars(select(Portfolio).order_by(Portfolio.id.asc())).all()
    out: list[PortfolioOut] = []
    for row in rows:
        item = _to_out(row)
        if enrich:
            try:
                hold_bars = fetch_daily_bars(row.symbol, days=days)
                if row.symbol.upper() == row.underlying.upper():
                    und_bars = hold_bars
                else:
                    und_bars = fetch_daily_bars(row.underlying, days=days)
                hold_px = hold_bars[-1]["close"]
                cycle = summarize_cycle(und_bars)
                cost_total = item.shares * item.cost_price
                mv = item.shares * hold_px
                pnl = mv - cost_total
                item.current_price = hold_px
                item.market_value = round(mv, 4)
                item.cost_total = round(cost_total, 4)
                item.pnl = round(pnl, 4)
                item.pnl_pct = round(pnl / cost_total * 100, 2) if cost_total else None
                item.cycle_score = cycle["score"]
                item.zone = cycle["zone"]
            except Exception:  # noqa: BLE001
                pass
        out.append(item)
    return out


def create_portfolio(db: Session, body: PortfolioIn) -> Portfolio:
    symbol = body.symbol.strip().upper()
    underlying = (body.underlying or LEVERAGE_MAP.get(symbol, symbol)).strip().upper()
    existing = db.scalar(select(Portfolio).where(Portfolio.symbol == symbol))
    if existing:
        existing.underlying = underlying
        existing.shares = body.shares
        existing.cost_price = body.cost_price
        db.commit()
        db.refresh(existing)
        return existing
    row = Portfolio(
        symbol=symbol,
        underlying=underlying,
        shares=body.shares,
        cost_price=body.cost_price,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _to_out(row: Portfolio) -> PortfolioOut:
    return PortfolioOut(
        id=row.id,
        symbol=row.symbol,
        underlying=row.underlying,
        shares=_num(row.shares),
        cost_price=_num(row.cost_price),
        created_at=row.created_at,
    )


def delete_portfolio(db: Session, item_id: int) -> bool:
    row = db.get(Portfolio, item_id)
    if not row:
        return False
    db.delete(row)
    db.commit()
    return True
