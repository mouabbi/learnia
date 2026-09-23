"""
Course content + a logged-in learner's progress through it — built on the
real normalized schema (see repositories/course_repository.py and
repositories/progress_repository.py's module docstrings for how that maps
onto the flat shapes the frontend expects).

GET endpoints (course catalog/detail) are public read-only content, and
only ever return PUBLISHED courses (content_status — see models/course.py).
Progress endpoints require a logged-in user (see deps.get_current_user)
since progress is per-user.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DbSession

from learnia_backend.database import get_db
from learnia_backend.deps import get_current_user
from learnia_backend.exceptions import NotFoundError, ValidationAppError
from learnia_backend.models.module import Module
from learnia_backend.models.user import User
from learnia_backend.repositories.course_repository import CourseRepository
from learnia_backend.repositories.progress_repository import ProgressRepository
from learnia_backend.schemas.courses import (
    CourseDetail,
    CourseSummary,
    FinalExamAttemptRequest,
    MarkPageCompleteRequest,
    ModuleQuizAttemptRequest,
    ProgressResponse,
    SetLastPageRequest,
)

router = APIRouter(prefix="/api/v1/courses", tags=["courses"])


def _module_ids_for(db: DbSession, course_id: int) -> list[int]:
    return [mid for (mid,) in db.query(Module.id).filter(Module.course_id == course_id).all()]


def _require_int(raw: str, what: str) -> int:
    try:
        return int(raw)
    except ValueError as exc:
        raise ValidationAppError(f"Invalid {what}: {raw!r}") from exc


@router.get("", response_model=list[CourseSummary])
def list_courses(db: DbSession = Depends(get_db)) -> list[CourseSummary]:
    repo = CourseRepository(db)
    return [CourseSummary(**repo.course_summary(c)) for c in repo.list_published()]


@router.get("/{slug}", response_model=CourseDetail)
def get_course(slug: str, db: DbSession = Depends(get_db)) -> CourseDetail:
    repo = CourseRepository(db)
    course = repo.get_by_slug(slug)
    if course is None:
        raise NotFoundError(f"Course not found: {slug}")
    return CourseDetail(**repo.course_detail(course))


@router.get("/{course_id}/progress", response_model=ProgressResponse)
def get_progress(
    course_id: int,
    db: DbSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProgressResponse:
    repo = ProgressRepository(db)
    module_ids = _module_ids_for(db, course_id)
    return ProgressResponse(**repo.to_progress_dict(user.id, course_id, module_ids))


@router.post("/{course_id}/progress/last-page", response_model=ProgressResponse)
def set_last_page(
    course_id: int,
    body: SetLastPageRequest,
    db: DbSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProgressResponse:
    repo = ProgressRepository(db)
    repo.set_last_page(user.id, course_id, _require_int(body.page_id, "pageId"))
    module_ids = _module_ids_for(db, course_id)
    return ProgressResponse(**repo.to_progress_dict(user.id, course_id, module_ids))


@router.post("/{course_id}/progress/complete-page", response_model=ProgressResponse)
def mark_page_complete(
    course_id: int,
    body: MarkPageCompleteRequest,
    db: DbSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProgressResponse:
    repo = ProgressRepository(db)
    repo.mark_page_complete(user.id, course_id, _require_int(body.page_id, "pageId"))
    module_ids = _module_ids_for(db, course_id)
    return ProgressResponse(**repo.to_progress_dict(user.id, course_id, module_ids))


@router.post("/{course_id}/progress/module-quiz", response_model=ProgressResponse)
def record_module_quiz_attempt(
    course_id: int,
    body: ModuleQuizAttemptRequest,
    db: DbSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProgressResponse:
    repo = ProgressRepository(db)
    module_id = _require_int(body.module_id, "moduleId")
    repo.record_module_quiz_attempt(user.id, module_id, body.score, body.total)
    module_ids = _module_ids_for(db, course_id)
    return ProgressResponse(**repo.to_progress_dict(user.id, course_id, module_ids))


@router.post("/{course_id}/progress/final-exam", response_model=ProgressResponse)
def record_final_exam_attempt(
    course_id: int,
    body: FinalExamAttemptRequest,
    db: DbSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProgressResponse:
    repo = ProgressRepository(db)
    repo.record_final_exam_attempt(user.id, course_id, body.score, body.total)
    module_ids = _module_ids_for(db, course_id)
    return ProgressResponse(**repo.to_progress_dict(user.id, course_id, module_ids))
