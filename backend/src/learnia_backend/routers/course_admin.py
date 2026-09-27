"""
Admin-only course lifecycle management: create/list-all/update/delete a
course's own metadata and status. Everything under modules/chapters/pages
already has CRUD (routers/course_structure.py) — this router is what was
missing above that: there was previously no way to create a course at all,
or to see/publish/archive/delete one, only to edit an existing course's
insides once a row already existed in the database.

Every route is gated by require_admin (see deps.py), not just
get_current_user — this is CMS-only surface, never called by the learner
app.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DbSession

from learnia_backend.database import get_db
from learnia_backend.deps import require_admin
from learnia_backend.exceptions import NotFoundError, ValidationAppError
from learnia_backend.models.user import User
from learnia_backend.repositories.course_repository import CourseRepository
from learnia_backend.schemas.courses import (
    CourseAdminSummary,
    CourseCreateRequest,
    CourseUpdateRequest,
)

router = APIRouter(prefix="/api/v1/cms/courses", tags=["cms-courses"])


def _admin_summary(course) -> CourseAdminSummary:
    return CourseAdminSummary(
        id=course.id,
        slug=course.slug,
        title=course.title,
        description=course.description or "",
        content_status=course.content_status.value,
    )


@router.get("", response_model=list[CourseAdminSummary])
def list_all_courses(
    db: DbSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> list[CourseAdminSummary]:
    repo = CourseRepository(db)
    return [_admin_summary(c) for c in repo.list_all()]


@router.post("", response_model=CourseAdminSummary, status_code=201)
def create_course(
    body: CourseCreateRequest,
    db: DbSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> CourseAdminSummary:
    repo = CourseRepository(db)
    if repo.get_by_slug(body.slug) is not None:
        raise ValidationAppError(f"A course with slug '{body.slug}' already exists")
    try:
        course = repo.create(
            slug=body.slug, title=body.title, description=body.description, icon=body.icon
        )
    except IntegrityError as exc:
        raise ValidationAppError(f"A course with slug '{body.slug}' already exists") from exc
    return _admin_summary(course)


@router.patch("/{course_id}", response_model=CourseAdminSummary)
def update_course(
    course_id: int,
    body: CourseUpdateRequest,
    db: DbSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> CourseAdminSummary:
    repo = CourseRepository(db)
    course = repo.get_by_id(course_id)
    if course is None:
        raise NotFoundError(f"Course not found: {course_id}")
    course = repo.update_metadata(
        course,
        title=body.title,
        description=body.description,
        icon=body.icon,
        content_status=body.content_status,
    )
    return _admin_summary(course)


@router.delete("/{course_id}", status_code=204)
def delete_course(
    course_id: int,
    db: DbSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> None:
    repo = CourseRepository(db)
    course = repo.get_by_id(course_id)
    if course is None:
        raise NotFoundError(f"Course not found: {course_id}")
    repo.delete(course)
