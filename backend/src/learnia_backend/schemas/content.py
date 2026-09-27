"""
Page content blocks (07-content-system): an ordered list of typed blocks,
stored as one JSON file per page (see models/page.py + services/
content_service.py), never as DB rows. A Pydantic discriminated union on
`type` is both the validation layer for CMS writes and the response shape
for the content API — one schema, no separate "input" vs "output" block
models.

`schema_version` is written into every file now (07's open question,
answered "yes, cheap insurance") even though full content versioning
(22-future-versioning) is deferred — it exists purely so a future migration
of the block format has something to switch on.

Extensibility (07's concept 6): adding a block type is one new class here +
one entry in the Annotated union + one React component in the frontend's
block registry — never a migration, since content lives in files.
"""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

CURRENT_SCHEMA_VERSION = 1


class HeadingBlock(BaseModel):
    type: Literal["heading"] = "heading"
    text: str
    level: int = 2
    numbered: bool = False


class ParagraphBlock(BaseModel):
    type: Literal["paragraph"] = "paragraph"
    text: str


class CodeBlock(BaseModel):
    type: Literal["code"] = "code"
    code: str
    language: str | None = None


class TerminalBlock(BaseModel):
    """Same idea as CodeBlock but rendered as a terminal/output panel."""

    type: Literal["terminal"] = "terminal"
    text: str


class ImageBlock(BaseModel):
    type: Literal["image"] = "image"
    src: str
    alt: str = ""
    caption: str | None = None


class VideoBlock(BaseModel):
    type: Literal["video"] = "video"
    src: str
    caption: str | None = None


class YoutubeBlock(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    type: Literal["youtube"] = "youtube"
    video_id: str = Field(alias="videoId")
    caption: str | None = None


class LinkBlock(BaseModel):
    type: Literal["link"] = "link"
    href: str
    text: str


class QuoteBlock(BaseModel):
    type: Literal["quote"] = "quote"
    text: str
    attribution: str | None = None


class CalloutBlock(BaseModel):
    """
    Covers tip/warning/important/note (07's block-type list) as one block
    with a `variant`, instead of four near-identical block classes that
    would drift apart — same reasoning as Question's `scope` discriminator.
    """

    type: Literal["callout"] = "callout"
    variant: Literal["tip", "warning", "important", "note"] = "note"
    text: str


class ListBlock(BaseModel):
    type: Literal["list"] = "list"
    ordered: bool = False
    items: list[str]


class TableBlock(BaseModel):
    type: Literal["table"] = "table"
    headers: list[str]
    rows: list[list[str]]


ContentBlock = Annotated[
    (
        HeadingBlock
        | ParagraphBlock
        | CodeBlock
        | TerminalBlock
        | ImageBlock
        | VideoBlock
        | YoutubeBlock
        | LinkBlock
        | QuoteBlock
        | CalloutBlock
        | ListBlock
        | TableBlock
    ),
    Field(discriminator="type"),
]


class PageContent(BaseModel):
    """The whole JSON file for one page: `{schemaVersion, blocks}`."""

    model_config = ConfigDict(populate_by_name=True)

    schema_version: int = Field(default=CURRENT_SCHEMA_VERSION, alias="schemaVersion")
    blocks: list[ContentBlock] = Field(default_factory=list)
