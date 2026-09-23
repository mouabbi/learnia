"""
Integration tests for routers/dashboard.py (17-dashboard):
GET /api/v1/dashboard. Per-user, requires auth (unlike GET /courses).
"""

import pytest

from learnia_backend.models.chapter import Chapter
from learnia_backend.models.course import Course
from learnia_backend.models.enums import ContentStatus
from learnia_backend.models.module import Module
from learnia_backend.models.page import Page

CREDS = {"email": "learner@b.com", "password": "password123"}


@pytest.fixture
def auth_client(client):
    client.post("/api/v1/auth/register", json=CREDS)
    return client


def _make_course(db, slug, title, status=ContentStatus.PUBLISHED) -> Course:
    course = Course(slug=slug, title=title, content_status=status)
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


def test_dashboard_requires_auth(client):
    res = client.get("/api/v1/dashboard")
    assert res.status_code == 401


def test_dashboard_returns_full_shape_for_new_user(auth_client):
    res = auth_client.get("/api/v1/dashboard")
    assert res.status_code == 200
    body = res.json()
    assert body["continueLearning"] is None
    assert body["courses"] == []
    assert body["recommendations"] == []
    assert body["stats"] == {"inProgressCount": 0, "completedCount": 0, "totalCount": 0}


def test_dashboard_lists_published_courses(auth_client, db):
    _make_course(db, "a", "Course A")
    res = auth_client.get("/api/v1/dashboard")
    courses = res.json()["courses"]
    assert len(courses) == 1
    assert courses[0]["title"] == "Course A"
    assert courses[0]["learningStatus"] == "not_started"


def test_dashboard_recommendations_include_ready_courses(auth_client, db):
    _make_course(db, "a", "Ready One", status=ContentStatus.READY)
    res = auth_client.get("/api/v1/dashboard")
    titles = {c["title"] for c in res.json()["recommendations"]}
    assert "Ready One" in titles


def test_dashboard_is_scoped_to_the_authenticated_user(client, db):
    course = _make_course(db, "a", "Course A")
    module = Module(course_id=course.id, title="Module", position=1)
    db.add(module)
    db.flush()
    chapter = Chapter(course_id=course.id, module_id=module.id, title="Chapter", position=1)
    db.add(chapter)
    db.flush()
    page = Page(course_id=course.id, chapter_id=chapter.id, title="Page", position=1)
    db.add(page)
    db.commit()
    db.refresh(page)

    client.post("/api/v1/auth/register", json={"email": "u1@b.com", "password": "password123"})
    client.post(f"/api/v1/courses/{course.id}/progress/last-page", json={"pageId": str(page.id)})
    client.cookies.clear()

    client.post("/api/v1/auth/register", json={"email": "u2@b.com", "password": "password123"})
    res = client.get("/api/v1/dashboard")
    courses = res.json()["courses"]
    assert courses[0]["learningStatus"] == "not_started"
