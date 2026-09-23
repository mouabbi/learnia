"""
Mutations for a course's structure (Course -> Module -> Chapter -> Page —
see 06-course-structure/prompts.md). Deliberately separate from
CourseRepository, which stays read-only (see its own docstring).

Position handling: plain integer `position`, renumbered 0..n-1 on every
add/delete/reorder within a parent (see models/module.py's docstring on why
gapped/fractional keys weren't used) — reordering is rare, so a full
renumber per operation is simpler to reason about than keeping gapped keys
consistent forever.

Delete cascades to children via each model's `ondelete="CASCADE"` FK (SQLite
FK pragma is on, see database.py) — no cascade logic needed here.
"""

from sqlalchemy.orm import Session

from learnia_backend.exceptions import NotFoundError, ValidationAppError
from learnia_backend.models.chapter import Chapter
from learnia_backend.models.module import Module
from learnia_backend.models.page import Page
from learnia_backend.services.search_index import reindex_course_structure


def _renumber(items: list) -> None:
    for index, item in enumerate(items):
        item.position = index


class StructureRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    # -- lookups -----------------------------------------------------

    def get_module(self, module_id: int) -> Module:
        module = self.db.get(Module, module_id)
        if module is None:
            raise NotFoundError(f"Module not found: {module_id}")
        return module

    def get_chapter(self, chapter_id: int) -> Chapter:
        chapter = self.db.get(Chapter, chapter_id)
        if chapter is None:
            raise NotFoundError(f"Chapter not found: {chapter_id}")
        return chapter

    def get_page(self, page_id: int) -> Page:
        page = self.db.get(Page, page_id)
        if page is None:
            raise NotFoundError(f"Page not found: {page_id}")
        return page

    # -- modules -------------------------------------------------------

    def _modules_of(self, course_id: int) -> list[Module]:
        return (
            self.db.query(Module)
            .filter(Module.course_id == course_id)
            .order_by(Module.position)
            .all()
        )

    def create_module(self, course_id: int, title: str) -> Module:
        module = Module(course_id=course_id, title=title, position=len(self._modules_of(course_id)))
        self.db.add(module)
        self.db.commit()
        self.db.refresh(module)
        reindex_course_structure(self.db, course_id)  # 14-global-search
        return module

    def rename_module(self, module_id: int, title: str) -> Module:
        module = self.get_module(module_id)
        module.title = title
        self.db.commit()
        self.db.refresh(module)
        reindex_course_structure(self.db, module.course_id)  # 14-global-search
        return module

    def delete_module(self, module_id: int) -> None:
        module = self.get_module(module_id)
        course_id = module.course_id
        self.db.delete(module)
        self.db.commit()
        _renumber(self._modules_of(course_id))
        self.db.commit()
        reindex_course_structure(self.db, course_id)  # 14-global-search

    def reorder_modules(self, course_id: int, ordered_ids: list[int]) -> None:
        by_id = {m.id: m for m in self._modules_of(course_id)}
        if set(by_id) != set(ordered_ids):
            raise ValidationAppError("orderedIds must be exactly this course's module ids")
        _renumber([by_id[mid] for mid in ordered_ids])
        self.db.commit()

    # -- chapters ------------------------------------------------------

    def _chapters_of(self, module_id: int) -> list[Chapter]:
        return (
            self.db.query(Chapter)
            .filter(Chapter.module_id == module_id)
            .order_by(Chapter.position)
            .all()
        )

    def create_chapter(self, module_id: int, title: str) -> Chapter:
        module = self.get_module(module_id)
        chapter = Chapter(
            module_id=module.id,
            course_id=module.course_id,
            title=title,
            position=len(self._chapters_of(module.id)),
        )
        self.db.add(chapter)
        self.db.commit()
        self.db.refresh(chapter)
        reindex_course_structure(self.db, chapter.course_id)  # 14-global-search
        return chapter

    def rename_chapter(self, chapter_id: int, title: str) -> Chapter:
        chapter = self.get_chapter(chapter_id)
        chapter.title = title
        self.db.commit()
        self.db.refresh(chapter)
        reindex_course_structure(self.db, chapter.course_id)  # 14-global-search
        return chapter

    def delete_chapter(self, chapter_id: int) -> None:
        chapter = self.get_chapter(chapter_id)
        module_id = chapter.module_id
        course_id = chapter.course_id
        self.db.delete(chapter)
        self.db.commit()
        _renumber(self._chapters_of(module_id))
        self.db.commit()
        reindex_course_structure(self.db, course_id)  # 14-global-search

    def move_chapter(self, chapter_id: int, new_module_id: int) -> Chapter:
        chapter = self.get_chapter(chapter_id)
        new_module = self.get_module(new_module_id)
        if new_module.course_id != chapter.course_id:
            raise ValidationAppError("Cannot move a chapter to a module in a different course")
        old_module_id = chapter.module_id
        chapter.module_id = new_module.id
        chapter.position = len(self._chapters_of(new_module.id))
        self.db.commit()
        _renumber(self._chapters_of(old_module_id))
        self.db.commit()
        self.db.refresh(chapter)
        reindex_course_structure(self.db, chapter.course_id)  # 14-global-search
        return chapter

    def reorder_chapters(self, module_id: int, ordered_ids: list[int]) -> None:
        by_id = {c.id: c for c in self._chapters_of(module_id)}
        if set(by_id) != set(ordered_ids):
            raise ValidationAppError("orderedIds must be exactly this module's chapter ids")
        _renumber([by_id[cid] for cid in ordered_ids])
        self.db.commit()

    # -- pages ---------------------------------------------------------

    def _pages_of(self, chapter_id: int) -> list[Page]:
        return (
            self.db.query(Page)
            .filter(Page.chapter_id == chapter_id)
            .order_by(Page.position)
            .all()
        )

    def create_page(self, chapter_id: int, title: str) -> Page:
        chapter = self.get_chapter(chapter_id)
        page = Page(
            chapter_id=chapter.id,
            course_id=chapter.course_id,
            title=title,
            position=len(self._pages_of(chapter.id)),
        )
        self.db.add(page)
        self.db.commit()
        self.db.refresh(page)
        reindex_course_structure(self.db, page.course_id)  # 14-global-search
        return page

    def rename_page(self, page_id: int, title: str) -> Page:
        page = self.get_page(page_id)
        page.title = title
        self.db.commit()
        self.db.refresh(page)
        reindex_course_structure(self.db, page.course_id)  # 14-global-search
        return page

    def delete_page(self, page_id: int) -> None:
        page = self.get_page(page_id)
        chapter_id = page.chapter_id
        course_id = page.course_id
        self.db.delete(page)
        self.db.commit()
        _renumber(self._pages_of(chapter_id))
        self.db.commit()
        reindex_course_structure(self.db, course_id)  # 14-global-search

    def move_page(self, page_id: int, new_chapter_id: int) -> Page:
        page = self.get_page(page_id)
        new_chapter = self.get_chapter(new_chapter_id)
        if new_chapter.course_id != page.course_id:
            raise ValidationAppError("Cannot move a page to a chapter in a different course")
        old_chapter_id = page.chapter_id
        page.chapter_id = new_chapter.id
        page.position = len(self._pages_of(new_chapter.id))
        self.db.commit()
        _renumber(self._pages_of(old_chapter_id))
        self.db.commit()
        self.db.refresh(page)
        reindex_course_structure(self.db, page.course_id)  # 14-global-search
        return page

    def reorder_pages(self, chapter_id: int, ordered_ids: list[int]) -> None:
        by_id = {p.id: p for p in self._pages_of(chapter_id)}
        if set(by_id) != set(ordered_ids):
            raise ValidationAppError("orderedIds must be exactly this chapter's page ids")
        _renumber([by_id[pid] for pid in ordered_ids])
        self.db.commit()
