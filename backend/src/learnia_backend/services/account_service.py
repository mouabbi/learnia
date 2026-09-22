"""
AccountService — account-management flows that happen around login:
password change, password reset, email verification.
"""

from sqlalchemy.orm import Session as DbSession

from learnia_backend.config import settings
from learnia_backend.exceptions import UnauthorizedError, ValidationAppError
from learnia_backend.mail import get_email_sender
from learnia_backend.models.one_time_token import PURPOSE_EMAIL_VERIFICATION, PURPOSE_PASSWORD_RESET
from learnia_backend.models.user import User
from learnia_backend.repositories.audit_repository import (
    EMAIL_VERIFIED,
    PASSWORD_CHANGED,
    PASSWORD_RESET_COMPLETED,
    PASSWORD_RESET_REQUESTED,
    AuditRepository,
)
from learnia_backend.repositories.session_repository import SessionRepository
from learnia_backend.repositories.token_repository import TokenRepository
from learnia_backend.repositories.user_repository import UserRepository
from learnia_backend.security.passwords import hash_password, verify_password

INVALID_TOKEN = "This link is invalid or has expired"


class AccountService:
    def __init__(self, db: DbSession) -> None:
        self.users = UserRepository(db)
        self.sessions = SessionRepository(db)
        self.tokens = TokenRepository(db)
        self.audit = AuditRepository(db)

    # --- password change (logged in) ---

    def change_password(
        self,
        user: User,
        current_password: str,
        new_password: str,
        current_session_id: str | None,
        ip_address: str | None = None,
    ) -> None:
        if not verify_password(current_password, user.hashed_password):
            raise UnauthorizedError("Current password is incorrect")

        self.users.set_password(user, hash_password(new_password))
        # Any other device that was logged in (possibly a thief) is kicked out;
        # the session doing the change stays valid.
        self.sessions.delete_all_for_user(user.id, except_id=current_session_id)
        self.audit.record(
            PASSWORD_CHANGED, user_id=user.id, email=user.email, ip_address=ip_address
        )

    # --- password reset (logged out) ---

    def request_password_reset(self, email: str, ip_address: str | None = None) -> None:
        """
        Always returns quietly, whether or not the email exists — the endpoint
        answers identically either way, so it can't be used to discover
        which emails are registered.
        """
        user = self.users.get_by_email(email)
        if user is None:
            return

        raw_token = self.tokens.create(
            user_id=user.id,
            purpose=PURPOSE_PASSWORD_RESET,
            ttl_minutes=settings.password_reset_ttl_minutes,
        )
        link = f"{settings.frontend_base_url}/reset-password?token={raw_token}"
        get_email_sender().send(
            to=user.email,
            subject="Reset your Learnia password",
            body=(
                f"Use this link to choose a new password "
                f"(valid {settings.password_reset_ttl_minutes} minutes):\n\n{link}\n\n"
                "If you didn't ask for this, ignore this email."
            ),
        )
        self.audit.record(
            PASSWORD_RESET_REQUESTED, user_id=user.id, email=email, ip_address=ip_address
        )

    def reset_password(
        self, raw_token: str, new_password: str, ip_address: str | None = None
    ) -> None:
        token = self.tokens.consume(raw_token, PURPOSE_PASSWORD_RESET)
        if token is None:
            raise ValidationAppError(INVALID_TOKEN)

        user = self.users.get_by_id(token.user_id)
        self.users.set_password(user, hash_password(new_password))
        # Whoever knew the old password (maybe an attacker) is logged out everywhere.
        self.sessions.delete_all_for_user(user.id)
        self.audit.record(
            PASSWORD_RESET_COMPLETED, user_id=user.id, email=user.email, ip_address=ip_address
        )

    # --- email verification ---

    def send_verification_email(self, user: User) -> None:
        raw_token = self.tokens.create(
            user_id=user.id,
            purpose=PURPOSE_EMAIL_VERIFICATION,
            ttl_minutes=settings.email_verification_ttl_minutes,
        )
        link = f"{settings.frontend_base_url}/verify-email?token={raw_token}"
        get_email_sender().send(
            to=user.email,
            subject="Verify your Learnia email",
            body=f"Confirm your email address by opening this link:\n\n{link}",
        )

    def verify_email(self, raw_token: str, ip_address: str | None = None) -> None:
        token = self.tokens.consume(raw_token, PURPOSE_EMAIL_VERIFICATION)
        if token is None:
            raise ValidationAppError(INVALID_TOKEN)

        user = self.users.get_by_id(token.user_id)
        self.users.mark_email_verified(user)
        self.audit.record(EMAIL_VERIFIED, user_id=user.id, email=user.email, ip_address=ip_address)
