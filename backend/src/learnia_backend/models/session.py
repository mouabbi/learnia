"""
SQLAlchemy model for server-side sessions (Bucket 3 — CookieSessionIssuer).

Named `UserSession`, not `Session` — SQLAlchemy's own `Session` class (the
DB connection/transaction object from database.py) already uses that name,
and reusing it here would be confusing to read and easy to import wrong.
"""

import secrets
from datetime import datetime, timedelta

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from learnia_backend.database import Base
from learnia_backend.utils.time import utc_now_naive


def _generate_session_id() -> str:
    """
    A random, unguessable session id (not a sequential int — sequential ids
    would let an attacker enumerate/guess other users' session ids).
    `secrets` (not `random`) is used because it's cryptographically secure.
    """
    return secrets.token_urlsafe(32)


class UserSession(Base):
    __tablename__ = "user_sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_generate_session_id)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(), default=utc_now_naive)
    expires_at: Mapped[datetime] = mapped_column(DateTime())

    def is_expired(self) -> bool:
        return utc_now_naive() > self.expires_at

    @staticmethod
    def new_expiry(ttl_minutes: int) -> datetime:
        return utc_now_naive() + timedelta(minutes=ttl_minutes)
