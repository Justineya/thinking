from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

ZoneKey = Literal["build", "hold", "warning", "harvest"]


class CycleUpsert(BaseModel):
    ticker: str = Field(min_length=1, max_length=20)
    window_days: int = Field(default=30, ge=5, le=120)
    current_price: Decimal = Field(gt=0)
    period_low: Decimal = Field(gt=0)
    period_high: Decimal = Field(gt=0)

    @field_validator("ticker")
    @classmethod
    def normalize_ticker(cls, value: str) -> str:
        return value.strip().upper()

    @model_validator(mode="after")
    def check_range(self):
        if self.period_high < self.period_low:
            raise ValueError("period_high must be greater than or equal to period_low")
        return self


class CycleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ticker: str
    window_days: int
    current_price: Decimal
    period_low: Decimal
    period_high: Decimal
    score: Decimal
    zone: str
    distance_to_high_pct: Decimal
    updated_at: datetime | None = None


class WatchlistIn(BaseModel):
    ticker: str = Field(min_length=1, max_length=20)
    enabled: bool = True

    @field_validator("ticker")
    @classmethod
    def normalize_ticker(cls, value: str) -> str:
        return value.strip().upper()


class WatchlistOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ticker: str
    enabled: bool
