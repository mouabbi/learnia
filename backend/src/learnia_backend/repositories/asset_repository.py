"""
DB-side CRUD for Asset rows (15-assets), plus the validation (allowed mime
type, max size) that gates every upload. Deliberately owns both the DB row
AND the underlying file's lifecycle (via the injected `AssetStorage`, see
services/storage.py): create() writes the file then the row, delete()
removes the row then the file — so a caller never has to remember to do
both, and the two can't drift out of sync from a router forgetting one step.
"""

from sqlalchemy.orm import Session

from learnia_backend.config import settings
from learnia_backend.exceptions import NotFoundError, ValidationAppError
from learnia_backend.models.asset import Asset
from learnia_backend.models.course import Course
from learnia_backend.services.storage import AssetStorage


class AssetRepository:
    def __init__(self, db: Session, storage: AssetStorage) -> None:
        self.db = db
        self.storage = storage

    def _require_course(self, course_id: int) -> Course:
        course = self.db.get(Course, course_id)
        if course is None:
            raise NotFoundError(f"Course not found: {course_id}")
        return course

    def get(self, asset_id: int) -> Asset:
        asset = self.db.get(Asset, asset_id)
        if asset is None:
            raise NotFoundError(f"Asset not found: {asset_id}")
        return asset

    def list_for_course(self, course_id: int) -> list[Asset]:
        self._require_course(course_id)
        return (
            self.db.query(Asset)
            .filter(Asset.course_id == course_id)
            .order_by(Asset.uploaded_at.desc())
            .all()
        )

    def create(
        self,
        course_id: int,
        filename: str,
        mime_type: str,
        file_bytes: bytes,
    ) -> Asset:
        course = self._require_course(course_id)

        if mime_type not in settings.asset_allowed_mime_types:
            raise ValidationAppError(f"Unsupported file type: {mime_type!r}")
        size_bytes = len(file_bytes)
        if size_bytes > settings.asset_max_size_bytes:
            raise ValidationAppError(
                f"File too large: {size_bytes} bytes "
                f"(max {settings.asset_max_size_bytes})"
            )
        if size_bytes == 0:
            raise ValidationAppError("Uploaded file is empty")

        storage_path = self.storage.save(file_bytes, filename, course.slug)

        asset = Asset(
            course_id=course.id,
            filename=filename,
            mime_type=mime_type,
            size_bytes=size_bytes,
            storage_path=storage_path,
        )
        self.db.add(asset)
        self.db.commit()
        self.db.refresh(asset)
        return asset

    def delete(self, asset_id: int) -> None:
        asset = self.get(asset_id)
        storage_path = asset.storage_path
        self.db.delete(asset)
        self.db.commit()
        # File removed only after the row commit succeeds, so a failed
        # delete never leaves a DB row pointing at an already-gone file.
        self.storage.delete(storage_path)
