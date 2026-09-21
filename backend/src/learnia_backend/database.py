"""
SQLAlchemy engine/session setup.

This is the minimum needed to persist users/sessions for authentication.
The full database design (indexes, all tables, seed fixtures) is
04-database's job — this file is deliberately small and will be extended
there, not replaced.
"""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from learnia_backend.config import settings

# check_same_thread=False is SQLite-specific: FastAPI can handle a request on
# a different thread than the one that opened the connection; without this
# flag SQLite raises an error even though we never share a connection across
# concurrent requests (each request gets its own Session below).
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Base class every SQLAlchemy model inherits from."""

    pass


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that yields a DB session and always closes it
    afterward, even if the request raised an error.
    Usage: `db: Session = Depends(get_db)` in a router/service function.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
