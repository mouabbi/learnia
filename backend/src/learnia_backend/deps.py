"""
Shared FastAPI dependencies. `get_current_user` is what any protected route
uses to require a logged-in user — see any real protected endpoint's
`user: User = Depends(get_current_user)`.
"""

from fastapi import Depends, Request
from sqlalchemy.orm import Session as DbSession

from learnia_backend.config import settings
from learnia_backend.database import get_db
from learnia_backend.exceptions import UnauthorizedError
from learnia_backend.models.user import User
from learnia_backend.repositories.session_repository import SessionRepository
from learnia_backend.repositories.user_repository import UserRepository


def get_current_user(request: Request, db: DbSession = Depends(get_db)) -> User:
    # Read via `request.cookies` (not FastAPI's `Cookie(alias=...)`) so the
    # cookie name comes from settings at call time, not hardcoded at
    # function-definition time — keeps SESSION_COOKIE_NAME a single source
    # of truth if it's ever changed in .env.
    session_id = request.cookies.get(settings.session_cookie_name)
    if session_id is None:
        raise UnauthorizedError("Not logged in")

    session = SessionRepository(db).get_by_id(session_id)
    if session is None or session.is_expired():
        raise UnauthorizedError("Session expired or invalid")

    user = UserRepository(db).get_by_id(session.user_id)
    if user is None:
        raise UnauthorizedError("Session refers to a user that no longer exists")

    return user
