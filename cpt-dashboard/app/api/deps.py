from __future__ import annotations

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import User


async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    username = request.session.get("user")
    if not username:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未登录")
    user = (
        await db.execute(select(User).where(User.username == username, User.is_active.is_(True)))
    ).scalar_one_or_none()
    if not user:
        request.session.clear()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未登录")
    return user


async def require_login(user: User = Depends(get_current_user)) -> User:
    return user
