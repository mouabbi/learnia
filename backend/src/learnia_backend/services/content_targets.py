"""
Which pages a "module-content" generation targets — shared by the prompt
builder (what to ask the AI for) and the import service (where to write the
answer back), so the two always agree on the same page list.

Rule: if a module is PARTLY written (some pages empty, some not), only the
empty pages are targeted — this is what lets you add a chapter/pages to an
already-finished module and generate content for just the new pages without
touching anything already written. If every page is empty, or every page is
already written, all pages are targeted (the latter is an explicit
regenerate, which still needs the replace confirmation on commit).
"""

from dataclasses import dataclass

from sqlalchemy.orm import Session

from learnia_backend.models.page import Page
from learnia_backend.repositories.structure_repository import StructureRepository
from learnia_backend.services.content_service import ContentService


@dataclass
class ContentTargets:
    all_pages: list[Page]
    targets: list[Page]
    only_empty: bool  # module is partly written -> targets are its empty pages only
    all_written: bool  # every page already has content -> committing overwrites


def content_targets(db: Session, module_id: int) -> ContentTargets:
    pages = StructureRepository(db).pages_in_module_order(module_id)
    content = ContentService(db)
    empty = [p for p in pages if not content.read(p).blocks]
    if empty and len(empty) < len(pages):
        return ContentTargets(pages, empty, only_empty=True, all_written=False)
    return ContentTargets(pages, pages, only_empty=False, all_written=bool(pages) and not empty)
