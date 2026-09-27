"""
Unit tests for repositories/asset_repository.py (15-assets): mime/size
allowlist validation, and the create-then-delete file/row lifecycle —
exercised against a DB session with a fake in-memory AssetStorage (no real
disk I/O needed).
"""

import pytest

from learnia_backend.exceptions import NotFoundError, ValidationAppError
from learnia_backend.models.course import Course
from learnia_backend.repositories.asset_repository import AssetRepository


class FakeStorage:
    """In-memory stand-in for AssetStorage — records saved/deleted paths
    without touching the real filesystem."""

    def __init__(self) -> None:
        self.saved: dict[str, bytes] = {}
        self.deleted: list[str] = []

    def save(self, file_bytes: bytes, filename: str, course_slug: str) -> str:
        path = f"{course_slug}/fake-{len(self.saved)}-{filename}"
        self.saved[path] = file_bytes
        return path

    def resolve_url(self, storage_path: str) -> str:
        return storage_path

    def delete(self, storage_path: str) -> None:
        self.deleted.append(storage_path)
        self.saved.pop(storage_path, None)


def _make_course(db, slug="course-a") -> Course:
    course = Course(slug=slug, title="Course A")
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


def test_create_rejects_disallowed_mime_type(db):
    course = _make_course(db)
    repo = AssetRepository(db, FakeStorage())
    with pytest.raises(ValidationAppError):
        repo.create(
            course.id, filename="virus.exe", mime_type="application/x-msdownload", file_bytes=b"x"
        )


def test_create_rejects_file_over_max_size(db):
    course = _make_course(db)
    repo = AssetRepository(db, FakeStorage())
    oversized = b"x" * (20 * 1024 * 1024 + 1)
    with pytest.raises(ValidationAppError):
        repo.create(course.id, filename="big.png", mime_type="image/png", file_bytes=oversized)


def test_create_rejects_empty_file(db):
    course = _make_course(db)
    repo = AssetRepository(db, FakeStorage())
    with pytest.raises(ValidationAppError):
        repo.create(course.id, filename="empty.png", mime_type="image/png", file_bytes=b"")


def test_create_rejects_unknown_course(db):
    repo = AssetRepository(db, FakeStorage())
    with pytest.raises(NotFoundError):
        repo.create(999, filename="a.png", mime_type="image/png", file_bytes=b"x")


def test_create_allowed_mime_and_size_persists_asset_row(db):
    course = _make_course(db)
    storage = FakeStorage()
    repo = AssetRepository(db, storage)
    asset = repo.create(
        course.id, filename="diagram.png", mime_type="image/png", file_bytes=b"pngdata"
    )
    assert asset.id is not None
    assert asset.course_id == course.id
    assert asset.size_bytes == len(b"pngdata")
    assert asset.storage_path in storage.saved


def test_create_accepts_every_allowlisted_mime_type(db):
    course = _make_course(db)
    repo = AssetRepository(db, FakeStorage())
    from learnia_backend.config import settings

    for mime in settings.asset_allowed_mime_types:
        asset = repo.create(course.id, filename="f", mime_type=mime, file_bytes=b"data")
        assert asset.mime_type == mime


def test_list_for_course_orders_newest_first(db):
    course = _make_course(db)
    repo = AssetRepository(db, FakeStorage())
    first = repo.create(course.id, filename="a.png", mime_type="image/png", file_bytes=b"a")
    second = repo.create(course.id, filename="b.png", mime_type="image/png", file_bytes=b"b")
    result = repo.list_for_course(course.id)
    assert [a.id for a in result] == [second.id, first.id]


def test_list_for_course_unknown_course_raises_not_found(db):
    repo = AssetRepository(db, FakeStorage())
    with pytest.raises(NotFoundError):
        repo.list_for_course(999)


def test_get_unknown_asset_raises_not_found(db):
    repo = AssetRepository(db, FakeStorage())
    with pytest.raises(NotFoundError):
        repo.get(999)


def test_delete_removes_row_then_underlying_file(db):
    course = _make_course(db)
    storage = FakeStorage()
    repo = AssetRepository(db, storage)
    asset = repo.create(course.id, filename="a.png", mime_type="image/png", file_bytes=b"a")
    storage_path = asset.storage_path

    repo.delete(asset.id)

    assert storage_path in storage.deleted
    with pytest.raises(NotFoundError):
        repo.get(asset.id)


def test_delete_unknown_asset_raises_not_found(db):
    repo = AssetRepository(db, FakeStorage())
    with pytest.raises(NotFoundError):
        repo.delete(999)
