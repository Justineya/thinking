from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.cycle import CycleScore
from app.models.portfolio import PortfolioHolding
from app.schemas.portfolio import HoldingCreate, HoldingRead, HoldingUpdate, HoldingWithMetrics
from app.services.market import LEVERAGE_MAP

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


def _metrics(holding: PortfolioHolding, hold_cycle: CycleScore | None, und_cycle: CycleScore | None) -> HoldingWithMetrics:
    data = HoldingRead.model_validate(holding).model_dump()
    # Market value must use the traded symbol (e.g. COHX), not the underlying.
    px = hold_cycle.current_price if hold_cycle else None
    und_px = und_cycle.current_price if und_cycle else None
    if px is not None:
        mv = holding.shares * px
        cost = holding.shares * holding.cost_price
        pnl = mv - cost
        pct = (pnl / cost * Decimal("100")) if cost else None
        data.update(
            current_price=px,
            underlying_current_price=und_px,
            market_value=mv.quantize(Decimal("0.01")),
            unrealized_pnl=pnl.quantize(Decimal("0.01")),
            unrealized_pnl_pct=pct.quantize(Decimal("0.01")) if pct is not None else None,
        )
    elif und_px is not None:
        data["underlying_current_price"] = und_px
    if und_cycle:
        data.update(cycle_score=und_cycle.score, zone=und_cycle.zone)
    return HoldingWithMetrics(**data)


@router.post("", response_model=HoldingRead, status_code=status.HTTP_201_CREATED)
async def create_holding(payload: HoldingCreate, db: AsyncSession = Depends(get_db)):
    from app.services import cycle_service

    symbol = payload.symbol
    underlying = payload.underlying or LEVERAGE_MAP.get(symbol, symbol)
    existing = (
        await db.execute(select(PortfolioHolding).where(PortfolioHolding.symbol == symbol))
    ).scalar_one_or_none()
    if existing:
        existing.underlying = underlying
        existing.shares = payload.shares
        existing.cost_price = payload.cost_price
        existing.last_buy_price = payload.cost_price
        await db.commit()
        await db.refresh(existing)
        item = existing
    else:
        item = PortfolioHolding(
            symbol=symbol,
            underlying=underlying,
            shares=payload.shares,
            cost_price=payload.cost_price,
            last_buy_price=payload.cost_price,
            budget_used_pct=Decimal("0.10"),
        )
        db.add(item)
        await db.commit()
        await db.refresh(item)

    for t in {item.symbol, item.underlying}:
        try:
            await cycle_service.refresh_ticker(db, t, 30)
        except Exception:  # noqa: BLE001
            pass
    return item


@router.get("", response_model=list[HoldingWithMetrics])
async def list_holdings(window_days: int = 30, db: AsyncSession = Depends(get_db)):
    from app.services import cycle_service

    holdings = (
        await db.execute(select(PortfolioHolding).order_by(PortfolioHolding.id.asc()))
    ).scalars().all()
    result: list[HoldingWithMetrics] = []
    for holding in holdings:
        hold_cycle = await db.get(CycleScore, (holding.symbol, window_days))
        und_cycle = await db.get(CycleScore, (holding.underlying, window_days))
        if hold_cycle is None:
            try:
                hold_cycle = await cycle_service.refresh_ticker(db, holding.symbol, window_days)
            except Exception:  # noqa: BLE001
                hold_cycle = None
        if und_cycle is None:
            try:
                und_cycle = await cycle_service.refresh_ticker(db, holding.underlying, window_days)
            except Exception:  # noqa: BLE001
                und_cycle = None
        result.append(_metrics(holding, hold_cycle, und_cycle))
    return result


@router.get("/{holding_id}", response_model=HoldingWithMetrics)
async def get_holding(holding_id: int, window_days: int = 30, db: AsyncSession = Depends(get_db)):
    holding = await db.get(PortfolioHolding, holding_id)
    if not holding:
        raise HTTPException(404, "Holding not found")
    hold_cycle = await db.get(CycleScore, (holding.symbol, window_days))
    und_cycle = await db.get(CycleScore, (holding.underlying, window_days))
    return _metrics(holding, hold_cycle, und_cycle)


@router.patch("/{holding_id}", response_model=HoldingRead)
async def update_holding(holding_id: int, payload: HoldingUpdate, db: AsyncSession = Depends(get_db)):
    item = await db.get(PortfolioHolding, holding_id)
    if not item:
        raise HTTPException(404, "Holding not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/{holding_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_holding(holding_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(delete(PortfolioHolding).where(PortfolioHolding.id == holding_id))
    if result.rowcount == 0:
        raise HTTPException(404, "Holding not found")
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
