"""
Security/audit log: one row per security-relevant event (login success or
failure, logout, password change...). Doubles as the data source for the
login lockout and rate limit (see services/login_guard.py), so they keep
working across server restarts.

`email` is stored as typed, even when no such account exists, so repeated
attempts against an unknown email can still be counted (and locked out)
without revealing that the account doesn't exist.
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from learnia_backend.database import Base
from learnia_backend.utils.time import utc_now_naive


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_type: Mapped[str] = mapped_column(String(50), index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), default=None)
    email: Mapped[str | None] = mapped_column(String(255), index=True, default=None)
    ip_address: Mapped[str | None] = mapped_column(String(45), index=True, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(), default=utc_now_naive, index=True)
