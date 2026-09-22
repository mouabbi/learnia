"""
Course — the top-level content entity. Owns a course's own metadata,
authoring status, and theme; everything hierarchical underneath (modules ->
chapters -> pages, see module.py/chapter.py/page.py) hangs off `course_id`.

`content_status` is the CONTENT authoring lifecycle (is this course written
and ready to publish) — completely separate from any one learner's progress
(LearningProgress.status, models/learning_progress.py). Never conflate the
two: a PUBLISHED course says nothing about whether a given user has started
it, and a user finishing a course doesn't change its content_status.

Delete has two intentional paths (04-database):
  - soft: set content_status = ARCHIVED (reversible, the default admin action)
  - hard: actually DELETE the row — cascades to every child table via
    ondelete="CASCADE" FKs (enforced at the SQLite level, see database.py's
    "PRAGMA foreign_keys=ON"), for real cleanup of abandoned/test courses.
"""

from datetime import datetime

from sqlalchemy import JSON, DateTime, String, Text
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import Mapped, mapped_column

from learnia_backend.database import Base
from learnia_backend.models.enums import ContentStatus
from learnia_backend.utils.time import utc_now_naive


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text(), default=None)
    # Icon-picker name (e.g. "flask") for v1, not an Asset reference — see
    # 15-assets' open question; revisit if courses need custom-uploaded icons.
    icon: Mapped[str | None] = mapped_column(String(100), default=None)
    content_status: Mapped[ContentStatus] = mapped_column(
        SqlEnum(ContentStatus, native_enum=False, length=20, validate_strings=True),
        default=ContentStatus.PLANNED,
        index=True,
    )
    # Cohesive, non-relational bundle (brand/accent, module color map,
    # heading colors, light+dark palettes) — always read/written whole, never
    # queried by individual color, so a JSON column beats a `themes` table
    # (16-theming). Validated on write by a Pydantic model at the API layer,
    # not at the DB layer.
    theme: Mapped[dict | None] = mapped_column(JSON(), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(), default=utc_now_naive)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(), default=utc_now_naive, onupdate=utc_now_naive
    )
    # Set when content_status transitions to ARCHIVED; cleared if it's ever
    # moved back out of ARCHIVED. A timestamp instead of a bool so "when"
    # is never lost, matching this codebase's `email_verified_at` pattern.
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(), default=None)

    def is_archived(self) -> bool:
        return self.content_status == ContentStatus.ARCHIVED
