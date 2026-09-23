"""
Global search index (14-global-search): a single FTS5 virtual table covering
courses, modules, chapters, and pages (title + content text).

Why one unified external-content-free FTS5 table instead of per-entity
tables or DB triggers: this app is single-user/local-scale, so the
straightforward "re-scan and re-insert rows" approach is both easy to reason
about and easy to keep correct — no trigger SQL to maintain across four
source tables, no external-content rowid bookkeeping. The tradeoff (a full
`reindex_all` touches every row) is irrelevant at this app's scale.

Columns: `entity_type` ('course'|'module'|'chapter'|'page'), `entity_id`,
`course_id` (denormalized on every row so results always carry a
navigable course, even for a course-type row where entity_id == course_id),
`course_slug` (denormalized too, so search results don't need a join back to
courses just to build a nav link), `title`, `body` (empty for
course/module/chapter — they have no body text today, only pages do).

FTS5 tables have no real primary key/unique constraint of their own beyond
the implicit `rowid`, so incremental reindexing deletes-then-inserts by
matching `entity_type`/`entity_id` rather than using an upsert.

Sync strategy (no triggers): callers that mutate the underlying rows —
services/content_service.py's `write()` and repositories/
structure_repository.py's create/rename/delete/move methods — call the
`reindex_*` helpers below right after they commit. This keeps the index
correct without touching SQLite trigger SQL, at the cost of remembering to
call these helpers at each mutation site (documented at each call site).
"""

from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from learnia_backend.models.chapter import Chapter
from learnia_backend.models.course import Course
from learnia_backend.models.module import Module
from learnia_backend.models.page import Page

_TABLE = "search_index"


def ensure_search_index(engine: Engine) -> None:
    """
    Create the FTS5 virtual table if it doesn't already exist. Idempotent —
    safe to call on every app startup (see main.py's lifespan, which should
    call this once at startup; not wired up here per this task's scope).
    """
    with engine.begin() as conn:
        conn.execute(
            text(
                f"""
                CREATE VIRTUAL TABLE IF NOT EXISTS {_TABLE} USING fts5(
                    entity_type,
                    entity_id UNINDEXED,
                    course_id UNINDEXED,
                    course_slug UNINDEXED,
                    title,
                    body
                )
                """
            )
        )


def _delete_rows(db: Session, entity_type: str, entity_id: int) -> None:
    db.execute(
        text(f"DELETE FROM {_TABLE} WHERE entity_type = :t AND entity_id = :i"),
        {"t": entity_type, "i": entity_id},
    )


def _insert_row(
    db: Session,
    *,
    entity_type: str,
    entity_id: int,
    course_id: int,
    course_slug: str,
    title: str,
    body: str,
) -> None:
    db.execute(
        text(
            f"""
            INSERT INTO {_TABLE} (entity_type, entity_id, course_id, course_slug, title, body)
            VALUES (:entity_type, :entity_id, :course_id, :course_slug, :title, :body)
            """
        ),
        {
            "entity_type": entity_type,
            "entity_id": entity_id,
            "course_id": course_id,
            "course_slug": course_slug,
            "title": title,
            "body": body,
        },
    )


def reindex_page(db: Session, page_id: int) -> None:
    """Re-index one page (call after content_service.write() commits)."""
    page = db.get(Page, page_id)
    _delete_rows(db, "page", page_id)
    if page is None:
        db.commit()
        return
    course = db.get(Course, page.course_id)
    if course is not None:
        _insert_row(
            db,
            entity_type="page",
            entity_id=page.id,
            course_id=course.id,
            course_slug=course.slug,
            title=page.title,
            body=page.search_text or "",
        )
    db.commit()


def reindex_module(db: Session, module_id: int) -> None:
    module = db.get(Module, module_id)
    _delete_rows(db, "module", module_id)
    if module is None:
        db.commit()
        return
    course = db.get(Course, module.course_id)
    if course is not None:
        _insert_row(
            db,
            entity_type="module",
            entity_id=module.id,
            course_id=course.id,
            course_slug=course.slug,
            title=module.title,
            body="",
        )
    db.commit()


