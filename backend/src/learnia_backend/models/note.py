"""
A user's personal note on a page. v1 scope is page-level only (08-learning-
progress); `section_id` is reserved now, nullable, and unused by v1 code, so
a later move to section-level anchoring (a specific block within the page's
content JSON — see page.py's docstring on why sections aren't DB rows) is an
additive column read, not a breaking migration.
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from learnia_backend.database import Base
from learnia_backend.utils.time import utc_now_naive


class Note(Base):
    __tablename__ = "notes"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    page_id: Mapped[int] = mapped_column(ForeignKey("pages.id", ondelete="CASCADE"), index=True)
    # Reserved for future section-level anchoring — a block anchor id inside
    # the page's content JSON, not a foreign key (blocks aren't DB rows).
    section_id: Mapped[str | None] = mapped_column(String(100), default=None)
    body: Mapped[str] = mapped_column(Text())
    created_at: Mapped[datetime] = mapped_column(DateTime(), default=utc_now_naive)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(), default=utc_now_naive, onupdate=utc_now_naive
    )
