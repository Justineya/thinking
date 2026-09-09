from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class PortfolioHolding(Base):
    __tablename__ = "portfolio_holdings"

    id: Mapped[int] = mapped_column(primary_key=True)
    symbol: Mapped[str] = mapped_column(String(20), index=True)
    underlying: Mapped[str] = mapped_column(String(20), index=True)
    shares: Mapped[Decimal] = mapped_column(Numeric(18, 6))
    cost_price: Mapped[Decimal] = mapped_column(Numeric(18, 6))
    last_buy_price: Mapped[Decimal | None] = mapped_column(Numeric(18, 6), nullable=True)
    last_sell_price: Mapped[Decimal | None] = mapped_column(Numeric(18, 6), nullable=True)
    # 0~1 fraction of this symbol's target budget already deployed
    budget_used_pct: Mapped[Decimal | None] = mapped_column(Numeric(6, 4), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
