"""
Per-user, per-course progress, built on the real schema's four tables
(models/learning_progress.py, assessment.py, final_exam.py) instead of a
single JSON blob — get-or-create plus the handful of mutations the frontend
needs (mark page read, set last page, record a quiz/exam attempt) and a
`to_progress_dict` that flattens all four into the one
{completedPageIds, lastPageId, moduleQuizzes, finalExam} shape
frontend/features/courses/progressStore.js already expects.

Score convention: AssessmentAttempt.score / FinalExamAttempt.score are
0-100 percentages (see assessment.py/final_exam.py docstrings) — the
frontend's own score/total pair is folded into that single percentage on
write (score=pct, total=100) and unfolded the same way on read, so
`isQuizPassed`'s `(score/total)*100 >= PASSING_PCT` check (features/courses/
progress.js) still works unchanged since pct/100*100 == pct.

Retake policy differs by design between the two (see final_exam.py's
docstring): a module's contribution uses the learner's BEST attempt, the
final exam uses the LATEST one.
"""

from sqlalchemy.orm import Session

from learnia_backend.models.assessment import AssessmentAttempt
from learnia_backend.models.enums import AttemptStatus, LearningStatus
from learnia_backend.models.final_exam import FinalExamAttempt
from learnia_backend.models.learning_progress import LearningProgress, PageProgress
from learnia_backend.models.page import Page
from learnia_backend.utils.time import utc_now_naive


def _to_ms(dt) -> int:
    return int(dt.replace(tzinfo=None).timestamp() * 1000) if dt else 0


class ProgressRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_or_create_learning_progress(self, user_id: int, course_id: int) -> LearningProgress:
        progress = (
            self.db.query(LearningProgress)
            .filter(LearningProgress.user_id == user_id, LearningProgress.course_id == course_id)
            .first()
        )
        if progress is None:
            progress = LearningProgress(
                user_id=user_id, course_id=course_id, status=LearningStatus.NOT_STARTED
            )
            self.db.add(progress)
            self.db.commit()
            self.db.refresh(progress)
        return progress

    def set_last_page(self, user_id: int, course_id: int, page_id: int) -> None:
        progress = self.get_or_create_learning_progress(user_id, course_id)
        progress.current_page_id = page_id
        if progress.status == LearningStatus.NOT_STARTED:
            progress.status = LearningStatus.IN_PROGRESS
            progress.started_at = utc_now_naive()
        self.db.commit()

    def mark_page_complete(self, user_id: int, course_id: int, page_id: int) -> None:
        exists = (
            self.db.query(PageProgress)
            .filter(PageProgress.user_id == user_id, PageProgress.page_id == page_id)
            .first()
        )
        if exists is None:
            self.db.add(PageProgress(user_id=user_id, page_id=page_id, course_id=course_id))
            self.db.commit()

        progress = self.get_or_create_learning_progress(user_id, course_id)
        total_pages = self.db.query(Page).filter(Page.course_id == course_id).count()
        completed_pages = (
            self.db.query(PageProgress)
            .filter(PageProgress.user_id == user_id, PageProgress.course_id == course_id)
            .count()
        )
        if total_pages > 0 and completed_pages >= total_pages:
            progress.status = LearningStatus.COMPLETED
            progress.completed_at = utc_now_naive()
        elif progress.status == LearningStatus.NOT_STARTED:
            progress.status = LearningStatus.IN_PROGRESS
            progress.started_at = utc_now_naive()
        self.db.commit()

    def record_module_quiz_attempt(
        self, user_id: int, module_id: int, score: int, total: int
    ) -> None:
        pct = round((score / total) * 100) if total else 0
        self.db.add(
            AssessmentAttempt(
                user_id=user_id,
                module_id=module_id,
                status=AttemptStatus.SUBMITTED,
                submitted_at=utc_now_naive(),
                score=pct,
            )
        )
        self.db.commit()

    def record_final_exam_attempt(
        self, user_id: int, course_id: int, score: int, total: int
    ) -> None:
        pct = round((score / total) * 100) if total else 0
        now = utc_now_naive()
        self.db.add(
            FinalExamAttempt(
                user_id=user_id,
                course_id=course_id,
                status=AttemptStatus.SUBMITTED,
                started_at=now,
                # No real timed session was tracked server-side for this
                # simplified attempt path — ends_at is set to "now", i.e.
                # already expired, which is harmless since nothing reads it
                # for an already-submitted attempt.
                ends_at=now,
                submitted_at=now,
                score=pct,
            )
        )
        self.db.commit()

    def progress_percent(self, user_id: int, course_id: int) -> int:
        """
        Simple page-count progress % (completed pages / total pages) for one
        user+course — same page-count query pattern as mark_page_complete's
        completion check, reused here rather than duplicated, for callers
        (17-dashboard) that only need a percentage, not the full
        to_progress_dict shape.
        """
        total_pages = self.db.query(Page).filter(Page.course_id == course_id).count()
        if total_pages == 0:
            return 0
        completed_pages = (
            self.db.query(PageProgress)
            .filter(PageProgress.user_id == user_id, PageProgress.course_id == course_id)
            .count()
        )
        return round((completed_pages / total_pages) * 100)

    def get_learning_progress(self, user_id: int, course_id: int) -> LearningProgress | None:
        """Read-only lookup (no get-or-create row insert) — for callers like
        the dashboard that only want to know progress if it already exists."""
        return (
            self.db.query(LearningProgress)
            .filter(LearningProgress.user_id == user_id, LearningProgress.course_id == course_id)
            .first()
        )

    def most_recent_in_progress(self, user_id: int) -> LearningProgress | None:
        """The user's IN_PROGRESS course they touched most recently — backs
        the dashboard's "continue learning" card (17-dashboard)."""
        return (
            self.db.query(LearningProgress)
            .filter(
                LearningProgress.user_id == user_id,
                LearningProgress.status == LearningStatus.IN_PROGRESS,
            )
            .order_by(LearningProgress.updated_at.desc())
            .first()
        )

    def to_progress_dict(self, user_id: int, course_id: int, module_ids: list[int]) -> dict:
        progress = self.get_or_create_learning_progress(user_id, course_id)

        completed_page_ids = [
            str(pid)
            for (pid,) in self.db.query(PageProgress.page_id)
            .filter(PageProgress.user_id == user_id, PageProgress.course_id == course_id)
            .all()
        ]

        module_quizzes: dict[str, dict] = {}
        for module_id in module_ids:
            best = (
                self.db.query(AssessmentAttempt)
                .filter(
                    AssessmentAttempt.user_id == user_id,
                    AssessmentAttempt.module_id == module_id,
                    AssessmentAttempt.status == AttemptStatus.SUBMITTED,
                )
                .order_by(AssessmentAttempt.score.desc())
                .first()
            )
            if best is not None:
                module_quizzes[str(module_id)] = {
                    "score": round(best.score or 0),
                    "total": 100,
                    "lastAttemptAt": _to_ms(best.submitted_at),
                }

        latest_final = (
            self.db.query(FinalExamAttempt)
            .filter(
                FinalExamAttempt.user_id == user_id,
                FinalExamAttempt.course_id == course_id,
                FinalExamAttempt.status == AttemptStatus.SUBMITTED,
            )
            .order_by(FinalExamAttempt.submitted_at.desc())
            .first()
        )
        final_exam = (
            {
                "score": round(latest_final.score or 0),
                "total": 100,
                "lastAttemptAt": _to_ms(latest_final.submitted_at),
            }
            if latest_final is not None
            else None
        )

        return {
            "completedPageIds": completed_page_ids,
            "lastPageId": str(progress.current_page_id) if progress.current_page_id else None,
            "moduleQuizzes": module_quizzes,
            "finalExam": final_exam,
        }
