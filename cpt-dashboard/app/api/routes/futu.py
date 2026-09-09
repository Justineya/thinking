from __future__ import annotations

import asyncio
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.models.portfolio import PortfolioHolding
from app.models.watchlist import WatchlistItem
from app.services import futu_client
from app.services.futu_client import FutuError, strip_market
from app.services.market import LEVERAGE_MAP

router = APIRouter(prefix="/futu", tags=["futu"])


class SyncPortfolioIn(BaseModel):
    replace: bool = False  # True: delete local holdings not in Futu result
    dry_run: bool = False


class WatchlistAddIn(BaseModel):
    tickers: list[str] = Field(min_length=1)
    group: str | None = None
    also_cpt: bool = True  # also upsert into CPT watchlist DB
    also_futu: bool = True

    @field_validator("tickers")
    @classmethod
    def normalize(cls, values: list[str]) -> list[str]:
        out = []
        for v in values:
            t = strip_market(v)
            if t:
                out.append(t)
        if not out:
            raise ValueError("tickers empty")
        return out


@router.get("/status")
async def futu_status():
    settings = get_settings()
    try:
        state = await asyncio.to_thread(futu_client.check_opend)
        return state
    except FutuError as exc:
        return {
            "ok": False,
            "host": settings.futu_opend_host,
            "port": settings.futu_opend_port,
            "error": str(exc),
            "hint": "请在本机启动 FutuOpenD，并保证 CPT 后端与 OpenD 同机或可访问。",
        }
    except Exception as exc:  # noqa: BLE001
        return {
            "ok": False,
            "host": settings.futu_opend_host,
            "port": settings.futu_opend_port,
            "error": str(exc),
        }


@router.get("/positions")
async def futu_positions():
    try:
        rows = await asyncio.to_thread(futu_client.fetch_positions)
    except FutuError as exc:
        raise HTTPException(502, str(exc)) from exc
    return [
        {
            "code": p.code,
            "symbol": p.symbol,
            "underlying": p.underlying,
            "shares": p.shares,
            "cost_price": p.cost_price,
            "market_price": p.market_price,
            "market_value": p.market_value,
            "stock_name": p.stock_name,
            "pl_ratio": p.pl_ratio,
        }
        for p in rows
    ]


@router.post("/portfolio/sync")
async def sync_portfolio(body: SyncPortfolioIn, db: AsyncSession = Depends(get_db)):
    try:
        rows = await asyncio.to_thread(futu_client.fetch_positions)
    except FutuError as exc:
        raise HTTPException(502, str(exc)) from exc

    preview = [
        {
            "symbol": p.symbol,
            "underlying": p.underlying or LEVERAGE_MAP.get(p.symbol, p.symbol),
            "shares": p.shares,
            "cost_price": p.cost_price,
        }
        for p in rows
    ]
    if body.dry_run:
        return {"ok": True, "dry_run": True, "count": len(preview), "positions": preview}

    seen: set[str] = set()
    upserted = []
    for p in rows:
        symbol = p.symbol
        seen.add(symbol)
        underlying = p.underlying or LEVERAGE_MAP.get(symbol, symbol)
        existing = (
            await db.execute(select(PortfolioHolding).where(PortfolioHolding.symbol == symbol))
        ).scalar_one_or_none()
        if existing:
            existing.underlying = underlying
            existing.shares = Decimal(str(p.shares))
            existing.cost_price = Decimal(str(p.cost_price))
            item = existing
        else:
            item = PortfolioHolding(
                symbol=symbol,
                underlying=underlying,
                shares=Decimal(str(p.shares)),
                cost_price=Decimal(str(p.cost_price)),
            )
            db.add(item)
        upserted.append(symbol)

        # also ensure underlying is in CPT watchlist for scanner
        wl = (
            await db.execute(select(WatchlistItem).where(WatchlistItem.ticker == underlying))
        ).scalar_one_or_none()
        if wl is None:
            db.add(WatchlistItem(ticker=underlying, enabled=True))
        elif not wl.enabled:
            wl.enabled = True

    removed: list[str] = []
    if body.replace:
        all_rows = (await db.execute(select(PortfolioHolding))).scalars().all()
        for row in all_rows:
            if row.symbol not in seen:
                removed.append(row.symbol)
                await db.delete(row)

    await db.commit()
    return {
        "ok": True,
        "count": len(upserted),
        "upserted": upserted,
        "removed": removed,
        "positions": preview,
    }


@router.get("/watchlist/groups")
async def futu_watchlist_groups():
    try:
        return await asyncio.to_thread(futu_client.list_watchlist_groups)
    except FutuError as exc:
        raise HTTPException(502, str(exc)) from exc


@router.get("/watchlist")
async def futu_watchlist(group: str | None = Query(default=None)):
    try:
        return await asyncio.to_thread(futu_client.fetch_watchlist, group)
    except FutuError as exc:
        raise HTTPException(502, str(exc)) from exc


@router.post("/watchlist/add")
async def futu_watchlist_add(body: WatchlistAddIn, db: AsyncSession = Depends(get_db)):
    futu_result = None
    if body.also_futu:
        try:
            futu_result = await asyncio.to_thread(
                futu_client.add_to_watchlist, body.tickers, body.group
            )
        except FutuError as exc:
            raise HTTPException(502, str(exc)) from exc

    cpt_added: list[str] = []
    if body.also_cpt:
        for raw in body.tickers:
            # store underlying when leverage product
            ticker = LEVERAGE_MAP.get(raw, raw)
            row = (
                await db.execute(select(WatchlistItem).where(WatchlistItem.ticker == ticker))
            ).scalar_one_or_none()
            if row is None:
                db.add(WatchlistItem(ticker=ticker, enabled=True))
                cpt_added.append(ticker)
            elif not row.enabled:
                row.enabled = True
                cpt_added.append(ticker)
        await db.commit()

    return {
        "ok": True,
        "futu": futu_result,
        "cpt_added": cpt_added,
        "tickers": body.tickers,
    }


@router.post("/watchlist/import")
async def import_futu_watchlist_to_cpt(
    group: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Pull a Futu 自选 group into CPT watchlist (underlyings for leverage names)."""
    try:
        rows = await asyncio.to_thread(futu_client.fetch_watchlist, group)
    except FutuError as exc:
        raise HTTPException(502, str(exc)) from exc

    added = []
    for r in rows:
        ticker = LEVERAGE_MAP.get(r["ticker"], r["ticker"])
        existing = (
            await db.execute(select(WatchlistItem).where(WatchlistItem.ticker == ticker))
        ).scalar_one_or_none()
        if existing is None:
            db.add(WatchlistItem(ticker=ticker, enabled=True))
            added.append(ticker)
        elif not existing.enabled:
            existing.enabled = True
            added.append(ticker)
    await db.commit()
    return {"ok": True, "imported": len(rows), "added": added, "group": group or get_settings().futu_watchlist_group}
