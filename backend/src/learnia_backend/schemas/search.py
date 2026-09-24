"""
Pydantic schemas for global search (14-global-search, routers/search.py).
Same camelCase-over-the-wire convention as schemas/courses.py.
"""

from pydantic import BaseModel, ConfigDict, Field


class SearchResult(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    type: str  # "course" | "module" | "chapter" | "page"
    id: str
    title: str
    # FTS5 snippet() output: a short excerpt with the match highlighted
    # (wrapped in <b>...</b> — see routers/search.py), empty for a
    # title-only match with no body text (modules/chapters).
    snippet: str
    course_id: str = Field(alias="courseId")
    course_slug: str = Field(alias="courseSlug")


class SearchResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    results: list[SearchResult]
