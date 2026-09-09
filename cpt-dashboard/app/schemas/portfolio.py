from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class HoldingBase(BaseModel):
    symbol: str = Field(min_length=1, max_length=20)
    underlying: str = Field(min_length=1, max_length=20)
    shares: Decimal = Field(gt=0)
    cost_price: Decimal = Field(ge=0)

    @field_validator("symbol", "underlying")
    @classmethod
    def normalize_ticker(cls, value: str) -> str:
        return value.strip().upper()


class HoldingCreate(HoldingBase):
    pass


class HoldingUpdate(BaseModel):
    shares: Decimal | None = Field(default=None, gt=0)
    cost_price: Decimal | None = Field(default=None, ge=0)
    underlying: str | None = Field(default=None, min_length=1, max_length=20)

    @field_validator("underlying")
    @classmethod
    def normalize_underlying(cls, value: str | None) -> str | None:
        return value.strip().upper() if value else value


class HoldingRead(HoldingBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class HoldingWithMetrics(HoldingRead):
    current_price: Decimal | None = None
    underlying_current_price: Decimal | None = None
    market_value: Decimal | None = None
    unrealized_pnl: Decimal | None = None
    unrealized_pnl_pct: Decimal | None = None
    cycle_score: Decimal | None = None
    zone: str | None = None
