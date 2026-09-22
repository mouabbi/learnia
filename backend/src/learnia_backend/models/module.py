"""
Module — first level of a course's structure (Course -> Module -> Chapter ->
Page; see chapter.py/page.py). "Module 1", "Module 2" numbering is computed
from `position` at read time, never stored redundantly (06-course-structure).

Order is a plain integer `position`, renumbered on move rather than
fractional/lexicographic keys — reordering is rare per 04-database's
decision, so a short renumber on the occasional move is simpler to reason
about than keeping gapped/fractional keys consistent forever.
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from learnia_backend.database import Base
from learnia_backend.utils.time import utc_now_naive


class Module(Base):
    __tablename__ = "modules"

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(200))
    position: Mapped[int] = mapped_column(Integer())
    created_at: Mapped[datetime] = mapped_column(DateTime(), default=utc_now_naive)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(), default=utc_now_naive, onupdate=utc_now_naive
    )
