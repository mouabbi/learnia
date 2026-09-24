"""
Two tables, both per-user, both about a learner's OWN progress — never to be
confused with Course.content_status (the content's authoring lifecycle):

- LearningProgress: one row per (user, course). The "where am I" pointer —
  current status + current page — surfaced on the dashboard's "continue
  learning" card (17-dashboard). Unique on (user_id, course_id).

  `content_seen_at` backs the "this course changed since you last looked"
  badge (see repositories/progress_repository.py's has_unseen_update and
  routers/courses.py's mark-content-seen endpoint): the timestamp this
  learner last acknowledged this course's content. Defaults to "now" the
  moment a learner's progress row is created (starting a course counts as
  having seen its current content), and is bumped forward again whenever
  they dismiss a later change notice. A learner has an unseen update when
  Course.updated_at (models/course.py, bumped by CourseRepository.touch on
  ANY content/assessment mutation) is later than this timestamp.

- PageProgress: one row per (user, page) that the user has COMPLETED.
  Existence of the row *is* the completion signal (08-learning-progress:
  "mark as completed on Next" is idempotent — inserting the same row twice
  is a no-op via the unique constraint). Progress % = completed pages /
  total pages, each page weighted equally.

Split into two tables because they answer different questions at different
granularity: "where is this user right now in this course" (one row, rewritten
often) vs "which pages has this user ever finished" (append-mostly, one row
per completion, queried by COUNT for the progress bar).
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import Mapped, mapped_column

from learnia_backend.database import Base
from learnia_backend.models.enums import LearningStatus
from learnia_backend.utils.time import utc_now_naive


class LearningProgress(Base):
    __tablename__ = "learning_progress"
    __table_args__ = (UniqueConstraint("user_id", "course_id", name="uq_progress_user_course"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[LearningStatus] = mapped_column(
        SqlEnum(LearningStatus, native_enum=False, length=20, validate_strings=True),
        default=LearningStatus.NOT_STARTED,
        index=True,
    )
    # Nullable: NOT_STARTED has no current page yet.
    current_page_id: Mapped[int | None] = mapped_column(
        ForeignKey("pages.id", ondelete="SET NULL"), default=None
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(), default=None)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(), default=None)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(), default=utc_now_naive, onupdate=utc_now_naive, index=True
    )
    # See module docstring. Nullable only for pre-existing rows migrated in
    # before this column existed (backfilled to their own updated_at at
    # migration time); every row created from here on gets one immediately.
    content_seen_at: Mapped[datetime | None] = mapped_column(DateTime(), default=utc_now_naive)


class PageProgress(Base):
    __tablename__ = "page_progress"
    __table_args__ = (UniqueConstraint("user_id", "page_id", name="uq_page_progress_user_page"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    page_id: Mapped[int] = mapped_column(ForeignKey("pages.id", ondelete="CASCADE"), index=True)
    # Denormalized for "how many of this course's pages has this user
    # completed" without a join through chapters/modules.
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), index=True
    )
    completed_at: Mapped[datetime] = mapped_column(DateTime(), default=utc_now_naive)
