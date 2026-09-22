from datetime import timedelta

from sqlalchemy.orm import Session as DbSession

from learnia_backend.models.one_time_token import OneTimeToken, generate_token, hash_token
from learnia_backend.utils.time import utc_now_naive


class TokenRepository:
    def __init__(self, db: DbSession) -> None:
        self.db = db

    def create(self, *, user_id: int, purpose: str, ttl_minutes: int) -> str:
        """Stores the hash and returns the RAW token (the only time it exists)."""
        raw_token = generate_token()
        self.db.add(
            OneTimeToken(
                user_id=user_id,
                purpose=purpose,
                token_hash=hash_token(raw_token),
                expires_at=utc_now_naive() + timedelta(minutes=ttl_minutes),
            )
        )
        self.db.commit()
        return raw_token

    def consume(self, raw_token: str, purpose: str) -> OneTimeToken | None:
        """Returns the token (now marked used) if valid for this purpose, else None."""
        token = (
            self.db.query(OneTimeToken)
            .filter(
                OneTimeToken.token_hash == hash_token(raw_token),
                OneTimeToken.purpose == purpose,
            )
            .first()
        )
        if token is None or not token.is_usable():
            return None
        token.used_at = utc_now_naive()
        self.db.commit()
        return token
