"""
First real repository (see 02-architecture, decision 5) — a small wrapper
around User queries so services never call SQLAlchemy directly. Deliberately
minimal: only the methods actually used right now, no speculative CRUD.
"""

from sqlalchemy.orm import Session

from learnia_backend.models.user import User
from learnia_backend.utils.time import utc_now_naive


class UserRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, user_id: int) -> User | None:
        return self.db.get(User, user_id)

    def get_by_email(self, email: str) -> User | None:
        return self.db.query(User).filter(User.email == email).first()

    def create(self, *, email: str, hashed_password: str) -> User:
        user = User(email=email, hashed_password=hashed_password)
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def set_password(self, user: User, hashed_password: str) -> None:
        user.hashed_password = hashed_password
        self.db.commit()

    def mark_email_verified(self, user: User) -> None:
        user.email_verified_at = utc_now_naive()
        self.db.commit()
