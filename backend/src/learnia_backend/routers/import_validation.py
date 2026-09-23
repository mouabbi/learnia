"""
AI JSON import endpoints (13-ai-content-import-validation): a two-step
validate-then-commit per scope. validate() never writes; commit() always
re-validates itself first (never trusts the client called validate), then
writes via the same services/repositories the hand-authored CMS forms use.
CMS-only (same auth gate as course_structure.py).
"""

from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy.orm import Session as DbSession

from learnia_backend.database import get_db
from learnia_backend.deps import get_current_user
from learnia_backend.exceptions import ValidationAppError
from learnia_backend.models.user import User
from learnia_backend.schemas.import_validation import ImportValidateResult
from learnia_backend.schemas.prompt_builder import SCOPES
from learnia_backend.services.import_service import ImportService

router = APIRouter(prefix="/api/v1/courses", tags=["import-validation"])


def _check_scope(scope: str) -> None:
    if scope not in SCOPES:
        raise ValidationAppError(f"Unknown scope: {scope!r}. Must be one of {SCOPES}")


@router.post("/{course_id}/import/{scope}/validate", response_model=ImportValidateResult)
def validate_import(
    course_id: int,  # noqa: ARG001 - kept for URL symmetry / future course-scoped checks
    scope: str,
    body: dict = Body(...),
    db: DbSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> ImportValidateResult:
    _check_scope(scope)
    raw = body.get("json", "")
    return ImportService(db).validate(scope, raw)


@router.post("/{course_id}/import/{scope}/commit")
def commit_import(
    course_id: int,
    scope: str,
    body: dict = Body(...),
    module_id: int | None = Query(default=None, alias="moduleId"),
    chapter_id: int | None = Query(default=None, alias="chapterId"),
    page_id: int | None = Query(default=None, alias="pageId"),
    db: DbSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> dict:
    _check_scope(scope)
    raw = body.get("json", "")
    replace = bool(body.get("replace", False))
    service = ImportService(db)

    if scope == "course":
        return service.commit_course(course_id, raw)
    if scope == "module":
        # moduleId is optional here: absent, this creates a brand-new
        # module (see ImportService.commit_module); present, it retitles
        # (and, going forward, could re-sync) an existing one.
        return service.commit_module(course_id, module_id, raw)
    if scope == "chapter":
        if chapter_id is None:
            raise ValidationAppError("chapterId is required for scope=chapter")
        return service.commit_chapter(chapter_id, raw)
    if scope == "page":
        if page_id is None:
            raise ValidationAppError("pageId is required for scope=page")
        return {"content": service.commit_page(page_id, raw, replace=replace)}
    if scope in ("module-qcm", "final-exam"):
        created = service.commit_questions(
            scope,
            course_id=course_id,
            module_id=module_id,
            replace=replace,
            raw_json=raw,
        )
        return {"created": created}
    raise ValidationAppError(f"Unknown scope: {scope!r}")
