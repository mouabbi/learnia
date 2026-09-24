"""
Read-only assembly of course content for the API — walks Course -> Module ->
Chapter -> Page (+ Question banks for module QCMs / the final exam) into the
nested tree shape the frontend expects (see schemas/courses.py).

Page CONTENT lives outside the DB as one JSON file per page (see
models/page.py's docstring) — `_read_page_content` is a best-effort reader
for that; no course has been authored through a CMS yet, so in practice
every page currently has no content file and reads back as "".
"""

import json
import shutil
from pathlib import Path

from sqlalchemy.orm import Session

from learnia_backend.models.asset import Asset
from learnia_backend.models.chapter import Chapter
from learnia_backend.models.course import Course
from learnia_backend.models.enums import ContentStatus, QuestionScope
from learnia_backend.models.module import Module
from learnia_backend.models.page import Page
from learnia_backend.models.question import Question
from learnia_backend.services.search_index import remove_course_from_index
from learnia_backend.services.storage import AssetStorage, get_storage
from learnia_backend.utils.time import utc_now_naive

# Where a page's content_path (relative) resolves against — see
# models/page.py: "content/{course.slug}/{page.id}.json".
CONTENT_ROOT = Path(__file__).resolve().parent.parent.parent.parent / "content"


def _read_page_content(content_path: str | None) -> str:
    if not content_path:
        return ""
    try:
        raw = json.loads((CONTENT_ROOT / content_path).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return ""
    # Minimal block -> plain text join, good enough until a real block
    # renderer exists on the frontend (see page.py's docstring on the
    # block-based content system this is a placeholder for).
    if isinstance(raw, dict) and isinstance(raw.get("blocks"), list):
        return "\n\n".join(
            str(block.get("text", "")) for block in raw["blocks"] if isinstance(block, dict)
        )
    if isinstance(raw, str):
        return raw
    return ""


def _question_out(question: Question) -> dict:
    options = question.options or []
    correct_ids = question.correct_option_ids or []
    return {
        "id": str(question.id),
        "prompt": question.text,
        "options": [{"id": str(o["id"]), "text": o["text"]} for o in options],
        # Frontend is single-answer only — collapse a multi-answer bank to
        # its first correct option.
        "correctOptionId": str(correct_ids[0]) if correct_ids else "",
    }


class CourseRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_published(self) -> list[Course]:
        return (
            self.db.query(Course)
            .filter(Course.content_status == ContentStatus.PUBLISHED)
            .order_by(Course.id)
            .all()
        )

    def get_by_slug(self, slug: str) -> Course | None:
        return self.db.query(Course).filter(Course.slug == slug).first()

    def get_by_id(self, course_id: int) -> Course | None:
        return self.db.get(Course, course_id)

    def list_all(self) -> list[Course]:
        """Every course regardless of content_status — for the CMS course
        picker (routers/course_admin.py), unlike list_published() which the
        public catalog uses."""
        return self.db.query(Course).order_by(Course.id).all()

    def create(self, *, slug: str, title: str, description: str | None, icon: str | None) -> Course:
        course = Course(slug=slug, title=title, description=description, icon=icon)
        self.db.add(course)
        self.db.commit()
        self.db.refresh(course)
        return course

    def update_metadata(
        self,
        course: Course,
        *,
        title: str | None = None,
        description: str | None = None,
        icon: str | None = None,
        content_status: ContentStatus | None = None,
    ) -> Course:
        if title is not None:
            course.title = title
        if description is not None:
            course.description = description
        if icon is not None:
            course.icon = icon
        if content_status is not None:
            course.content_status = content_status
            course.archived_at = utc_now_naive() if content_status == ContentStatus.ARCHIVED else None
        self.db.commit()
        self.db.refresh(course)
        return course

    def delete(self, course: Course, *, storage: AssetStorage | None = None) -> None:
        """
        Hard-delete a course. DB rows (modules/chapters/pages/questions/
        assets/progress/attempts) cascade via each model's DB-level
        `ondelete="CASCADE"` FK — see this module's docstring — but three
        things hang off a course that NO foreign key reaches, so they'd
        silently survive the row delete if not handled here explicitly:
          - the search index (services/search_index.py's FTS5 table has no
            FK to `courses`)
          - each page's content JSON file (models/page.py: content lives
            outside the DB, addressed only by `content_path`)
          - each asset's file on disk (models/asset.py: the DB row is only
            the record, the bytes live under AssetStorage)
        Asset rows/paths and the index are captured BEFORE the delete since
        the DB row (our only pointer to storage_path) is gone once it
        commits; the content directory is just `content/{slug}/`, so it's
        removed wholesale rather than per-page.
        """
        storage = storage or get_storage()
        asset_paths = [
            asset.storage_path
            for asset in self.db.query(Asset).filter(Asset.course_id == course.id).all()
        ]
        course_slug = course.slug

        remove_course_from_index(self.db, course.id)  # 14-global-search

        self.db.delete(course)
        self.db.commit()

        for storage_path in asset_paths:
            storage.delete(storage_path)
        shutil.rmtree(CONTENT_ROOT / course_slug, ignore_errors=True)

    def touch(self, course_id: int) -> None:
        """Bump Course.updated_at even when the Course ROW ITSELF isn't
        otherwise changing — called by every other repository/service that
        mutates something hanging off a course (a module/chapter/page,
        page content, or a question bank) so `updated_at` reflects the
        latest change to the course's content or assessments, not just
        edits to its own title/description/theme. This is what backs the
        learner-facing "this course was updated" signal (see
        repositories/progress_repository.py's has_unseen_update). A no-op
        if the course no longer exists (e.g. deleted mid-request)."""
        course = self.db.get(Course, course_id)
        if course is not None:
            course.updated_at = utc_now_naive()
            self.db.commit()

    def course_summary(self, course: Course) -> dict:
        theme = course.theme or {}
        page_count = self.db.query(Page).filter(Page.course_id == course.id).count()
        return {
            "id": course.id,
            "slug": course.slug,
            "title": course.title,
            "description": course.description or "",
            "icon": course.icon,
            "image": theme.get("image"),
            "color": theme.get("accent"),
            "difficulty": theme.get("difficulty"),
            # No estimated_minutes column on Course yet — a rough heuristic
            # (4 min/page) until content authoring adds a real estimate.
            "estimatedMinutes": theme.get("estimatedMinutes") or page_count * 4,
            "contentStatus": course.content_status.value,
        }

    def course_detail(self, course: Course) -> dict:
        modules = (
            self.db.query(Module)
            .filter(Module.course_id == course.id)
            .order_by(Module.position)
            .all()
        )
        module_ids = [m.id for m in modules]

        chapters_by_module: dict[int, list[Chapter]] = {mid: [] for mid in module_ids}
        if module_ids:
            for chapter in (
                self.db.query(Chapter)
                .filter(Chapter.module_id.in_(module_ids))
                .order_by(Chapter.position)
                .all()
            ):
                chapters_by_module[chapter.module_id].append(chapter)

        chapter_ids = [c.id for chapters in chapters_by_module.values() for c in chapters]
        pages_by_chapter: dict[int, list[Page]] = {cid: [] for cid in chapter_ids}
        if chapter_ids:
            for page in (
                self.db.query(Page)
                .filter(Page.chapter_id.in_(chapter_ids))
                .order_by(Page.position)
                .all()
            ):
                pages_by_chapter[page.chapter_id].append(page)

        questions_by_module: dict[int, list[Question]] = {mid: [] for mid in module_ids}
        if module_ids:
            for question in (
                self.db.query(Question)
                .filter(
                    Question.scope == QuestionScope.MODULE_ASSESSMENT,
                    Question.module_id.in_(module_ids),
                )
                .order_by(Question.id)
                .all()
            ):
                questions_by_module[question.module_id].append(question)

        # Deferred import: content_service.py imports CourseRepository (for
        # touch()), so importing it at module load time here would be a
        # circular import — importing inside the function, once per call,
        # breaks the cycle at no real cost (this is a read endpoint, not a
        # hot loop).
        from learnia_backend.services.content_service import ContentService

        content_service = ContentService(self.db)
        modules_out = []
        for m in modules:
            chapters_out = [
                {
                    "id": str(c.id),
                    "title": c.title,
                    # No `points` column on Chapter — weight by page count so
                    # learningProgress() (frontend) still has something
                    # meaningful to sum, until content authoring adds a
                    # real weight.
                    "points": max(len(pages_by_chapter.get(c.id, [])), 1) * 10,
                    "pages": [
                        {
                            "id": str(p.id),
                            "title": p.title,
                            "content": _read_page_content(p.content_path),
                            # The real, typed blocks (headings/code/lists/
                            # callouts/...) a page was authored with — added
                            # alongside the legacy flattened `content` string
                            # (kept for search-snippet-style consumers) so the
                            # reader can finally render rich content instead
                            # of plain-text paragraphs (see BlockRenderer.jsx,
                            # already used by the CMS's own preview).
                            "blocks": content_service.read(p).blocks,
                        }
                        for p in pages_by_chapter.get(c.id, [])
                    ],
                }
                for c in chapters_by_module.get(m.id, [])
            ]
            module_questions = questions_by_module.get(m.id, [])
            modules_out.append(
                {
                    "id": str(m.id),
                    "title": m.title,
                    "chapters": chapters_out,
                    "quiz": {"questions": [_question_out(q) for q in module_questions]}
                    if module_questions
                    else None,
                }
            )

        final_exam_questions = (
            self.db.query(Question)
            .filter(Question.scope == QuestionScope.FINAL_EXAM, Question.course_id == course.id)
            .order_by(Question.id)
            .all()
        )
        theme = course.theme or {}
        final_exam = (
            {
                # `.get(key, 30)` alone isn't enough: once a course's theme has
                # been saved at all (schemas/theme.py's CourseTheme always
                # writes this key back, defaulting to None if unset), the key
                # is PRESENT with value None — dict.get's default only kicks
                # in when the key is missing entirely, so `or 30` is needed
                # to actually catch the None case too.
                "durationMinutes": theme.get("finalExamDurationMinutes") or 30,
                "questions": [_question_out(q) for q in final_exam_questions],
            }
            if final_exam_questions
            else None
        )

        return {
            **self.course_summary(course),
            "modules": modules_out,
            "finalExam": final_exam,
        }
