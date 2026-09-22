"""
SQLAlchemy model for `users`.

Note: this is a DB model, not an API schema. It has `hashed_password` on it,
which must NEVER be included in a Pydantic response model (see
schemas/auth.py's UserRead) — that separation is exactly why
02-architecture insists on keeping DB models and API schemas as distinct
classes.
"""

from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from learnia_backend.database import Base
from learnia_backend.utils.time import utc_now_naive


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    # See utils/time.py's utc_now_naive for why this is naive, not
    # timezone-aware: SQLite strips tzinfo on read-back regardless.
    created_at: Mapped[datetime] = mapped_column(DateTime(), default=utc_now_naive)
    # None = email not verified yet.
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(), default=None)

    @property
    def email_verified(self) -> bool:
        return self.email_verified_at is not None
