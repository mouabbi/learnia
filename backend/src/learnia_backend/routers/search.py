"""
Global search (14-global-search): GET /api/v1/search?q=... across courses,
modules, chapters, and pages, backed by the FTS5 virtual table maintained by
services/search_index.py.

Public, read-only — matches routers/courses.py's public surface, since this
searches the same publicly-readable course content (no auth gate here,
unlike routers/course_structure.py's CMS mutations).

Ranking: FTS5's bm25() with per-column weights, title weighted far above
body, so "title match > content match" (14-global-search/prompts.md concept
3) falls out of one ORDER BY instead of two unioned queries.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session as DbSession

from learnia_backend.database import get_db
from learnia_backend.schemas.search import SearchResponse, SearchResult

router = APIRouter(prefix="/api/v1/search", tags=["search"])

_MAX_RESULTS = 20

# Column order must match services/search_index.py's CREATE VIRTUAL TABLE:
# entity_type, entity_id, course_id, course_slug, title, body. Only title
# and body carry real weight; the rest are UNINDEXED so their weight is
# irrelevant, but bm25() requires one argument per column.
_BM25_WEIGHTS = "0.0, 0.0, 0.0, 0.0, 10.0, 1.0"


def _build_match_query(raw_query: str) -> str | None:
    """
    Turn free-text user input into a safe FTS5 MATCH expression: each
    whitespace-separated token becomes a quoted prefix match
    (`"token"*`), joined with implicit AND. Quoting avoids FTS5 special
    syntax (AND/OR/NOT, -, :, etc.) in the raw query being interpreted as
    query-language operators, and the trailing `*` gives "type as you go"
    prefix matching instead of requiring whole-word matches.
    """
    tokens = raw_query.strip().split()
    if not tokens:
        return None
    escaped = [tok.replace('"', '""') for tok in tokens]
    return " ".join(f'"{tok}"*' for tok in escaped)


@router.get("", response_model=SearchResponse)
def search(
    q: str = Query(default="", description="Free-text search query"),
    db: DbSession = Depends(get_db),
) -> SearchResponse:
    match_expr = _build_match_query(q)
    if match_expr is None:
        return SearchResponse(results=[])

    rows = db.execute(
        text(
            f"""
            SELECT
                entity_type,
                entity_id,
                course_id,
                course_slug,
                title,
                snippet(search_index, 5, '<b>', '</b>', '…', 12) AS snippet
            FROM search_index
            WHERE search_index MATCH :match_expr
            ORDER BY bm25(search_index, {_BM25_WEIGHTS})
            LIMIT :limit
            """
        ),
        {"match_expr": match_expr, "limit": _MAX_RESULTS},
    ).all()

    results = [
        SearchResult(
            type=row.entity_type,
            id=str(row.entity_id),
            title=row.title,
            snippet=row.snippet or "",
            courseId=str(row.course_id),
            courseSlug=row.course_slug,
        )
        for row in rows
    ]
    return SearchResponse(results=results)
