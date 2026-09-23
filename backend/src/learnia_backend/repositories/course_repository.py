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
from pathlib import Path

from sqlalchemy.orm import Session

from learnia_backend.models.chapter import Chapter
from learnia_backend.models.course import Course
from learnia_backend.models.enums import ContentStatus, QuestionScope
from learnia_backend.models.module import Module
from learnia_backend.models.page import Page
from learnia_backend.models.question import Question

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
                "durationMinutes": theme.get("finalExamDurationMinutes", 30),
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
