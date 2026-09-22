"""
Shared fixtures. Every test gets a brand-new in-memory SQLite database, so
tests never touch learnia.db and never affect each other.
"""

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from learnia_backend import models  # noqa: F401  (registers tables on Base.metadata)
from learnia_backend.database import Base, get_db
from learnia_backend.main import app


@pytest.fixture
def db() -> Generator[Session, None, None]:
    # StaticPool: one shared connection, otherwise each connection to
    # an in-memory database would be its own separate empty database.
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine, autoflush=False)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture
def client(db: Session) -> Generator[TestClient, None, None]:
    # Make the real app use the test database instead of learnia.db.
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
