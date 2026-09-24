"""
Dashboard aggregation (17-dashboard) — the landing view's data, composed
entirely from the courses (05-course-system) and progress (08-learning-
progress) systems' own repositories. No new domain logic/tables: this is a
read-model that assembles four things for one user:

  1. "Continue learning" — the IN_PROGRESS course this user touched most
     recently (LearningProgress.updated_at), with its progress % and last
     page. Null if the user has no IN_PROGRESS course.
  2. The full (published) course list, each with this user's learning
     status + progress % on it.
  3. Recommendations — per the master context's resolved v1 rule: courses
     with content_status READY or PUBLISHED where this user's
     learning_status is NOT_STARTED, sorted by course id (creation order).
     Note this deliberately looks at READY courses too, not just PUBLISHED
     ones, so it queries Course directly rather than reusing
     CourseRepository.list_published() (PUBLISHED-only).
  4. Stats — in-progress count, completed count, total (published) courses
     available. No time-tracking in v1 (see prompts.md's resolved question).
"""

from sqlalchemy.orm import Session

from learnia_backend.models.course import Course
from learnia_backend.models.enums import ContentStatus, LearningStatus
from learnia_backend.models.page import Page
from learnia_backend.repositories.course_repository import CourseRepository
from learnia_backend.repositories.progress_repository import ProgressRepository, has_unseen_update


def _page_title(db: Session, page_id: int | None) -> str | None:
    if page_id is None:
        return None
    page = db.get(Page, page_id)
    return page.title if page is not None else None


def get_dashboard(db: Session, user_id: int) -> dict:
    course_repo = CourseRepository(db)
    progress_repo = ProgressRepository(db)

    published = course_repo.list_published()

    # (2) course list: this user's status + progress % on every published course.
    courses_out = []
    status_by_course_id: dict[int, LearningStatus] = {}
    for course in published:
        progress = progress_repo.get_learning_progress(user_id, course.id)
        status = progress.status if progress is not None else LearningStatus.NOT_STARTED
        status_by_course_id[course.id] = status
        pct = progress_repo.progress_percent(user_id, course.id)
        courses_out.append(
            {
                **course_repo.course_summary(course),
                "learningStatus": status.value,
                "progressPct": pct,
                "hasUnseenUpdate": has_unseen_update(course, progress),
            }
        )

    # (4) stats.
    stats_out = {
        "inProgressCount": sum(
            1 for s in status_by_course_id.values() if s == LearningStatus.IN_PROGRESS
        ),
        "completedCount": sum(
            1 for s in status_by_course_id.values() if s == LearningStatus.COMPLETED
        ),
        "totalCount": len(published),
    }

    # (1) continue learning: most recently updated IN_PROGRESS row, across
    # ALL courses this user has progress on (not just the published list
    # above, though in practice progress only exists on courses that were
    # published/ready when the user started them).
    continue_out = None
    latest = progress_repo.most_recent_in_progress(user_id)
    if latest is not None:
        course = course_repo.get_by_id(latest.course_id)
        if course is not None:
            continue_out = {
                "course": course_repo.course_summary(course),
                "progressPct": progress_repo.progress_percent(user_id, course.id),
                "lastPageId": str(latest.current_page_id) if latest.current_page_id else None,
                "lastPageTitle": _page_title(db, latest.current_page_id),
            }

    # (3) recommendations: READY or PUBLISHED content, NOT_STARTED for this
    # user, sorted by course id (creation order).
    candidates = (
        db.query(Course)
        .filter(Course.content_status.in_([ContentStatus.READY, ContentStatus.PUBLISHED]))
        .order_by(Course.id)
        .all()
    )
    recommendations_out = [
        course_repo.course_summary(c)
        for c in candidates
        if _is_not_started(progress_repo, status_by_course_id, user_id, c.id)
    ]

    return {
        "continueLearning": continue_out,
        "courses": courses_out,
        "recommendations": recommendations_out,
        "stats": stats_out,
    }


def _is_not_started(
    progress_repo: ProgressRepository,
    status_by_course_id: dict[int, LearningStatus],
    user_id: int,
    course_id: int,
) -> bool:
    """Recommendation-rule predicate: true when this user's learning_status
    on this course is NOT_STARTED (or there's no progress row at all, which
    means the same thing). Consults the already-fetched published-course
    status map first to avoid re-querying; falls back to a direct lookup for
    a READY course that isn't in the published list."""
    if course_id in status_by_course_id:
        return status_by_course_id[course_id] == LearningStatus.NOT_STARTED
    progress = progress_repo.get_learning_progress(user_id, course_id)
    return progress is None or progress.status == LearningStatus.NOT_STARTED
