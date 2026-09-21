"""
Import every model here so Alembic's autogenerate (and Base.metadata) sees
them all. A model defined but never imported anywhere is invisible to
SQLAlchemy's metadata and silently excluded from migrations.
"""

from learnia_backend.models.session import UserSession
from learnia_backend.models.user import User

__all__ = ["User", "UserSession"]
