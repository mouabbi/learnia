"""
Course content + a logged-in learner's progress through it.

GET endpoints (course catalog/detail) are public read-only content.
Progress endpoints require a logged-in user (see deps.get_current_user)
since progress is per-user — one CourseProgress row per (user, course).
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DbSession

from learnia_backend.database import get_db
from learnia_backend.deps import get_current_user
from learnia_backend.exceptions import NotFoundError
from learnia_backend.models.course import Course, CourseProgress
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


def _course_summary(course: Course) -> CourseSummary:
    return CourseSummary(
        id=course.id,
        slug=course.slug,
        title=course.title,
        description=course.description,
        icon=course.icon,
        image=course.image,
        color=course.color,
        difficulty=course.difficulty,
        estimated_minutes=course.estimated_minutes,
    )


def _course_detail(course: Course) -> CourseDetail:
    return CourseDetail(
        **_course_summary(course).model_dump(),
        modules=(course.content or {}).get("modules", []),
        final_exam=(course.content or {}).get("finalExam"),
    )


def _progress_response(progress: CourseProgress) -> ProgressResponse:
    return ProgressResponse(
        completed_page_ids=progress.completed_page_ids,
        last_page_id=progress.last_page_id,
        module_quizzes=progress.module_quizzes,
        final_exam=progress.final_exam,
    )


@router.get("", response_model=list[CourseSummary])
def list_courses(db: DbSession = Depends(get_db)) -> list[CourseSummary]:
    courses = CourseRepository(db).list_all()
    return [_course_summary(c) for c in courses]


@router.get("/{slug}", response_model=CourseDetail)
def get_course(slug: str, db: DbSession = Depends(get_db)) -> CourseDetail:
    course = CourseRepository(db).get_by_slug(slug)
    if course is None:
        raise NotFoundError(f"Course not found: {slug}")
    return _course_detail(course)


@router.get("/{course_id}/progress", response_model=ProgressResponse)
def get_progress(
    course_id: int,
    db: DbSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProgressResponse:
    progress = ProgressRepository(db).get_or_create(user.id, course_id)
    return _progress_response(progress)


@router.post("/{course_id}/progress/last-page", response_model=ProgressResponse)
def set_last_page(
    course_id: int,
    body: SetLastPageRequest,
    db: DbSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProgressResponse:
    repo = ProgressRepository(db)
    progress = repo.get_or_create(user.id, course_id)
    progress = repo.set_last_page(progress, body.page_id)
    return _progress_response(progress)


@router.post("/{course_id}/progress/complete-page", response_model=ProgressResponse)
def mark_page_complete(
    course_id: int,
    body: MarkPageCompleteRequest,
    db: DbSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProgressResponse:
    repo = ProgressRepository(db)
    progress = repo.get_or_create(user.id, course_id)
    progress = repo.mark_page_complete(progress, body.page_id)
    return _progress_response(progress)


@router.post("/{course_id}/progress/module-quiz", response_model=ProgressResponse)
def record_module_quiz_attempt(
    course_id: int,
    body: ModuleQuizAttemptRequest,
    db: DbSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProgressResponse:
    repo = ProgressRepository(db)
    progress = repo.get_or_create(user.id, course_id)
    progress = repo.record_module_quiz_attempt(progress, body.module_id, body.score, body.total)
    return _progress_response(progress)


@router.post("/{course_id}/progress/final-exam", response_model=ProgressResponse)
def record_final_exam_attempt(
    course_id: int,
    body: FinalExamAttemptRequest,
    db: DbSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProgressResponse:
    repo = ProgressRepository(db)
    progress = repo.get_or_create(user.id, course_id)
    progress = repo.record_final_exam_attempt(progress, body.score, body.total)
    return _progress_response(progress)
