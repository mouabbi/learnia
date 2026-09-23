"""
Integration tests for routers/assets.py (15-assets): upload/list/serve/
delete. Upload+delete are CMS-only; list+serve are public. Storage is
overridden to a pytest tmp_path so tests never touch the real assets/ dir.
"""

import io

import pytest

from learnia_backend.main import app
from learnia_backend.models.course import Course
from learnia_backend.services.storage import LocalFilesystemStorage, get_storage

CREDS = {"email": "cms-assets@b.com", "password": "password123"}


@pytest.fixture
def storage_root(tmp_path):
    root = tmp_path / "assets"
    app.dependency_overrides[get_storage] = lambda: LocalFilesystemStorage(root=root)
    yield root
    app.dependency_overrides.pop(get_storage, None)


@pytest.fixture
def auth_client(client, storage_root):
    client.post("/api/v1/auth/register", json=CREDS)
    return client


def _make_course(db, slug="course-a") -> Course:
    course = Course(slug=slug, title="Course A")
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


def test_upload_requires_auth(client, db, storage_root):
    course = _make_course(db)
    res = client.post(
        f"/api/v1/courses/{course.id}/assets",
        files={"file": ("a.png", io.BytesIO(b"pngdata"), "image/png")},
    )
    assert res.status_code == 401


def test_upload_returns_asset_with_url(auth_client, db):
    course = _make_course(db)
    res = auth_client.post(
        f"/api/v1/courses/{course.id}/assets",
        files={"file": ("diagram.png", io.BytesIO(b"pngdata"), "image/png")},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["filename"] == "diagram.png"
    assert body["mimeType"] == "image/png"
    assert body["courseId"] == str(course.id)
    assert body["url"] == f"/api/v1/courses/assets/{body['id']}/file"


def test_upload_disallowed_mime_type_is_422(auth_client, db):
    course = _make_course(db)
    res = auth_client.post(
        f"/api/v1/courses/{course.id}/assets",
        files={"file": ("virus.exe", io.BytesIO(b"data"), "application/x-msdownload")},
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"


def test_upload_oversized_file_is_422(auth_client, db):
    course = _make_course(db)
    oversized = b"x" * (20 * 1024 * 1024 + 1)
    res = auth_client.post(
        f"/api/v1/courses/{course.id}/assets",
        files={"file": ("big.png", io.BytesIO(oversized), "image/png")},
    )
    assert res.status_code == 422


def test_upload_unknown_course_is_404(auth_client):
    res = auth_client.post(
        "/api/v1/courses/999/assets",
        files={"file": ("a.png", io.BytesIO(b"data"), "image/png")},
    )
    assert res.status_code == 404


def test_list_assets_does_not_require_auth(client, db, storage_root):
    course = _make_course(db)
    res = client.get(f"/api/v1/courses/{course.id}/assets")
    assert res.status_code == 200
    assert res.json() == []


def test_list_assets_returns_uploaded_assets(auth_client, db):
    course = _make_course(db)
    auth_client.post(
        f"/api/v1/courses/{course.id}/assets",
        files={"file": ("a.png", io.BytesIO(b"a"), "image/png")},
    )
    res = auth_client.get(f"/api/v1/courses/{course.id}/assets")
    assert res.status_code == 200
    assert len(res.json()) == 1


def test_serve_asset_file_returns_bytes(auth_client, db):
    course = _make_course(db)
    upload = auth_client.post(
        f"/api/v1/courses/{course.id}/assets",
        files={"file": ("a.png", io.BytesIO(b"pngbytes"), "image/png")},
    )
    asset_id = upload.json()["id"]
    res = auth_client.get(f"/api/v1/courses/assets/{asset_id}/file")
    assert res.status_code == 200
    assert res.content == b"pngbytes"


def test_serve_asset_file_does_not_require_auth(client, auth_client, db):
    course = _make_course(db)
    upload = auth_client.post(
        f"/api/v1/courses/{course.id}/assets",
        files={"file": ("a.png", io.BytesIO(b"pngbytes"), "image/png")},
    )
    asset_id = upload.json()["id"]
    client.cookies.clear()
    res = client.get(f"/api/v1/courses/assets/{asset_id}/file")
    assert res.status_code == 200


def test_serve_asset_file_unknown_id_is_404(client, storage_root):
    res = client.get("/api/v1/courses/assets/999/file")
    assert res.status_code == 404


def test_delete_asset_requires_auth(client, db, storage_root):
    res = client.delete("/api/v1/courses/assets/1")
    assert res.status_code == 401


def test_delete_asset_removes_it(auth_client, db):
    course = _make_course(db)
    upload = auth_client.post(
        f"/api/v1/courses/{course.id}/assets",
        files={"file": ("a.png", io.BytesIO(b"a"), "image/png")},
    )
    asset_id = upload.json()["id"]
    res = auth_client.delete(f"/api/v1/courses/assets/{asset_id}")
    assert res.status_code == 204

    follow_up = auth_client.get(f"/api/v1/courses/assets/{asset_id}/file")
    assert follow_up.status_code == 404


def test_delete_unknown_asset_is_404(auth_client):
    res = auth_client.delete("/api/v1/courses/assets/999")
    assert res.status_code == 404
