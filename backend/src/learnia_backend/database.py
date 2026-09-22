"""
SQLAlchemy engine/session setup.

This is the minimum needed to persist users/sessions for authentication.
The full database design (indexes, all tables, seed fixtures) is
04-database's job — this file is deliberately small and will be extended
there, not replaced.
"""

from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from learnia_backend.config import settings

_is_sqlite = settings.database_url.startswith("sqlite")

# check_same_thread=False is SQLite-specific: FastAPI can handle a request on
# a different thread than the one that opened the connection; without this
# flag SQLite raises an error even though we never share a connection across
# concurrent requests (each request gets its own Session below).
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if _is_sqlite else {},
)

if _is_sqlite:
    # SQLite ignores FOREIGN KEY constraints (including ON DELETE CASCADE /
    # SET NULL) unless this PRAGMA is set on every connection — it is NOT a
    # database-wide setting, so it must run per-connection via this event
    # rather than once at startup. Without it, e.g. deleting a Course would
    # silently leave orphaned Module/Chapter/Page/etc. rows behind instead of
    # cascading (see models/course.py's "hard delete" path).
    @event.listens_for(Engine, "connect")
    def _enable_sqlite_foreign_keys(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

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
