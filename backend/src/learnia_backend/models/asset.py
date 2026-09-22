"""
Asset metadata. Files themselves live on disk (path convention:
`assets/{course.slug}/{uuid}.{ext}`, see 15-assets) behind a storage-
abstraction interface — this table is only the DB-side record, so an S3
migration later touches the storage layer, not this schema.

Course-scoped, not global/shared (v1 decision): every asset belongs to
exactly one course, so deleting a course unambiguously owns cleanup of its
asset rows (and, at the service layer, their files) with no "is anyone else
using this?" check needed.

Content blocks (the `image`/`video` block types in a page's JSON, see
page.py) reference an asset by `id`, never by a resolved URL — the URL is
resolved only at render/serve time. That means this table's `id` must stay a
stable, durable primary key: page JSON files hold long-lived references to
it that a migration can't rewrite the way it could a DB foreign key.
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from learnia_backend.database import Base
from learnia_backend.utils.time import utc_now_naive


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), index=True
    )
    filename: Mapped[str] = mapped_column(String(255))
    mime_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(Integer())
    storage_path: Mapped[str] = mapped_column(String(500))
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(), default=utc_now_naive)
