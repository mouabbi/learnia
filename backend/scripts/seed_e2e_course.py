"""One-off seed script for the Playwright E2E suite (frontend/e2e/).

There is no "create course" UI or API yet (features 11/12/13's CMS only
edits an existing course's structure/content), so the course fixture the
E2E specs need — a course with at least one module > chapter > page — has
to be inserted directly against the app's real database, same one the dev
server points at (DATABASE_URL in backend/.env).

Run once, from backend/, before running the E2E suite:
    uv run python scripts/seed_e2e_course.py

Safe to re-run: skips creating the course if the slug already exists.
"""

from learnia_backend.database import SessionLocal
from learnia_backend.models import Chapter, Course, Module, Page
from learnia_backend.models.enums import ContentStatus

SLUG = "e2e-course"


def main() -> None:
    db = SessionLocal()
    try:
        existing = db.query(Course).filter(Course.slug == SLUG).first()
        if existing:
            print(f"Course '{SLUG}' already exists (id={existing.id}) — nothing to do.")
            return

        course = Course(
            slug=SLUG,
            title="E2E Test Course",
            description="Seeded for the Playwright E2E suite — safe to leave in place.",
            content_status=ContentStatus.PUBLISHED,
        )
        db.add(course)
        db.flush()  # assigns course.id

        module = Module(course_id=course.id, title="Module 1", position=1)
        db.add(module)
        db.flush()

        chapter = Chapter(course_id=course.id, module_id=module.id, title="Chapter 1", position=1)
        db.add(chapter)
        db.flush()

        page = Page(course_id=course.id, chapter_id=chapter.id, title="Page 1", position=1)
        db.add(page)

        db.commit()
        print(f"Seeded course '{SLUG}' (id={course.id}) with module/chapter/page.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
