"""
Shared time helper. See its docstring for why "naive UTC" is the standard
this project uses for every timestamp column, not `datetime.now(UTC)` directly.
"""

from datetime import UTC, datetime


def utc_now_naive() -> datetime:
    """
    SQLite has no real timezone-aware datetime type: even a column declared
    `DateTime(timezone=True)` comes back from SQLite as a naive datetime
    (tzinfo stripped), because SQLite just stores a plain string. Comparing
    a naive value against an aware `datetime.now(UTC)` raises TypeError.

    Fix: every timestamp in this app is stored and compared as naive-but-
    actually-UTC. Never mix that with naive-local-time. This will need
    revisiting if 04-database ever moves to Postgres, which does support
    real timezone-aware columns.
    """
    return datetime.now(UTC).replace(tzinfo=None)
