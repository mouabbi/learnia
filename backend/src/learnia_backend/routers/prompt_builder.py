"""
AI prompt-builder endpoints (12-ai-prompt-builder). CMS-only (same auth gate
as course_structure.py) — returns copy-pasteable prompt text for the user
to paste into an external AI chat tool; never calls any AI API itself.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session as DbSession

from learnia_backend.database import get_db
from learnia_backend.deps import get_current_user
from learnia_backend.exceptions import ValidationAppError
from learnia_backend.models.user import User
from learnia_backend.schemas.prompt_builder import SCOPES
from learnia_backend.services.prompt_builder import PromptBuilderService

router = APIRouter(prefix="/api/v1/courses", tags=["prompt-builder"])


def _check_scope(scope: str) -> None:
    if scope not in SCOPES:
        raise ValidationAppError(f"Unknown scope: {scope!r}. Must be one of {SCOPES}")


@router.get("/{course_id}/prompts/{scope}")
def build_prompt(
    course_id: int,
    scope: str,
    module_id: int | None = Query(default=None, alias="moduleId"),
    chapter_id: int | None = Query(default=None, alias="chapterId"),
    db: DbSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> dict:
    _check_scope(scope)
    service = PromptBuilderService(db)
    prompt = service.build(scope, course_id, module_id=module_id, chapter_id=chapter_id)
    return {"prompt": prompt}


@router.get("/{course_id}/prompts/{scope}/schema")
def prompt_schema(
    course_id: int,  # noqa: ARG001 - kept for URL symmetry with build_prompt
    scope: str,
    db: DbSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> dict:
    _check_scope(scope)
    return PromptBuilderService(db).schema_for(scope)
