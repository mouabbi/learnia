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
