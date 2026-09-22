"""
AuthService — orchestrates a login: resolve the right strategy, authenticate,
issue a session. This is the "service" layer from 02-architecture's
router -> service -> repository layering; the router stays a thin HTTP
adapter and never touches strategies/repositories directly.
"""

from fastapi import Response
from sqlalchemy.orm import Session as DbSession

from learnia_backend.auth.registry import get_session_issuer, get_strategy
from learnia_backend.auth.strategies.base import AuthenticationFailed
from learnia_backend.config import settings
from learnia_backend.exceptions import UnauthorizedError, ValidationAppError
from learnia_backend.models.one_time_token import PURPOSE_MFA_LOGIN
from learnia_backend.models.user import User
from learnia_backend.repositories.audit_repository import (
    LOGIN_FAILURE,
    LOGIN_SUCCESS,
    LOGOUT,
    REGISTER,
    AuditRepository,
)
from learnia_backend.repositories.session_repository import SessionRepository
from learnia_backend.repositories.token_repository import TokenRepository
from learnia_backend.repositories.user_repository import UserRepository
from learnia_backend.security.passwords import hash_password
from learnia_backend.services.account_service import AccountService
from learnia_backend.services.login_guard import LoginGuard
from learnia_backend.services.mfa_service import MfaService


class AuthService:
    def __init__(self, db: DbSession) -> None:
        self.db = db
        self.audit = AuditRepository(db)

    def register(
        self, email: str, password: str, response: Response, ip_address: str | None = None
    ) -> User:
        """
        Password-specific account creation. Registration isn't part of the
        AuthStrategy interface (see auth/strategies/base.py) because it
        doesn't make sense for every strategy the same way — a future
        GoogleOAuthStrategy doesn't "register" a password, the OAuth
        callback itself creates the local user record. So this stays a
        password-flow-specific method here rather than a generic
        `strategy.register(...)` on the interface.
        """
        user_repository = UserRepository(self.db)

        if user_repository.get_by_email(email) is not None:
            # 422 (ValidationAppError), not 401/403 — this isn't an auth
            # failure, it's a request that violates a business rule
            # (email must be unique). See exceptions.py.
            raise ValidationAppError("An account with this email already exists")

        user = user_repository.create(email=email, hashed_password=hash_password(password))
        self.audit.record(REGISTER, user_id=user.id, email=email, ip_address=ip_address)

        # Register-then-login: same UX as most apps — no separate "now go
        # log in" step. Uses the same SessionIssuer as login() so the two
        # paths always stay consistent.
        issuer = get_session_issuer(self.db)
        issuer.issue(user, response)

        AccountService(self.db).send_verification_email(user)
        return user

    def login(
        self,
        strategy_id: str,
        credentials: dict,
        response: Response,
        ip_address: str | None = None,
    ) -> dict:
        """
        Returns either `{"mfa_required": False, "user": User}` (session
        already issued) or `{"mfa_required": True, "mfa_ticket": str}` (no
        session yet — the password was correct, but a second factor is
        still owed; see complete_mfa_login()).
        """
        email = credentials.get("email")

        # Lockout / rate limit run BEFORE checking the password, so a locked
        # account can't be used to keep guessing.
        LoginGuard(self.audit).check(email, ip_address)

        strategy = get_strategy(strategy_id, self.db)

        try:
            user = strategy.authenticate(credentials)
        except AuthenticationFailed as exc:
            self.audit.record(LOGIN_FAILURE, email=email, ip_address=ip_address)
            raise UnauthorizedError(str(exc)) from exc

        self.audit.record(LOGIN_SUCCESS, user_id=user.id, email=email, ip_address=ip_address)

        if MfaService(self.db).is_enabled(user.id):
            # Password proven, but don't issue a session until the TOTP/
            # recovery step also succeeds (see routers/auth.py's /login/mfa).
            ticket = TokenRepository(self.db).create(
                user_id=user.id,
                purpose=PURPOSE_MFA_LOGIN,
                ttl_minutes=settings.mfa_login_ticket_ttl_minutes,
            )
            return {"mfa_required": True, "mfa_ticket": ticket}

        issuer = get_session_issuer(self.db)
        issuer.issue(user, response)
        return {"mfa_required": False, "user": user}

    def complete_mfa_login(
        self,
        ticket: str,
        code: str,
        response: Response,
        ip_address: str | None = None,
    ) -> User:
        token = TokenRepository(self.db).consume(ticket, PURPOSE_MFA_LOGIN)
        if token is None:
            raise UnauthorizedError("Login expired, please sign in again")

        user = UserRepository(self.db).get_by_id(token.user_id)
        if user is None or not MfaService(self.db).verify_login_code(user, code):
            self.audit.record(LOGIN_FAILURE, user_id=token.user_id, ip_address=ip_address)
            raise UnauthorizedError("Invalid code")

        self.audit.record(LOGIN_SUCCESS, user_id=user.id, email=user.email, ip_address=ip_address)
        get_session_issuer(self.db).issue(user, response)
        return user

    def logout(
        self, session_id: str | None, response: Response, ip_address: str | None = None
    ) -> None:
        if session_id is not None:
            session = SessionRepository(self.db).get_by_id(session_id)
            if session is not None:
                self.audit.record(LOGOUT, user_id=session.user_id, ip_address=ip_address)
        issuer = get_session_issuer(self.db)
        issuer.revoke(session_id, response)
