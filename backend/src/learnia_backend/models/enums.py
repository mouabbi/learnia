"""
Shared state-machine enums for the course/content/assessment domain.

Kept in one module (rather than inline per model) because ContentStatus and
LearningStatus in particular are easy to confuse and must never be merged
into a single column — see course.py and learning_progress.py docstrings.
Stored via `sqlalchemy.Enum(..., native_enum=False)`: a plain VARCHAR + CHECK
constraint, not SQLite/Postgres's native ENUM type, so this stays portable
if 04-database's "path to Postgres later" ever happens.
"""

import enum


class ContentStatus(str, enum.Enum):
    """A course's authoring/publishing lifecycle. Nothing to do with any
    individual learner's progress — see LearningStatus for that."""

    PLANNED = "planned"
    DRAFT = "draft"
    READY = "ready"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class LearningStatus(str, enum.Enum):
    """One learner's progress through one course. Nothing to do with the
    course's own content_status — see ContentStatus for that."""

    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class QuestionScope(str, enum.Enum):
    """Which kind of attempt a question belongs to (09/10: one shared
    `questions` table, discriminated by scope, instead of two tables)."""

    MODULE_ASSESSMENT = "module_assessment"
    FINAL_EXAM = "final_exam"


class AttemptStatus(str, enum.Enum):
    """Shared by AssessmentAttempt and FinalExamAttempt. Module assessments
    never reach AUTO_SUBMITTED (no timer per 09); final exams can (10's
    server-authoritative timer)."""

    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    AUTO_SUBMITTED = "auto_submitted"
