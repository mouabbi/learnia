from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session as DbSession

from learnia_backend.models.audit_event import AuditEvent

LOGIN_SUCCESS = "login_success"
LOGIN_FAILURE = "login_failure"
LOGIN_BLOCKED = "login_blocked"
LOGOUT = "logout"
REGISTER = "register"
PASSWORD_CHANGED = "password_changed"
PASSWORD_RESET_REQUESTED = "password_reset_requested"
PASSWORD_RESET_COMPLETED = "password_reset_completed"
EMAIL_VERIFIED = "email_verified"


class AuditRepository:
    def __init__(self, db: DbSession) -> None:
        self.db = db

    def record(
        self,
        event_type: str,
        *,
        user_id: int | None = None,
        email: str | None = None,
        ip_address: str | None = None,
    ) -> AuditEvent:
        event = AuditEvent(
            event_type=event_type, user_id=user_id, email=email, ip_address=ip_address
        )
        self.db.add(event)
        self.db.commit()
        return event

    def count_failures_for_email(self, email: str, since: datetime) -> int:
        """Failed logins for this email since `since`, ignoring any before its last success."""
        last_success = (
            self.db.query(func.max(AuditEvent.created_at))
            .filter(AuditEvent.event_type == LOGIN_SUCCESS, AuditEvent.email == email)
            .scalar()
        )
        start = max(since, last_success) if last_success else since
        return (
            self.db.query(AuditEvent)
            .filter(
                AuditEvent.event_type == LOGIN_FAILURE,
                AuditEvent.email == email,
                AuditEvent.created_at > start,
            )
            .count()
        )

    def count_failures_for_ip(self, ip_address: str, since: datetime) -> int:
        return (
            self.db.query(AuditEvent)
            .filter(
                AuditEvent.event_type == LOGIN_FAILURE,
                AuditEvent.ip_address == ip_address,
                AuditEvent.created_at > since,
            )
            .count()
        )
