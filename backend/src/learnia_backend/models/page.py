"""
Page — third and last level of a course's structure, belongs to one Chapter.
`course_id` denormalized for the same reason as Chapter.course_id.

Page CONTENT (the ordered list of blocks: heading/paragraph/code/image/...,
see 07-content-system) deliberately lives OUTSIDE the database, as one JSON
file per page — not as DB rows. Content is authored only through the CMS's
structured editor (never raw JSON), validated against Pydantic discriminated
unions keyed on each block's `type`, and rendered by a matching React
block-registry. Keeping it out of SQL means adding a new block type is just
a new Pydantic model + React component, never a migration.

`content_path` is the DB's only pointer into that file: deterministic, set
once after the row's `id` is known (`content/{course.slug}/{page.id}.json`),
never user-edited. A page has no content file yet until first saved by the
CMS — `content_path` stays NULL until then, and code must treat "no file at
that path" as "empty page", not an error.

`search_text` is a denormalized plain-text extract of that JSON file's
content, kept in sync by the CMS's save path (re-extract on every content
write) and consumed by SQLite FTS5 for global search (14-global-search) —
it exists because the source of truth for that text lives outside any DB
column FTS5 could index directly.

"Sections" (1.1, 1.2 numbering) are NOT rows here — they're a block-level
construct inside the JSON (e.g. a `heading` block), identified by a block
position/anchor id, not a foreign key. See Note.section_id.
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from learnia_backend.database import Base
from learnia_backend.utils.time import utc_now_naive


class Page(Base):
    __tablename__ = "pages"

    id: Mapped[int] = mapped_column(primary_key=True)
    chapter_id: Mapped[int] = mapped_column(
        ForeignKey("chapters.id", ondelete="CASCADE"), index=True
    )
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(200))
    position: Mapped[int] = mapped_column(Integer())
    content_path: Mapped[str | None] = mapped_column(String(500), default=None)
    search_text: Mapped[str | None] = mapped_column(Text(), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(), default=utc_now_naive)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(), default=utc_now_naive, onupdate=utc_now_naive
    )
