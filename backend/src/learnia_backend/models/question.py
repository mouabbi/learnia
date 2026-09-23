"""
One shared `questions` table for both module assessments and the final
exam, discriminated by `scope` (09/10's "reuse the question model with a
scope discriminator" option) — one Pydantic schema, one authoring UI, one
place to fix a scoring bug, instead of duplicating module/final-exam
question models that would inevitably drift apart.

`module_id` is set only for MODULE_ASSESSMENT-scope questions (a module's
question bank); `course_id` is always set (a final exam's questions belong
directly to a course, module questions' course is reachable via module_id
but stored here too for uniform course-scoped queries without a join).

Multiple-choice, possibly multi-answer: `options` is an ordered JSON list of
`{id, text}`; `correct_option_ids` is a JSON list of option ids (single-
answer questions just have one entry). Never exposed to the frontend as-is
for an in-progress attempt — the API layer strips `correct_option_ids` and
`explanation` until the attempt is submitted.
"""

from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import Mapped, mapped_column

from learnia_backend.database import Base
from learnia_backend.models.enums import QuestionScope
from learnia_backend.utils.time import utc_now_naive


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    scope: Mapped[QuestionScope] = mapped_column(
        SqlEnum(QuestionScope, native_enum=False, length=20, validate_strings=True), index=True
    )
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), index=True
    )
    # Only set for scope=MODULE_ASSESSMENT.
    module_id: Mapped[int | None] = mapped_column(
        ForeignKey("modules.id", ondelete="CASCADE"), index=True, default=None
    )
    text: Mapped[str] = mapped_column(Text())
    options: Mapped[list] = mapped_column(JSON())  # [{"id": "...", "text": "..."}, ...]
    correct_option_ids: Mapped[list] = mapped_column(JSON())  # ["opt_id", ...]
    explanation: Mapped[str | None] = mapped_column(Text(), default=None)
    difficulty: Mapped[str | None] = mapped_column(String(20), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(), default=utc_now_naive)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(), default=utc_now_naive, onupdate=utc_now_naive
    )