def reindex_chapter(db: Session, chapter_id: int) -> None:
    chapter = db.get(Chapter, chapter_id)
    _delete_rows(db, "chapter", chapter_id)
    if chapter is None:
        db.commit()
        return
    course = db.get(Course, chapter.course_id)
    if course is not None:
        _insert_row(
            db,
            entity_type="chapter",
            entity_id=chapter.id,
            course_id=course.id,
            course_slug=course.slug,
            title=chapter.title,
            body="",
        )
    db.commit()


def reindex_course(db: Session, course_id: int) -> None:
    course = db.get(Course, course_id)
    _delete_rows(db, "course", course_id)
    if course is None:
        db.commit()
        return
    _insert_row(
        db,
        entity_type="course",
        entity_id=course.id,
        course_id=course.id,
        course_slug=course.slug,
        title=course.title,
        body=course.description or "",
    )
    db.commit()


def reindex_course_structure(db: Session, course_id: int) -> None:
    """
    Re-index a whole course's structure (course + all its modules, chapters,
    pages) — used by structure_repository.py's create/rename/delete/move
    methods, where figuring out exactly which single row changed isn't worth
    the bookkeeping (e.g. a move renumbers siblings' positions too, but
    position isn't indexed, so this is really just "re-sync everything under
    this course"). Cheap at this app's scale (one course's tree).
    """
    _delete_rows(db, "course", course_id)
    db.execute(text(f"DELETE FROM {_TABLE} WHERE course_id = :cid"), {"cid": course_id})

    course = db.get(Course, course_id)
    if course is None:
        db.commit()
        return

    _insert_row(
        db,
        entity_type="course",
        entity_id=course.id,
        course_id=course.id,
        course_slug=course.slug,
        title=course.title,
        body=course.description or "",
    )

    modules = db.query(Module).filter(Module.course_id == course_id).all()
    for module in modules:
        _insert_row(
            db,
            entity_type="module",
            entity_id=module.id,
            course_id=course.id,
            course_slug=course.slug,
            title=module.title,
            body="",
        )

    chapters = db.query(Chapter).filter(Chapter.course_id == course_id).all()
    for chapter in chapters:
        _insert_row(
            db,
            entity_type="chapter",
            entity_id=chapter.id,
            course_id=course.id,
            course_slug=course.slug,
            title=chapter.title,
            body="",
        )

    pages = db.query(Page).filter(Page.course_id == course_id).all()
    for page in pages:
        _insert_row(
            db,
            entity_type="page",
            entity_id=page.id,
            course_id=course.id,
            course_slug=course.slug,
            title=page.title,
            body=page.search_text or "",
        )

    db.commit()


def reindex_all(db: Session) -> None:
    """
    Full rebuild: wipes the index and re-inserts every course/module/
    chapter/page. Not the normal write path (see reindex_* helpers above for
    that) — this is for backfilling an empty index or repairing drift, e.g.
    run once via a one-off script after deploying this feature.
    """
    db.execute(text(f"DELETE FROM {_TABLE}"))

    for course in db.query(Course).all():
        _insert_row(
            db,
            entity_type="course",
            entity_id=course.id,
            course_id=course.id,
            course_slug=course.slug,
            title=course.title,
            body=course.description or "",
        )

    for module in db.query(Module).all():
        course = db.get(Course, module.course_id)
        if course is None:
            continue
        _insert_row(
            db,
            entity_type="module",
            entity_id=module.id,
            course_id=course.id,
            course_slug=course.slug,
            title=module.title,
            body="",
        )

    for chapter in db.query(Chapter).all():
        course = db.get(Course, chapter.course_id)
        if course is None:
            continue
        _insert_row(
            db,
            entity_type="chapter",
            entity_id=chapter.id,
            course_id=course.id,
            course_slug=course.slug,
            title=chapter.title,
            body="",
        )

    for page in db.query(Page).all():
        course = db.get(Course, page.course_id)
        if course is None:
            continue
        _insert_row(
            db,
            entity_type="page",
            entity_id=page.id,
            course_id=course.id,
            course_slug=course.slug,
            title=page.title,
            body=page.search_text or "",
        )

    db.commit()
