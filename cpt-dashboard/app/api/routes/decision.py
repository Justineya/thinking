from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services import decision_service

router = APIRouter(prefix="/decision", tags=["decision"])


@router.get("")
@router.get("/cards")
async def decision_cards(
    window_days: int = Query(30, ge=5, le=120),
    include_watchlist: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    cards = await decision_service.build_cards(
        db,
        window_days=window_days,
        include_watchlist_empty=include_watchlist,
    )
    return {
        "ok": True,
        "count": len(cards),
        "cards": [c.to_dict() for c in cards],
        "legend": {
            "actions": ["试探建仓", "正常建仓", "加仓", "持有", "部分止盈", "明显减仓"],
            "note": "观望并入「持有 0%」，理由说明为何不出手",
        },
    }
