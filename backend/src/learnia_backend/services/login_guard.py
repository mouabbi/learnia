"""
Login protection: account lockout + per-IP rate limiting.

Both are computed from failed-login rows in the audit log (see
models/audit_event.py) inside a sliding time window, so they survive
restarts and need no extra tables. Lockout is keyed on the email *as typed*,
whether or not the account exists — so an attacker can't tell a real account
from a fake one by seeing which ones get locked.
"""

from datetime import timedelta

from learnia_backend.config import settings
from learnia_backend.exceptions import TooManyRequestsError
from learnia_backend.repositories.audit_repository import LOGIN_BLOCKED, AuditRepository
from learnia_backend.utils.time import utc_now_naive


class LoginGuard:
    def __init__(self, audit: AuditRepository) -> None:
        self.audit = audit

    def check(self, email: str, ip_address: str | None) -> None:
        """Raise TooManyRequestsError if this login attempt must not even be tried."""
        since = utc_now_naive() - timedelta(minutes=settings.login_lockout_minutes)

        locked = self.audit.count_failures_for_email(email, since) >= (
            settings.login_max_failed_attempts
        )
        limited = ip_address is not None and (
            self.audit.count_failures_for_ip(ip_address, since) >= settings.login_max_failed_per_ip
        )
        if locked or limited:
            self.audit.record(LOGIN_BLOCKED, email=email, ip_address=ip_address)
            minutes = settings.login_lockout_minutes
            raise TooManyRequestsError(
                f"Too many failed login attempts. Try again in {minutes} minutes."
            )
