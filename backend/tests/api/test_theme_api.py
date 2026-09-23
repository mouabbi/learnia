"""
Integration tests for routers/theme.py (16-theming): GET/PATCH
/api/v1/courses/{course_id}/theme. GET is public, PATCH requires auth.
Saving never blocks on failing contrast — it's returned as `warnings`.
"""

import pytest

from learnia_backend.models.course import Course

CREDS = {"email": "cms-theme@b.com", "password": "password123"}


@pytest.fixture
def auth_client(client):
    client.post("/api/v1/auth/register", json=CREDS)
    return client


def _make_course(db, slug="course-a") -> Course:
    course = Course(slug=slug, title="Course A")
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


def test_get_theme_does_not_require_auth(client, db):
    course = _make_course(db)
    res = client.get(f"/api/v1/courses/{course.id}/theme")
    assert res.status_code == 200


def test_get_theme_unknown_course_is_404(client):
    res = client.get("/api/v1/courses/999/theme")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "NOT_FOUND"


def test_get_theme_returns_complete_default_theme_when_none_set(client, db):
    course = _make_course(db)
    res = client.get(f"/api/v1/courses/{course.id}/theme")
    theme = res.json()["theme"]
    assert theme["accent"] == "#4f46e5"
    assert "light" in theme and "dark" in theme
    assert len(theme["modulePalette"]) > 0


def test_get_theme_default_theme_has_no_contrast_warnings_on_light_background(client, db):
    # NOT a true "zero warnings" check: CourseTheme has one shared accent/
    # headingColor checked against BOTH the light and dark palette
    # backgrounds (see _contrast_warnings in routers/theme.py). No single
    # color can pass AA 4.5:1 against both a near-white and a near-black
    # background at once, so the default theme's accent (#4f46e5) always
    # warns on the dark palette today — that's a real gap (16-theming needs
    # separate light/dark accent colors, like it already has for
    # background/surface/text), not something this test should paper over.
    course = _make_course(db)
    res = client.get(f"/api/v1/courses/{course.id}/theme")
    light_warnings = [w for w in res.json()["warnings"] if "light background" in w]
    assert light_warnings == []


def test_get_theme_reads_back_old_loosely_typed_keys(client, db):
    # Backward-compat: an old course.theme with only {accent, image,
    # difficulty, estimatedMinutes} must still validate via passthrough.
    course = Course(
        slug="legacy",
        title="Legacy",
        theme={"accent": "#123456", "image": "pic.png", "difficulty": "easy", "estimatedMinutes": 30},
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    res = client.get(f"/api/v1/courses/{course.id}/theme")
    theme = res.json()["theme"]
    assert theme["accent"] == "#123456"
    assert theme["image"] == "pic.png"
    assert theme["difficulty"] == "easy"
    assert theme["estimatedMinutes"] == 30


def test_patch_theme_requires_auth(client, db):
    course = _make_course(db)
    res = client.patch(f"/api/v1/courses/{course.id}/theme", json={"accent": "#000000"})
    assert res.status_code == 401


def test_patch_theme_updates_and_persists(auth_client, db):
    course = _make_course(db)
    res = auth_client.patch(
        f"/api/v1/courses/{course.id}/theme", json={"accent": "#123456"}
    )
    assert res.status_code == 200
    assert res.json()["theme"]["accent"] == "#123456"

    db.refresh(course)
    assert course.theme["accent"] == "#123456"


def test_patch_theme_unknown_course_is_404(auth_client):
    res = auth_client.patch("/api/v1/courses/999/theme", json={"accent": "#000000"})
    assert res.status_code == 404


def test_patch_theme_saves_low_contrast_colors_and_returns_warning_instead_of_blocking(
    auth_client, db
):
    course = _make_course(db)
    res = auth_client.patch(
        f"/api/v1/courses/{course.id}/theme",
        json={
            "accent": "#f0f0f0",
            "light": {"background": "#f5f5f5", "surface": "#f8fafc", "text": "#111827"},
        },
    )
    assert res.status_code == 200
    body = res.json()
    # Never blocks/auto-mutates: saved as given...
    assert body["theme"]["accent"] == "#f0f0f0"
    db.refresh(course)
    assert course.theme["accent"] == "#f0f0f0"
    # ...but a warning is surfaced for the failing pair.
    assert any("accent on light background" in w for w in body["warnings"])


def test_patch_theme_invalid_field_type_is_422(auth_client, db):
    course = _make_course(db)
    res = auth_client.patch(
        f"/api/v1/courses/{course.id}/theme", json={"modulePalette": "not-a-list"}
    )
    assert res.status_code == 422
