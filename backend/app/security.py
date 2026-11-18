from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_db
from app.models import User

pwd = PasswordHasher()
bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return pwd.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return pwd.verify(password_hash, password)
    except VerifyMismatchError:
        return False


def _encode(payload: dict, minutes: int | None = None, days: int | None = None) -> str:
    data = payload.copy()
    now = datetime.now(timezone.utc)
    if minutes is not None:
        data["exp"] = now + timedelta(minutes=minutes)
    elif days is not None:
        data["exp"] = now + timedelta(days=days)
    data["iat"] = now
    return jwt.encode(data, settings.secret_key, algorithm="HS256")


def create_access_token(user_id: int, role: str) -> str:
    return _encode({"sub": str(user_id), "role": role, "type": "access"}, minutes=settings.access_token_minutes)


def create_refresh_token(user_id: int) -> str:
    return _encode({"sub": str(user_id), "type": "refresh"}, days=settings.refresh_token_days)


def decode_token(token: str, expected_type: str) -> dict:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc
    if payload.get("type") != expected_type:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Wrong token type")
    return payload


async def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    if creds is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload = decode_token(creds.credentials, "access")
    user_id = int(payload["sub"])
    user = await db.scalar(select(User).where(User.id == user_id))
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive or missing")
    return user
