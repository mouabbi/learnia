"""
Unit tests for services/search_index.py (14-global-search) and
routers/search.py's `_build_match_query` helper — exercised directly
against a DB session (the `db` fixture's engine already gets the FTS5
table via app startup when routed through `client`, but here we call
`ensure_search_index` ourselves since these tests don't use the client).
"""

from learnia_backend.models.course import Course
from learnia_backend.routers.search import _build_match_query
from learnia_backend.services.search_index import ensure_search_index, reindex_course


def test_build_match_query_empty_string_returns_none():
    assert _build_match_query("") is None
    assert _build_match_query("   ") is None


def test_build_match_query_single_token_becomes_prefix_match():
    assert _build_match_query("python") == '"python"*'


def test_build_match_query_multiple_tokens_joined_with_implicit_and():
    assert _build_match_query("python loops") == '"python"* "loops"*'


def test_build_match_query_escapes_embedded_double_quotes():
    # A literal `"` in user input must be doubled per FTS5 quoting rules,
    # not left as-is (which would break out of the quoted token).
    result = _build_match_query('say "hi"')
    assert '""hi""' in result


def test_build_match_query_strips_surrounding_whitespace():
    assert _build_match_query("  python  ") == '"python"*'


def test_reindex_course_inserts_a_row_findable_by_title(db):
    ensure_search_index(db.get_bind())
    course = Course(slug="py", title="Python Basics", description="Learn the basics")
    db.add(course)
    db.commit()
    reindex_course(db, course.id)

    from sqlalchemy import text

    rows = db.execute(
        text("SELECT title FROM search_index WHERE search_index MATCH 'python*'")
    ).all()
    assert any(r.title == "Python Basics" for r in rows)


def test_reindex_course_does_not_duplicate_row_on_repeat_call(db):
    # Regression: reindex_* deletes-then-inserts by entity_type/entity_id
    # since FTS5 has no real unique constraint of its own — calling it
    # twice for the same course must not leave two rows behind.
    ensure_search_index(db.get_bind())
    course = Course(slug="py", title="Python Basics", description="Learn the basics")
    db.add(course)
    db.commit()
    reindex_course(db, course.id)
    reindex_course(db, course.id)

    from sqlalchemy import text

    rows = db.execute(
        text(
            "SELECT COUNT(*) AS n FROM search_index "
            "WHERE entity_type = 'course' AND entity_id = :id"
        ),
        {"id": course.id},
    ).one()
    assert rows.n == 1
