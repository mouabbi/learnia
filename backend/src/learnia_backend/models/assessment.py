"""
Module assessment attempts. One `AssessmentAttempt` per attempt (unlimited
retakes allowed per 09-assessment-qcm; the module's contribution to
globalScore uses the BEST attempt's score — contrast FinalExamAttempt, which
uses the LATEST attempt instead, see final_exam.py's docstring on that
asymmetry). `AssessmentAnswer` rows record exactly which questions were
shown (randomized subset if the bank exceeds the ~50 minimum) and what was
selected, so a submitted attempt is fully reconstructable for review.
"""

from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, UniqueConstraint
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import Mapped, mapped_column

from learnia_backend.database import Base
from learnia_backend.models.enums import AttemptStatus
from learnia_backend.utils.time import utc_now_naive


class AssessmentAttempt(Base):
    __tablename__ = "assessment_attempts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    module_id: Mapped[int] = mapped_column(
        ForeignKey("modules.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[AttemptStatus] = mapped_column(
        SqlEnum(AttemptStatus, native_enum=False, length=20, validate_strings=True),
        default=AttemptStatus.IN_PROGRESS,
        index=True,
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(), default=utc_now_naive)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(), default=None)
    # 0-100. Null until submitted.
    score: Mapped[float | None] = mapped_column(Float(), default=None)


class AssessmentAnswer(Base):
    __tablename__ = "assessment_answers"
    __table_args__ = (
        UniqueConstraint("attempt_id", "question_id", name="uq_assessment_answer_attempt_question"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    attempt_id: Mapped[int] = mapped_column(
        ForeignKey("assessment_attempts.id", ondelete="CASCADE"), index=True
    )
    question_id: Mapped[int] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), index=True
    )
    # The order this question was shown in THIS attempt (questions/options
    # are shuffled per attempt) — needed to reconstruct the attempt for review.
    position: Mapped[int] = mapped_column(Integer())
    selected_option_ids: Mapped[list] = mapped_column(JSON(), default=list)
    # Null until the attempt is submitted and scored.
    is_correct: Mapped[bool | None] = mapped_column(default=None)
