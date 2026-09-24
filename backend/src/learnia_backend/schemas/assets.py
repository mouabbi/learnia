"""
Pydantic response schema for the assets domain (15-assets, see
routers/assets.py + repositories/asset_repository.py). Upload is a
multipart form (FastAPI `UploadFile` + `Form`), not a JSON body, so there's
no request schema here — only the response shape.

`url` is resolved at response-build time (never stored), matching the
system's design goal: content blocks reference an asset by `id`, and only
this schema's `url` field turns that into something a browser can fetch —
see services/storage.py's docstring on why `storage_path` itself stays
opaque to the frontend.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AssetOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    course_id: str = Field(alias="courseId")
    filename: str
    mime_type: str = Field(alias="mimeType")
    size_bytes: int = Field(alias="sizeBytes")
    url: str
    uploaded_at: datetime = Field(alias="uploadedAt")
