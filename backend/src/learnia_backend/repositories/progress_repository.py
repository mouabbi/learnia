"""
Per-user, per-course progress — get-or-create plus the handful of mutations
the frontend needs (mark page read, set last page, record a quiz/exam
attempt). Mirrors what frontend/features/courses/progressStore.js used to
do against localStorage.
"""

from sqlalchemy.orm import Session

from learnia_backend.models.course import CourseProgress
from learnia_backend.utils.time import utc_now_naive


def _now_ms() -> int:
    return int(utc_now_naive().timestamp() * 1000)


class ProgressRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_or_create(self, user_id: int, course_id: int) -> CourseProgress:
        progress = (
            self.db.query(CourseProgress)
            .filter(CourseProgress.user_id == user_id, CourseProgress.course_id == course_id)
            .first()
        )
        if progress is None:
            progress = CourseProgress(
                user_id=user_id,
                course_id=course_id,
                completed_page_ids=[],
                module_quizzes={},
            )
            self.db.add(progress)
            self.db.commit()
            self.db.refresh(progress)
        return progress

    def set_last_page(self, progress: CourseProgress, page_id: str) -> CourseProgress:
        progress.last_page_id = page_id
        self.db.commit()
        self.db.refresh(progress)
        return progress

    def mark_page_complete(self, progress: CourseProgress, page_id: str) -> CourseProgress:
        if page_id not in progress.completed_page_ids:
            # Reassign (not .append) — SQLAlchemy only detects a JSON column
            # as "changed" on attribute assignment, not in-place mutation.
            progress.completed_page_ids = [*progress.completed_page_ids, page_id]
            self.db.commit()
            self.db.refresh(progress)
        return progress

    # Keeps the best-scoring attempt (so a strong first try isn't erased by
    # a worse retake) but always bumps lastAttemptAt — the retake cooldown
    # (see frontend/features/courses/progress.js) is based on the most
    # recent attempt regardless of its score.
    def record_module_quiz_attempt(
        self, progress: CourseProgress, module_id: str, score: int, total: int
    ) -> CourseProgress:
        previous = progress.module_quizzes.get(module_id)
        best = previous if previous and previous["score"] >= score else {"score": score, "total": total}
        attempt = {**best, "lastAttemptAt": _now_ms()}
        progress.module_quizzes = {**progress.module_quizzes, module_id: attempt}
        self.db.commit()
        self.db.refresh(progress)
        return progress

    def record_final_exam_attempt(
        self, progress: CourseProgress, score: int, total: int
    ) -> CourseProgress:
        previous = progress.final_exam
        best = previous if previous and previous["score"] >= score else {"score": score, "total": total}
        progress.final_exam = {**best, "lastAttemptAt": _now_ms()}
        self.db.commit()
        self.db.refresh(progress)
        return progress
