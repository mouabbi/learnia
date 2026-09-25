"""
AI JSON import endpoints (13-ai-content-import-validation): a two-step
validate-then-commit per scope. validate() never writes; commit() always
re-validates itself first (never trusts the client called validate), then
writes via the same services/repositories the hand-authored CMS forms use.
CMS-only (same auth gate as course_structure.py).
"""

import json

from fastapi import APIRouter, Body, Depends, Query, UploadFile
from sqlalchemy.orm import Session as DbSession

from learnia_backend.database import get_db
from learnia_backend.deps import get_current_user
from learnia_backend.exceptions import NotFoundError, ValidationAppError
from learnia_backend.models.course import Course
from learnia_backend.models.module import Module
from learnia_backend.models.user import User
from learnia_backend.schemas.import_validation import ImportValidateResult
from learnia_backend.schemas.prompt_builder import SCOPES, BatchGenerateRequest
from learnia_backend.services.batch_zip import to_zip_error_paths, unpack_batch_zip
from learnia_backend.services.import_service import ImportService

router = APIRouter(prefix="/api/v1/courses", tags=["import-validation"])


def _check_scope(scope: str) -> None:
    if scope not in SCOPES:
        raise ValidationAppError(f"Unknown scope: {scope!r}. Must be one of {SCOPES}")



# -- batch (12/13's "Generate All" flow) --------------------------------
# NOT part of SCOPES/_check_scope above: batch validates/commits several
# targets (modules + optionally the final exam) in one call from one
# combined JSON response, a different shape than every other scope's
# one-target-one-schema assumption, so it gets its own dedicated routes
# instead of being shoehorned into the generic {scope} routes.


def _batch_selections(body: dict) -> BatchGenerateRequest:
    return BatchGenerateRequest.model_validate(body)


@router.post("/{course_id}/import/batch/validate", response_model=ImportValidateResult)
def validate_batch_import(
    course_id: int,  # noqa: ARG001 - kept for URL symmetry with the other routes
    body: dict = Body(...),
    db: DbSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> ImportValidateResult:
    raw = body.get("json", "")
    selections = _batch_selections(body)
    return ImportService(db).validate_batch(
        raw,
        module_content_ids=selections.module_content_ids,
        module_qcm_ids=selections.module_qcm_ids,
        include_final_exam=selections.include_final_exam,
    )


@router.post("/{course_id}/import/batch/zip")
async def unpack_batch_zip_import(
    course_id: int,
    file: UploadFile,
    db: DbSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> dict:
    """Unpacks the AI's zip (one folder per module + root final-exam.json,
    see services/batch_zip.py), maps folders to modules, and validates the
    result exactly like a pasted batch JSON. Never writes: the response
    carries the rebuilt `json` + selections, which the client sends to
    /import/batch/commit unchanged once the user has reviewed the mapping."""
    if db.get(Course, course_id) is None:
        raise NotFoundError(f"Course not found: {course_id}")
    modules = (
        db.query(Module).filter(Module.course_id == course_id).order_by(Module.position).all()
    )
    unpacked = unpack_batch_zip(await file.read(), modules)
    raw = json.dumps(unpacked.payload)

    errors = list(unpacked.errors)
    parsed = None
    if unpacked.payload:
        result = ImportService(db).validate_batch(
            raw,
            module_content_ids=unpacked.module_content_ids,
            module_qcm_ids=unpacked.module_qcm_ids,
            include_final_exam=unpacked.include_final_exam,
        )
        errors += to_zip_error_paths(result.errors, unpacked.source_paths)
        parsed = result.parsed

    return {
        "valid": not errors,
        "errors": [e.model_dump() for e in errors],
        "warnings": unpacked.warnings,
        "parsed": parsed,
        "json": raw,
        "selections": {
            "moduleContentIds": unpacked.module_content_ids,
            "moduleQcmIds": unpacked.module_qcm_ids,
            "includeFinalExam": unpacked.include_final_exam,
        },
        "mappings": [
            {
                "folder": m.folder,
                "moduleId": m.module_id,
                "moduleTitle": m.module_title,
                "hasContent": m.has_content,
                "hasQuiz": m.has_quiz,
                "ignoredFiles": m.ignored_files,
            }
            for m in unpacked.mappings
        ],
    }


@router.post("/{course_id}/import/batch/commit")
def commit_batch_import(
    course_id: int,
    body: dict = Body(...),
    db: DbSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> dict:
    raw = body.get("json", "")
    replace = bool(body.get("replace", False))
    selections = _batch_selections(body)
    return ImportService(db).commit_batch(
        course_id,
        raw,
        module_content_ids=selections.module_content_ids,
        module_qcm_ids=selections.module_qcm_ids,
        include_final_exam=selections.include_final_exam,
        replace=replace,
    )


# -- generic single-scope routes ----------------------------------------
# Registered AFTER the batch routes on purpose: `{scope}` would otherwise
# match the literal "batch" segment first and reject it as an unknown scope.


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
        # chapterId -> retitle that chapter; only moduleId -> "Add chapter
        # with AI" on a module, creating the chapter + its pages.
        return service.commit_chapter(chapter_id, raw, module_id=module_id)
    if scope == "page":
        if page_id is None:
            raise ValidationAppError("pageId is required for scope=page")
        return {"content": service.commit_page(page_id, raw, replace=replace)}
    if scope == "module-content":
        if module_id is None:
            raise ValidationAppError("moduleId is required for scope=module-content")
        return service.commit_module_content(module_id, raw, replace=replace)
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
