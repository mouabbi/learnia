"""
Integration tests for routers/import_validation.py (13-ai-content-import-
validation): POST .../import/{scope}/validate and .../commit. CMS-only.
"""

import json

import pytest

from learnia_backend.models.course import Course
from learnia_backend.models.module import Module

CREDS = {"email": "cms-import@b.com", "password": "password123"}


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


def test_validate_requires_auth(client, db):
    course = _make_course(db)
    res = client.post(
        f"/api/v1/courses/{course.id}/import/course/validate",
        json={"json": json.dumps({"title": "X"})},
    )
    assert res.status_code == 401


def test_validate_valid_course_json_returns_valid_true(auth_client, db):
    course = _make_course(db)
    res = auth_client.post(
        f"/api/v1/courses/{course.id}/import/course/validate",
        json={"json": json.dumps({"title": "X", "description": "Y"})},
    )
    assert res.status_code == 200
    assert res.json()["valid"] is True
    assert res.json()["parsed"]["title"] == "X"


def test_validate_invalid_json_returns_valid_false_with_errors(auth_client, db):
    course = _make_course(db)
    res = auth_client.post(
        f"/api/v1/courses/{course.id}/import/course/validate",
        json={"json": "{broken"},
    )
    assert res.status_code == 200
    assert res.json()["valid"] is False
    assert res.json()["errors"]


def test_validate_unknown_scope_is_422(auth_client, db):
    course = _make_course(db)
    res = auth_client.post(
        f"/api/v1/courses/{course.id}/import/bogus/validate",
        json={"json": "{}"},
    )
    assert res.status_code == 422


def test_validate_missing_json_field_defaults_to_empty_string_and_fails(auth_client, db):
    course = _make_course(db)
    res = auth_client.post(
        f"/api/v1/courses/{course.id}/import/course/validate",
        json={},
    )
    assert res.status_code == 200
    assert res.json()["valid"] is False


def test_commit_requires_auth(client, db):
    course = _make_course(db)
    res = client.post(
        f"/api/v1/courses/{course.id}/import/course/commit",
        json={"json": json.dumps({"title": "X"})},
    )
    assert res.status_code == 401


def test_commit_course_scope_updates_course(auth_client, db):
    course = _make_course(db)
    res = auth_client.post(
        f"/api/v1/courses/{course.id}/import/course/commit",
        json={"json": json.dumps({"title": "Updated", "description": "New"})},
    )
    assert res.status_code == 200
    assert res.json()["title"] == "Updated"


def test_commit_course_scope_invalid_json_is_422(auth_client, db):
    course = _make_course(db)
    res = auth_client.post(
        f"/api/v1/courses/{course.id}/import/course/commit",
        json={"json": "{broken"},
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"


def test_commit_module_scope_without_module_id_creates_new_module(auth_client, db):
    course = _make_course(db)
    res = auth_client.post(
        f"/api/v1/courses/{course.id}/import/module/commit",
        json={"json": json.dumps({"title": "X"})},
    )
    assert res.status_code == 200
    assert res.json()["title"] == "X"


def test_commit_module_scope_with_module_id_updates_module(auth_client, db):
    course = _make_course(db)
    module = _make_module(db, course)
    res = auth_client.post(
        f"/api/v1/courses/{course.id}/import/module/commit",
        params={"moduleId": module.id},
        json={"json": json.dumps({"title": "New Title"})},
    )
    assert res.status_code == 200
    assert res.json()["title"] == "New Title"


def test_commit_page_scope_requires_page_id_query_param(auth_client, db):
    # Regression: commit_page requires page_id — a request without pageId
    # must be rejected before reaching the service layer.
    course = _make_course(db)
    res = auth_client.post(
        f"/api/v1/courses/{course.id}/import/page/commit",
        json={"json": json.dumps({"blocks": []})},
    )
    assert res.status_code == 422


def test_commit_qcm_scope_requires_module_id(auth_client, db):
    course = _make_course(db)
    raw = json.dumps(
        [{"text": "q", "options": [{"id": "a", "text": "x"}], "correctOptionIds": ["a"]}]
    )
    res = auth_client.post(
        f"/api/v1/courses/{course.id}/import/module-qcm/commit",
        json={"json": raw},
    )
    assert res.status_code == 422


def test_commit_qcm_scope_with_module_id_creates_questions(auth_client, db):
    course = _make_course(db)
    module = _make_module(db, course)
    raw = json.dumps(
        [{"text": "q", "options": [{"id": "a", "text": "x"}], "correctOptionIds": ["a"]}]
    )
    res = auth_client.post(
        f"/api/v1/courses/{course.id}/import/module-qcm/commit",
        params={"moduleId": module.id},
        json={"json": raw},
    )
    assert res.status_code == 200
    assert len(res.json()["created"]) == 1


def test_commit_final_exam_scope_does_not_require_module_id(auth_client, db):
    course = _make_course(db)
    raw = json.dumps(
        [{"text": "q", "options": [{"id": "a", "text": "x"}], "correctOptionIds": ["a"]}]
    )
    res = auth_client.post(
        f"/api/v1/courses/{course.id}/import/final-exam/commit",
        json={"json": raw},
    )
    assert res.status_code == 200
    assert len(res.json()["created"]) == 1


def test_commit_unknown_scope_is_422(auth_client, db):
    course = _make_course(db)
    res = auth_client.post(
        f"/api/v1/courses/{course.id}/import/bogus/commit",
        json={"json": "{}"},
    )
    assert res.status_code == 422
