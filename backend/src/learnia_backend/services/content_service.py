"""
Read/write a page's content JSON file (07-content-system). The DB only
holds `pages.content_path`; the file itself lives under CONTENT_ROOT,
matching the constant already used by repositories/course_repository.py's
`_read_page_content` — both must agree on the same root, since
`content_path` is a path relative to it (see models/page.py's docstring).

`content_path` is set here, once, the first time a page is saved through
this service: deterministic (`{course.slug}/{page.id}.json`), never
user-edited (page.py's docstring) and never re-derived from the current
slug afterwards, so renaming a course's slug later does not silently orphan
already-written content — a future rename flow will need to move the file
explicitly if that's ever desired.
"""

import json
from pathlib import Path

from sqlalchemy.orm import Session

from learnia_backend.exceptions import NotFoundError
from learnia_backend.models.course import Course
from learnia_backend.models.page import Page
from learnia_backend.repositories.course_repository import CourseRepository
from learnia_backend.services.search_index import reindex_page
from learnia_backend.schemas.content import (
    CalloutBlock,
    HeadingBlock,
    ListBlock,
    LinkBlock,
    PageContent,
    ParagraphBlock,
    QuoteBlock,
    TableBlock,
    TerminalBlock,
)

CONTENT_ROOT = Path(__file__).resolve().parent.parent.parent.parent / "content"


def delete_content_file(content_path: str | None) -> None:
    """
    Remove a single page's content JSON file from disk, if it has one.
    Safe/idempotent when `content_path` is None or already gone — same
    "safe to call on an already-missing file" convention as
    `services/storage.py`'s `AssetStorage.delete`. Callers (structure_repository's
    delete_page/delete_chapter/delete_module) must capture `content_path`
    BEFORE deleting the owning Page row, since the DB row (and thus this
    value) is gone once the delete commits.
    """
    if not content_path:
        return
    (CONTENT_ROOT / content_path).unlink(missing_ok=True)


def _extract_text(content: PageContent) -> str:
    """Plain-text extraction for `pages.search_text` (14-global-search)."""
    parts: list[str] = []
    for block in content.blocks:
        if isinstance(block, (HeadingBlock, ParagraphBlock, TerminalBlock, QuoteBlock, CalloutBlock)):
            parts.append(block.text)
        elif isinstance(block, LinkBlock):
            parts.append(block.text)
        elif isinstance(block, ListBlock):
            parts.extend(block.items)
        elif isinstance(block, TableBlock):
            parts.extend(block.headers)
            parts.extend(cell for row in block.rows for cell in row)
    return "\n\n".join(p for p in parts if p)


class ContentService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def read(self, page: Page) -> PageContent:
        if not page.content_path:
            return PageContent()
        full_path = CONTENT_ROOT / page.content_path
        try:
            raw = json.loads(full_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            # No file yet (or an unreadable one) reads back as empty content,
            # never an error — see page.py's docstring.
            return PageContent()
        return PageContent.model_validate(raw)

    def write(self, page: Page, content: PageContent) -> PageContent:
        course = self.db.get(Course, page.course_id)
        if course is None:
            raise NotFoundError(f"Course not found: {page.course_id}")

        relative_path = page.content_path or f"{course.slug}/{page.id}.json"
        full_path = CONTENT_ROOT / relative_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_text(
            json.dumps(content.model_dump(by_alias=True), indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

        page.content_path = relative_path
        page.search_text = _extract_text(content)
        self.db.commit()
        reindex_page(self.db, page.id)  # 14-global-search: keep the FTS5 index in sync
        CourseRepository(self.db).touch(page.course_id)
        return content
