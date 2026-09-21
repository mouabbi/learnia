from fastapi import Response

from learnia_backend.auth.session_issuers.base import SessionIssuer
from learnia_backend.config import settings
from learnia_backend.models.user import User
from learnia_backend.repositories.session_repository import SessionRepository


class CookieSessionIssuer(SessionIssuer):
    def __init__(self, session_repository: SessionRepository) -> None:
        self.session_repository = session_repository

    def issue(self, user: User, response: Response) -> None:
        session = self.session_repository.create(user_id=user.id)
        response.set_cookie(
            key=settings.session_cookie_name,
            value=session.id,
            httponly=True,  # not readable by JS — mitigates XSS stealing the cookie
            samesite="lax",  # not sent on cross-site POSTs — CSRF mitigation
            secure=settings.environment == "production",  # HTTPS-only in prod; no-op locally
            max_age=settings.session_ttl_minutes * 60,
        )

    def revoke(self, request_session_id: str | None, response: Response) -> None:
        if request_session_id is not None:
            self.session_repository.delete(request_session_id)
        response.delete_cookie(settings.session_cookie_name)
