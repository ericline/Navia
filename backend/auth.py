# backend/auth.py
#
# Centralises all authentication concerns:
#   - Password hashing / verification (bcrypt via passlib)
#   - JWT creation and decoding (HS256 via python-jose)
#   - FastAPI dependency that resolves the current user from a Bearer token
#   - Shared get_db() dependency used by every router
#
# Usage in a router:
#   from auth import get_db, get_current_user
#   @router.get("/me")
#   def me(current_user: models.User = Depends(get_current_user)):
#       ...

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

import models
from database import SessionLocal

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

# Override SECRET_KEY with a strong random value in production via env var.
SECRET_KEY = os.getenv("SECRET_KEY", "navia-dev-secret-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30  # Tokens are valid for 30 days

# ---------------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------------

# bcrypt password hashing; passlib handles cost factor and salt automatically.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# HTTPBearer extracts the token from the Authorization: Bearer <token> header.
# auto_error=False so we can return a custom 401 instead of FastAPI's default.
_bearer = HTTPBearer(auto_error=False)

# ---------------------------------------------------------------------------
# Database dependency (shared by all routers)
# ---------------------------------------------------------------------------

def get_db():
    """Yield a SQLAlchemy session and ensure it is closed after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ---------------------------------------------------------------------------
# Password helpers
# ---------------------------------------------------------------------------

def hash_password(password: str) -> str:
    """Return a bcrypt hash of the given plaintext password."""
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if the plaintext password matches the stored hash."""
    return pwd_context.verify(plain, hashed)

# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

def create_access_token(user_id: int) -> str:
    """
    Create a signed JWT containing the user's ID as the 'sub' claim.
    The token expires after ACCESS_TOKEN_EXPIRE_DAYS days.
    """
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": str(user_id), "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)

# ---------------------------------------------------------------------------
# FastAPI dependency: resolve current user from Bearer token
# ---------------------------------------------------------------------------

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> models.User:
    """
    FastAPI dependency that validates the Bearer token and returns the
    corresponding User row.  Raises HTTP 401 on any auth failure so that
    protected endpoints never have to handle missing/invalid tokens themselves.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise JWTError()
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user
