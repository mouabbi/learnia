"""
Integration tests for routers/prompt_builder.py (12-ai-prompt-builder):
GET /api/v1/courses/{course_id}/prompts/{scope} and its /schema sibling.
CMS-only, same auth gate as course_structure.py.
"""

import pytest

from learnia_backend.models.course import Course
from learnia_backend.models.module import Module

CREDS = {"email": "cms-prompt@b.com", "password": "password123"}


@pytest.fixture
def auth_client(client):
    client.post("/api/v1/auth/register", json=CREDS)
    return client


def _make_course(db, slug="course-a", title="Course A") -> Course:
    course = Course(slug=slug, title=title, description="desc")
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


def _make_module(db, course, title="Module 1", position=0) -> Module:
    module = Module(course_id=course.id, title=title, position=position)
    db.add(module)
    db.commit()
    db.refresh(module)
    return module


def test_build_prompt_requires_auth(client, db):
    course = _make_course(db)
    res = client.get(f"/api/v1/courses/{course.id}/prompts/course")
    assert res.status_code == 401


def test_build_prompt_course_scope_returns_prompt_text(auth_client, db):
    course = _make_course(db)
    res = auth_client.get(f"/api/v1/courses/{course.id}/prompts/course")
    assert res.status_code == 200
    assert "Course A" in res.json()["prompt"]


def test_build_prompt_unknown_scope_is_422(auth_client, db):
    course = _make_course(db)
    res = auth_client.get(f"/api/v1/courses/{course.id}/prompts/bogus")
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"


def test_build_prompt_chapter_scope_without_module_id_is_422(auth_client, db):
    course = _make_course(db)
    res = auth_client.get(f"/api/v1/courses/{course.id}/prompts/chapter")
    assert res.status_code == 422


def test_build_prompt_chapter_scope_with_module_id_succeeds(auth_client, db):
    course = _make_course(db)
    module = _make_module(db, course)
    res = auth_client.get(
        f"/api/v1/courses/{course.id}/prompts/chapter", params={"moduleId": module.id}
    )
    assert res.status_code == 200


def test_build_prompt_unknown_course_is_404(auth_client):
    res = auth_client.get("/api/v1/courses/999/prompts/course")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "NOT_FOUND"


def test_prompt_schema_endpoint_requires_auth(client, db):
    course = _make_course(db)
    res = client.get(f"/api/v1/courses/{course.id}/prompts/course/schema")
    assert res.status_code == 401


def test_prompt_schema_endpoint_returns_json_schema(auth_client, db):
    course = _make_course(db)
    res = auth_client.get(f"/api/v1/courses/{course.id}/prompts/course/schema")
    assert res.status_code == 200
    assert res.json()["properties"]["title"]["type"] == "string"


def test_prompt_schema_endpoint_unknown_scope_is_422(auth_client, db):
    course = _make_course(db)
    res = auth_client.get(f"/api/v1/courses/{course.id}/prompts/bogus/schema")
    assert res.status_code == 422
