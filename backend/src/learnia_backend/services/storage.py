"""
Storage abstraction for uploaded assets (15-assets). Everything above this
layer (routers/services dealing with `Asset` rows) talks only to the
`AssetStorage` protocol below — never to `Path`/`open()`/S3 SDK calls
directly — so swapping the local filesystem implementation for an S3 one
later (per 21-deployment) means writing one new class here, not touching
callers or the DB schema.

`storage_path` (the string persisted on the `Asset` row) is deliberately
opaque to callers: for the local implementation it's a path relative to
ASSETS_ROOT, for a future S3 implementation it would be a bucket key. Only
`resolve_url()` knows how to turn that opaque string into something a
browser can fetch — for local storage that's this app's own
`/api/v1/courses/assets/{id}/file` route (see routers/assets.py), for S3 it
would be a presigned URL. Callers never build asset URLs themselves.

ASSETS_ROOT mirrors CONTENT_ROOT's pattern in services/content_service.py:
a top-level directory sibling to `content/`, resolved relative to this
file so it doesn't depend on the process's current working directory.
"""

import uuid
from pathlib import Path
from typing import Protocol

ASSETS_ROOT = Path(__file__).resolve().parent.parent.parent.parent / "assets"


class AssetStorage(Protocol):
    def save(self, file_bytes: bytes, filename: str, course_slug: str) -> str:
        """Persist the file, return the opaque `storage_path` to store on the Asset row."""
        ...

    def resolve_url(self, storage_path: str) -> str:
        """Turn a stored `storage_path` into a URL a browser can fetch."""
        ...

    def delete(self, storage_path: str) -> None:
        """Remove the underlying file. Safe to call on an already-missing file."""
        ...


class LocalFilesystemStorage:
    """
    Files live under `ASSETS_ROOT/{course_slug}/{uuid}.{ext}` (15-assets'
    path convention) — the uuid avoids filename collisions between two
    uploads of e.g. "diagram.png" in the same course without needing to
    touch the DB to check for one.
    """

    def __init__(self, root: Path = ASSETS_ROOT) -> None:
        self.root = root

    def save(self, file_bytes: bytes, filename: str, course_slug: str) -> str:
        ext = Path(filename).suffix.lower()
        relative_path = f"{course_slug}/{uuid.uuid4().hex}{ext}"
        full_path = self.root / relative_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_bytes(file_bytes)
        return relative_path

    def resolve_url(self, storage_path: str) -> str:
        # Local storage has no standalone URL of its own — callers resolve
        # the *asset id* to a URL via routers/assets.py's file route, not
        # this method, since that route is what actually serves the bytes.
        # Kept on the interface so an S3 implementation (which DOES have a
        # real URL to hand back here, e.g. a presigned one) can implement
        # it meaningfully without changing the Protocol.
        return storage_path

    def delete(self, storage_path: str) -> None:
        full_path = self.root / storage_path
        full_path.unlink(missing_ok=True)


def get_storage() -> AssetStorage:
    """FastAPI-dependency-shaped factory (see routers/assets.py) — swap the
    implementation returned here to move from local disk to S3 later."""
    return LocalFilesystemStorage()
