"""
CMS-facing mutations for a course's structure (Module/Chapter/Page —
06-course-structure): add/rename/delete/move nodes and reorder within a
parent. Separate from routers/courses.py, which stays the public,
read-only + per-user-progress surface.

Gated by get_current_user — this app is single-user, so "logged in" is the
only authoring gate that exists today; a real role check can replace this
later if more users are ever added.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DbSession

from learnia_backend.database import get_db
from learnia_backend.deps import get_current_user
from learnia_backend.exceptions import ValidationAppError
from learnia_backend.models.user import User
from learnia_backend.repositories.structure_repository import StructureRepository
from learnia_backend.schemas.courses import (
    ChapterAdminOut,
    CreateChapterRequest,
    CreateModuleRequest,
    CreatePageRequest,
    ModuleAdminOut,
    MoveChapterRequest,
    MovePageRequest,
    PageAdminOut,
    RenameRequest,
    ReorderRequest,
)

router = APIRouter(prefix="/api/v1/courses", tags=["course-structure"])


def _require_int(raw: str, what: str) -> int:
    try:
        return int(raw)
    except ValueError as exc:
        raise ValidationAppError(f"Invalid {what}: {raw!r}") from exc


def _module_out(module) -> ModuleAdminOut:
    return ModuleAdminOut(id=str(module.id), title=module.title, position=module.position)


def _chapter_out(chapter) -> ChapterAdminOut:
    return ChapterAdminOut(
        id=str(chapter.id),
        title=chapter.title,
        position=chapter.position,
        moduleId=str(chapter.module_id),
    )


def _page_out(page) -> PageAdminOut:
    return PageAdminOut(
        id=str(page.id),
        title=page.title,
        position=page.position,
        chapterId=str(page.chapter_id),
    )


# -- modules -----------------------------------------------------------


@router.post("/{course_id}/modules", response_model=ModuleAdminOut)
def create_module(
    course_id: int,
    body: CreateModuleRequest,
    db: DbSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> ModuleAdminOut:
    repo = StructureRepository(db)
    return _module_out(repo.create_module(course_id, body.title))


@router.patch("/modules/{module_id}", response_model=ModuleAdminOut)
def rename_module(
    module_id: int,
    body: RenameRequest,
    db: DbSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> ModuleAdminOut:
    repo = StructureRepository(db)
    return _module_out(repo.rename_module(module_id, body.title))


@router.delete("/modules/{module_id}", status_code=204)
def delete_module(
    module_id: int,
    db: DbSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> None:
    StructureRepository(db).delete_module(module_id)


@router.post("/{course_id}/modules/reorder", status_code=204)
def reorder_modules(
    course_id: int,
    body: ReorderRequest,
    db: DbSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> None:
    ordered_ids = [_require_int(raw, "orderedIds") for raw in body.ordered_ids]
    StructureRepository(db).reorder_modules(course_id, ordered_ids)


# -- chapters ------------------------------------------------------------


@router.post("/modules/{module_id}/chapters", response_model=ChapterAdminOut)
def create_chapter(
    module_id: int,
    body: CreateChapterRequest,
    db: DbSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> ChapterAdminOut:
    repo = StructureRepository(db)
    return _chapter_out(repo.create_chapter(module_id, body.title))


@router.patch("/chapters/{chapter_id}", response_model=ChapterAdminOut)
def rename_chapter(
    chapter_id: int,
    body: RenameRequest,
    db: DbSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> ChapterAdminOut:
    repo = StructureRepository(db)
    return _chapter_out(repo.rename_chapter(chapter_id, body.title))


@router.delete("/chapters/{chapter_id}", status_code=204)
def delete_chapter(
    chapter_id: int,
    db: DbSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> None:
    StructureRepository(db).delete_chapter(chapter_id)


@router.post("/chapters/{chapter_id}/move", response_model=ChapterAdminOut)
def move_chapter(
    chapter_id: int,
    body: MoveChapterRequest,
    db: DbSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> ChapterAdminOut:
    repo = StructureRepository(db)
    new_module_id = _require_int(body.module_id, "moduleId")
    return _chapter_out(repo.move_chapter(chapter_id, new_module_id))


@router.post("/modules/{module_id}/chapters/reorder", status_code=204)
def reorder_chapters(
    module_id: int,
    body: ReorderRequest,
    db: DbSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> None:
    ordered_ids = [_require_int(raw, "orderedIds") for raw in body.ordered_ids]
    StructureRepository(db).reorder_chapters(module_id, ordered_ids)


# -- pages -----------------------------------------------------------------


@router.post("/chapters/{chapter_id}/pages", response_model=PageAdminOut)
def create_page(
    chapter_id: int,
    body: CreatePageRequest,
    db: DbSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> PageAdminOut:
    repo = StructureRepository(db)
    return _page_out(repo.create_page(chapter_id, body.title))


@router.patch("/pages/{page_id}", response_model=PageAdminOut)
def rename_page(
    page_id: int,
    body: RenameRequest,
    db: DbSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> PageAdminOut:
    repo = StructureRepository(db)
    return _page_out(repo.rename_page(page_id, body.title))


@router.delete("/pages/{page_id}", status_code=204)
def delete_page(
    page_id: int,
    db: DbSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> None:
    StructureRepository(db).delete_page(page_id)


@router.post("/pages/{page_id}/move", response_model=PageAdminOut)
def move_page(
    page_id: int,
    body: MovePageRequest,
    db: DbSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> PageAdminOut:
    repo = StructureRepository(db)
    new_chapter_id = _require_int(body.chapter_id, "chapterId")
    return _page_out(repo.move_page(page_id, new_chapter_id))


@router.post("/chapters/{chapter_id}/pages/reorder", status_code=204)
def reorder_pages(
    chapter_id: int,
    body: ReorderRequest,
    db: DbSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> None:
    ordered_ids = [_require_int(raw, "orderedIds") for raw in body.ordered_ids]
    StructureRepository(db).reorder_pages(chapter_id, ordered_ids)
