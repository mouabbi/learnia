from sqlalchemy.orm import Session as DbSession

from learnia_backend.config import settings
from learnia_backend.models.session import UserSession


class SessionRepository:
    def __init__(self, db: DbSession) -> None:
        self.db = db

    def create(self, *, user_id: int) -> UserSession:
        session = UserSession(
            user_id=user_id,
            expires_at=UserSession.new_expiry(settings.session_ttl_minutes),
        )
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def get_by_id(self, session_id: str) -> UserSession | None:
        return self.db.get(UserSession, session_id)

    def delete(self, session_id: str) -> None:
        session = self.get_by_id(session_id)
        if session is not None:
            self.db.delete(session)
            self.db.commit()

    def delete_all_for_user(self, user_id: int, *, except_id: str | None = None) -> None:
        """Log a user out everywhere (optionally keeping the current session)."""
        query = self.db.query(UserSession).filter(UserSession.user_id == user_id)
        if except_id is not None:
            query = query.filter(UserSession.id != except_id)
        query.delete()
        self.db.commit()
