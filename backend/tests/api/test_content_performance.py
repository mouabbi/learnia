"""
Performance-oriented integration tests (19-performance-accessibility,
concept 2: "avoid loading entire course content tree with full page content
eagerly — structure metadata vs. lazy page content").

Confirmed by reading the routers:
  - routers/course_structure.py (CMS authoring mutations) returns
    PageAdminOut/ChapterAdminOut/ModuleAdminOut (schemas/courses.py) — only
    id/title/position/parent id, never page content. This is the
    lightweight "structure" surface the CMS's Structure tab uses.
  - routers/content.py's GET /pages/{id}/content returns the full
    PageContent (schema_version + blocks) for exactly one page — the
    "lazy, per-page" content fetch.

Gap found while confirming the separation: routers/courses.py's
GET /courses/{slug} (CourseDetail) is the one place that does NOT follow
this pattern — CourseRepository (repositories/course_repository.py,
`_read_page_content`) reads every page's content JSON file off disk and
inlines it as PageOut.content for every page in every chapter in every
module, in one response. That's the "load the entire tree with full page
content eagerly" case the concept warns against; it's flagged below as an
xfail rather than silently skipped, since it documents real eager-loading
behavior in the current learner-facing course-detail endpoint (used by
CourseReaderPage, which per BlockRenderer.jsx's docstring is not
block-aware yet and still consumes this flat `content` string).
"""

import json

import pytest

from learnia_backend.models.chapter import Chapter
from learnia_backend.models.course import Course
from learnia_backend.models.enums import ContentStatus
from learnia_backend.models.module import Module
from learnia_backend.models.page import Page

CREDS = {"email": "cms-perf@example.com", "password": "password123"}


def _make_course_tree(db, *, published=True):
    course = Course(
        slug="perf-course",
        title="Performance Course",
        description="d",
        content_status=ContentStatus.PUBLISHED if published else ContentStatus.DRAFT,
    )
    db.add(course)
    db.flush()

    module = Module(course_id=course.id, title="Module 1", position=0)
    db.add(module)
    db.flush()

    chapter = Chapter(course_id=course.id, module_id=module.id, title="Chapter 1", position=0)
    db.add(chapter)
    db.flush()

    page = Page(course_id=course.id, chapter_id=chapter.id, title="Page 1", position=0)
    db.add(page)
    db.commit()
    db.refresh(course)
    db.refresh(page)
    return course, module, chapter, page


def _login(client):
    client.post("/api/v1/auth/register", json=CREDS)


def test_structure_endpoints_return_metadata_only_no_blocks(client, db):
    """
    CMS structure mutations (course_structure.py) must return only
    id/title/position/parent-id — never the page's block content. This is
    the "lightweight metadata" half of the structure-vs-content split.
    """
    _login(client)
    course, module, chapter, page = _make_course_tree(db)

    res = client.post(f"/api/v1/courses/{course.id}/modules", json={"title": "Module 2"})
    assert res.status_code == 200
    body = res.json()
    assert set(body.keys()) == {"id", "title", "position"}

    res = client.post(f"/api/v1/courses/modules/{module.id}/chapters", json={"title": "Chapter 2"})
    assert res.status_code == 200
    body = res.json()
    assert set(body.keys()) == {"id", "title", "position", "moduleId"}
    assert "blocks" not in body
    assert "content" not in body

    res = client.post(f"/api/v1/courses/chapters/{chapter.id}/pages", json={"title": "Page 2"})
    assert res.status_code == 200
    body = res.json()
    assert set(body.keys()) == {"id", "title", "position", "chapterId"}
    assert "blocks" not in body
    assert "content" not in body


def test_page_content_endpoint_returns_full_blocks(client, db):
    """
    By contrast, the dedicated per-page content endpoint (content.py) is
    where full block content is actually fetched — lazily, one page at a
    time, only when that page is opened.
    """
    _login(client)
    course, module, chapter, page = _make_course_tree(db)

    payload = {
        "schemaVersion": 1,
        "blocks": [
            {"type": "heading", "text": "Hello", "level": 2},
            {"type": "paragraph", "text": "Some body text."},
        ],
    }
    res = client.put(f"/api/v1/courses/pages/{page.id}/content", json=payload)
    assert res.status_code == 200

    res = client.get(f"/api/v1/courses/pages/{page.id}/content")
    assert res.status_code == 200
    body = res.json()
    assert body["blocks"][0]["type"] == "heading"
    assert body["blocks"][1]["text"] == "Some body text."


def test_course_list_is_lightweight_summary_without_modules(client, db):
    """GET /courses (catalog) returns CourseSummary — no module tree at all."""
    _make_course_tree(db)
    res = client.get("/api/v1/courses")
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 1
    assert "modules" not in body[0]


@pytest.mark.xfail(
    reason=(
        "Known gap (19-performance-accessibility): GET /courses/{slug} "
        "(CourseDetail) eagerly inlines every page's full content string "
        "via CourseRepository._read_page_content for the ENTIRE course "
        "tree in one response, instead of returning structure metadata "
        "and letting the client lazily fetch each page's content via "
        "GET /pages/{id}/content like the CMS does. Remove this xfail "
        "once CourseDetail/PageOut stop embedding full content."
    ),
    strict=True,
)
def test_course_detail_does_not_eagerly_embed_full_page_content(client, db):
    course, module, chapter, page = _make_course_tree(db)
    long_text = "word " * 5000  # simulate a real, non-trivial page

    payload = {"schemaVersion": 1, "blocks": [{"type": "paragraph", "text": long_text}]}
    _login(client)
    client.put(f"/api/v1/courses/pages/{page.id}/content", json=payload)

    res = client.get(f"/api/v1/courses/{course.slug}")
    assert res.status_code == 200
    body = res.json()
    page_out = body["modules"][0]["chapters"][0]["pages"][0]
    # Today this fails: page_out["content"] actually contains the full
    # `long_text`. Structure-only responses should omit page content
    # entirely, or at most a short excerpt/summary.
    assert "content" not in page_out or len(page_out.get("content", "")) < 200
