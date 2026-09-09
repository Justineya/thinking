from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class PortfolioIn(BaseModel):
    symbol: str = Field(min_length=1, max_length=20)
    underlying: str | None = Field(default=None, max_length=20)
    shares: float = Field(gt=0)
    cost_price: float = Field(ge=0)


class PortfolioOut(BaseModel):
    id: int
    symbol: str
    underlying: str
    shares: float
    cost_price: float
    created_at: datetime | None = None

    # enriched
    current_price: float | None = None
    market_value: float | None = None
    cost_total: float | None = None
    pnl: float | None = None
    pnl_pct: float | None = None
    cycle_score: float | None = None
    zone: str | None = None

    model_config = {"from_attributes": True}


class WatchlistIn(BaseModel):
    ticker: str = Field(min_length=1, max_length=20)
    enabled: bool = True


class WatchlistOut(BaseModel):
    id: int
    ticker: str
    enabled: bool

    model_config = {"from_attributes": True}


ZoneName = Literal["build", "hold", "warning", "harvest", "all"]


class CycleOut(BaseModel):
    ticker: str
    current: float
    high30: float
    low30: float
    score: float
    zone: str
    window: int = 30
    distanceToHighPct: float | None = None
    asOf: str | None = None


class CycleFilterItem(BaseModel):
    ticker: str
    score: float
    zone: str
    current: float | None = None
    high30: float | None = None
    low30: float | None = None
    distanceToHighPct: float | None = None
