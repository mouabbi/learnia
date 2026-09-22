"""
Import every model here so Alembic's autogenerate (and Base.metadata) sees
them all. A model defined but never imported anywhere is invisible to
SQLAlchemy's metadata and silently excluded from migrations.
"""

from learnia_backend.models.audit_event import AuditEvent
from learnia_backend.models.one_time_token import OneTimeToken
from learnia_backend.models.session import UserSession
from learnia_backend.models.user import User

__all__ = ["AuditEvent", "OneTimeToken", "User", "UserSession"]
