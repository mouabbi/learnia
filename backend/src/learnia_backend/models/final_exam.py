"""
Final exam attempts — structurally a near-twin of AssessmentAttempt/
AssessmentAnswer (assessment.py), but kept as its own pair of tables rather
than reused, because the two differ in ways worth keeping structurally
distinct rather than papered over with a shared "kind" column:

  - Retake scoring is OPPOSITE: a module's contribution to globalScore uses
    the learner's BEST attempt; the final exam uses the LATEST attempt.
    Getting this backwards for either is a real scoring bug, so the two
    living in separate tables makes "which query am I writing" unambiguous.
  - The final exam has a server-authoritative timer (`ends_at`, set at
    start, checked server-side — never trust a client countdown) and a
    third terminal status, AUTO_SUBMITTED, for timeout. Module assessments
    have no timer at all.

`globalScore = moduleAssessmentAverage * 0.20 + finalExamScore * 0.80` is
computed by a scoring service reading both tables — not stored here.
"""

from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, UniqueConstraint
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import Mapped, mapped_column

from learnia_backend.database import Base
from learnia_backend.models.enums import AttemptStatus
from learnia_backend.utils.time import utc_now_naive


class FinalExamAttempt(Base):
    __tablename__ = "final_exam_attempts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[AttemptStatus] = mapped_column(
        SqlEnum(AttemptStatus, native_enum=False, length=20, validate_strings=True),
        default=AttemptStatus.IN_PROGRESS,
        index=True,
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(), default=utc_now_naive)
    # Server-authoritative deadline, set once at start_at + exam duration.
    # The client shows a countdown against this; the server is what actually
    # enforces it and auto-submits past it.
    ends_at: Mapped[datetime] = mapped_column(DateTime())
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(), default=None)
    score: Mapped[float | None] = mapped_column(Float(), default=None)


class FinalExamAnswer(Base):
    __tablename__ = "final_exam_answers"
    __table_args__ = (
        UniqueConstraint("attempt_id", "question_id", name="uq_final_exam_answer_attempt_question"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    attempt_id: Mapped[int] = mapped_column(
        ForeignKey("final_exam_attempts.id", ondelete="CASCADE"), index=True
    )
    question_id: Mapped[int] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int] = mapped_column(Integer())
    selected_option_ids: Mapped[list] = mapped_column(JSON(), default=list)
    is_correct: Mapped[bool | None] = mapped_column(default=None)
