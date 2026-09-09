from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class Portfolio(Base):
    __tablename__ = "portfolio"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    symbol: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    underlying: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    shares: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    cost_price: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Watchlist(Base):
    __tablename__ = "watchlist"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    ticker: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class CycleScoreCache(Base):
    __tablename__ = "cycle_score_cache"
    __table_args__ = (UniqueConstraint("ticker", "window_days", name="uq_cycle_ticker_window"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    ticker: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    window_days: Mapped[int] = mapped_column(nullable=False, default=30)
    score: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    price: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    high30: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    low30: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    zone: Mapped[str] = mapped_column(String(20), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class MarketSnapshot(Base):
    __tablename__ = "market_snapshot"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    ticker: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    as_of: Mapped[str] = mapped_column(String(20), nullable=False)
    close: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    high: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    low: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
