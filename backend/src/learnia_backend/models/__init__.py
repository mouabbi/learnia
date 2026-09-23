"""
Import every model here so Alembic's autogenerate (and Base.metadata) sees
them all. A model defined but never imported anywhere is invisible to
SQLAlchemy's metadata and silently excluded from migrations.
"""

from learnia_backend.models.assessment import AssessmentAnswer, AssessmentAttempt
from learnia_backend.models.asset import Asset
from learnia_backend.models.audit_event import AuditEvent
from learnia_backend.models.chapter import Chapter
from learnia_backend.models.course import Course
from learnia_backend.models.enums import (
    AttemptStatus,
    ContentStatus,
    LearningStatus,
    QuestionScope,
)
from learnia_backend.models.final_exam import FinalExamAnswer, FinalExamAttempt
from learnia_backend.models.learning_progress import LearningProgress, PageProgress
from learnia_backend.models.mfa import MfaRecoveryCode, MfaSecret
from learnia_backend.models.module import Module
from learnia_backend.models.note import Note
from learnia_backend.models.one_time_token import OneTimeToken
from learnia_backend.models.page import Page
from learnia_backend.models.question import Question
from learnia_backend.models.session import UserSession
from learnia_backend.models.user import User

__all__ = [
    "Asset",
    "AssessmentAnswer",
    "AssessmentAttempt",
    "AttemptStatus",
    "AuditEvent",
    "Chapter",
    "ContentStatus",
    "Course",
    "FinalExamAnswer",
    "FinalExamAttempt",
    "LearningProgress",
    "LearningStatus",
    "MfaRecoveryCode",
    "MfaSecret",
    "Module",
    "Note",
    "OneTimeToken",
    "Page",
    "PageProgress",
    "Question",
    "QuestionScope",
    "User",
    "UserSession",
]
