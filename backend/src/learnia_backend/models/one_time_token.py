"""
Single-use, expiring tokens for password reset and email verification.

Only the SHA-256 hash of the token is stored. The raw token exists only in
the email sent to the user, so a leaked database can't be used to reset
anyone's password. (A fast hash is fine here, unlike for passwords: the
token is 256 random bits, not a guessable human-chosen secret.)
"""

import hashlib
import secrets
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from learnia_backend.database import Base
from learnia_backend.utils.time import utc_now_naive

PURPOSE_PASSWORD_RESET = "password_reset"
PURPOSE_EMAIL_VERIFICATION = "email_verification"


def generate_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()


class OneTimeToken(Base):
    __tablename__ = "one_time_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    purpose: Mapped[str] = mapped_column(String(30))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(), default=utc_now_naive)
    expires_at: Mapped[datetime] = mapped_column(DateTime())
    used_at: Mapped[datetime | None] = mapped_column(DateTime(), default=None)

    def is_usable(self) -> bool:
        return self.used_at is None and utc_now_naive() <= self.expires_at
