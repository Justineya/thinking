from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..db.database import get_db
from ..schemas import PortfolioIn, PortfolioOut
from ..services import portfolio_service

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


@router.get("", response_model=list[PortfolioOut])
def get_portfolio(
    enrich: bool = Query(True),
    days: int = Query(30, ge=5, le=120),
    db: Session = Depends(get_db),
) -> list[PortfolioOut]:
    return portfolio_service.list_portfolio(db, enrich=enrich, days=days)


@router.post("", response_model=PortfolioOut)
def post_portfolio(body: PortfolioIn, db: Session = Depends(get_db)) -> PortfolioOut:
    portfolio_service.create_portfolio(db, body)
    items = portfolio_service.list_portfolio(db, enrich=True)
    for item in items:
        if item.symbol == body.symbol.strip().upper():
            return item
    raise HTTPException(500, "created but not found")


@router.delete("/{item_id}")
def remove_portfolio(item_id: int, db: Session = Depends(get_db)) -> dict:
    ok = portfolio_service.delete_portfolio(db, item_id)
    if not ok:
        raise HTTPException(404, "portfolio item not found")
    return {"ok": True}
