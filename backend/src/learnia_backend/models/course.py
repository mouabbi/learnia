"""
SQLAlchemy models for course content + a learner's progress through it.

Course content (modules > chapters > pages, module QCMs, final exam) is
stored as a single JSON blob per course rather than fully normalized
tables — it's read-only, author-managed content with a deeply nested
shape that maps 1:1 onto the frontend's tree (see
frontend/src/features/courses/mockCourses.js), and normalizing it into a
dozen tables would buy nothing for content nobody queries by sub-field.
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from learnia_backend.database import Base
from learnia_backend.utils.time import utc_now_naive


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(String(2000))
    icon: Mapped[str | None] = mapped_column(String(100), default=None)
    image: Mapped[str | None] = mapped_column(String(500), default=None)
    color: Mapped[str | None] = mapped_column(String(20), default=None)
    difficulty: Mapped[str | None] = mapped_column(String(50), default=None)
    estimated_minutes: Mapped[int] = mapped_column(Integer, default=0)
    # { modules: [...], finalExam: {...} | null } — see mockCourses.js's
    # Module > Chapter > Page tree for the exact shape the frontend expects.
    content: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(), default=utc_now_naive)


class CourseProgress(Base):
    """
    One row per (user, course) — a learner's progress through that course.
    Mirrors the shape frontend/progressStore.js used to keep in
    localStorage, so the frontend reads this straight into its existing UI.
    """

    __tablename__ = "course_progress"
    __table_args__ = (UniqueConstraint("user_id", "course_id", name="uq_course_progress_user_course"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"), index=True)
    completed_page_ids: Mapped[list] = mapped_column(JSON, default=list)
    last_page_id: Mapped[str | None] = mapped_column(String(255), default=None)
    # moduleId -> { score, total, lastAttemptAt } (epoch ms, best attempt kept)
    module_quizzes: Mapped[dict] = mapped_column(JSON, default=dict)
    # { score, total, lastAttemptAt } | None (best attempt kept)
    final_exam: Mapped[dict | None] = mapped_column(JSON, default=None)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(), default=utc_now_naive, onupdate=utc_now_naive
    )
