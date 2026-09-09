from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings

engine = create_async_engine(get_settings().database_url, pool_pre_ping=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session


async def ensure_schema() -> None:
    """Lightweight additive migrations for Postgres/SQLite."""
    stmts = [
        "ALTER TABLE portfolio_holdings ADD COLUMN IF NOT EXISTS last_buy_price NUMERIC(18,6)",
        "ALTER TABLE portfolio_holdings ADD COLUMN IF NOT EXISTS last_sell_price NUMERIC(18,6)",
        "ALTER TABLE portfolio_holdings ADD COLUMN IF NOT EXISTS budget_used_pct NUMERIC(6,4)",
    ]
    # SQLite older versions lack IF NOT EXISTS for columns — ignore errors.
    async with engine.begin() as conn:
        dialect = engine.dialect.name
        for sql in stmts:
            try:
                if dialect == "sqlite":
                    # SQLite: try add, ignore duplicate
                    col = sql.split("ADD COLUMN IF NOT EXISTS ", 1)[1]
                    await conn.execute(text(f"ALTER TABLE portfolio_holdings ADD COLUMN {col}"))
                else:
                    await conn.execute(text(sql))
            except Exception:  # noqa: BLE001
                pass
