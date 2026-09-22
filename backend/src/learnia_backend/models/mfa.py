"""
MFA (TOTP) models.

`MfaSecret` has at most one row per user (enforced by the unique `user_id`).
`confirmed_at` is None between "enroll" (secret generated) and "confirm"
(user proved they scanned it correctly) — see services/mfa_service.py.
Only a confirmed secret makes login require a code.
"""

import hashlib
import secrets
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from learnia_backend.database import Base
from learnia_backend.utils.time import utc_now_naive


class MfaSecret(Base):
    __tablename__ = "mfa_secrets"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, index=True)
    encrypted_secret: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(), default=utc_now_naive)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(), default=None)

    def is_active(self) -> bool:
        return self.confirmed_at is not None


def generate_recovery_code() -> str:
    # 10 random hex chars, grouped for readability: e.g. "3f9a-2b7e1c".
    raw = secrets.token_hex(5)
    return f"{raw[:4]}-{raw[4:]}"


def hash_recovery_code(raw_code: str) -> str:
    return hashlib.sha256(raw_code.encode()).hexdigest()


class MfaRecoveryCode(Base):
    __tablename__ = "mfa_recovery_codes"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    code_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(), default=utc_now_naive)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(), default=None)
