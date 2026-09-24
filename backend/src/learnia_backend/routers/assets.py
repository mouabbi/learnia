"""
Upload/list/delete/serve endpoints for course assets (15-assets). Same
prefix as routers/course_structure.py (`/api/v1/courses`) since assets are
course-scoped, but kept in its own file/router since it deals with
multipart uploads and raw file responses instead of the JSON CRUD the other
course-scoped routers do.

Upload and delete are gated by get_current_user (CMS-only actions, same
single-user reasoning as course_structure.py). Listing and serving the raw
file are left public: listing is only used by the CMS asset picker today
(no public browsing UI exists), but it returns nothing sensitive (course
content metadata, not auth data), and serving must be public so plain
`<img src>`/`<video src>` tags can load it without attaching auth headers.

To wire this in: `from learnia_backend.routers.assets import router as
assets_router` then `app.include_router(assets_router)` in main.py.
"""

from fastapi import APIRouter, Depends, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session as DbSession

from learnia_backend.database import get_db
from learnia_backend.deps import get_current_user
from learnia_backend.exceptions import NotFoundError, ValidationAppError
from learnia_backend.models.user import User
from learnia_backend.repositories.asset_repository import AssetRepository
from learnia_backend.schemas.assets import AssetOut
from learnia_backend.services.storage import AssetStorage, get_storage

router = APIRouter(prefix="/api/v1/courses", tags=["assets"])


def _asset_out(asset) -> AssetOut:
    return AssetOut(
        id=str(asset.id),
        courseId=str(asset.course_id),
        filename=asset.filename,
        mimeType=asset.mime_type,
        sizeBytes=asset.size_bytes,
        url=f"/api/v1/courses/assets/{asset.id}/file",
        uploadedAt=asset.uploaded_at,
    )


@router.post("/{course_id}/assets", response_model=AssetOut)
async def upload_asset(
    course_id: int,
    file: UploadFile,
    db: DbSession = Depends(get_db),
    storage: AssetStorage = Depends(get_storage),
    _user: User = Depends(get_current_user),
) -> AssetOut:
    if file.filename is None:
        raise ValidationAppError("Uploaded file has no filename")
    file_bytes = await file.read()
    repo = AssetRepository(db, storage)
    asset = repo.create(
        course_id,
        filename=file.filename,
        mime_type=file.content_type or "application/octet-stream",
        file_bytes=file_bytes,
    )
    return _asset_out(asset)


@router.get("/{course_id}/assets", response_model=list[AssetOut])
def list_assets(
    course_id: int,
    db: DbSession = Depends(get_db),
    storage: AssetStorage = Depends(get_storage),
) -> list[AssetOut]:
    repo = AssetRepository(db, storage)
    return [_asset_out(asset) for asset in repo.list_for_course(course_id)]


@router.get("/assets/{asset_id}/file")
def serve_asset_file(
    asset_id: int,
    db: DbSession = Depends(get_db),
    storage: AssetStorage = Depends(get_storage),
) -> FileResponse:
    repo = AssetRepository(db, storage)
    asset = repo.get(asset_id)
    full_path = storage.root / asset.storage_path  # local-storage specific
    if not full_path.exists():
        raise NotFoundError(f"Asset file missing on disk: {asset_id}")
    return FileResponse(full_path, media_type=asset.mime_type, filename=asset.filename)


@router.delete("/assets/{asset_id}", status_code=204)
def delete_asset(
    asset_id: int,
    db: DbSession = Depends(get_db),
    storage: AssetStorage = Depends(get_storage),
    _user: User = Depends(get_current_user),
) -> None:
    AssetRepository(db, storage).delete(asset_id)
