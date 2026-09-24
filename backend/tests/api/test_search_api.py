"""
Integration tests for routers/search.py (14-global-search):
GET /api/v1/search?q=... Public, no auth gate.
"""

from learnia_backend.models.course import Course
from learnia_backend.services.search_index import reindex_course


def _make_indexed_course(db, slug="py", title="Python Basics", description="Learn loops"):
    course = Course(slug=slug, title=title, description=description)
    db.add(course)
    db.commit()
    db.refresh(course)
    reindex_course(db, course.id)
    return course


def test_search_no_query_returns_empty_results(client):
    res = client.get("/api/v1/search")
    assert res.status_code == 200
    assert res.json()["results"] == []


def test_search_blank_query_returns_empty_results(client):
    res = client.get("/api/v1/search", params={"q": "   "})
    assert res.status_code == 200
    assert res.json()["results"] == []


def test_search_matches_course_title(client, db):
    course = _make_indexed_course(db)
    res = client.get("/api/v1/search", params={"q": "python"})
    assert res.status_code == 200
    results = res.json()["results"]
    assert any(r["title"] == "Python Basics" for r in results)
    assert results[0]["courseId"] == str(course.id)
    assert results[0]["courseSlug"] == course.slug


def test_search_matches_prefix_of_token(client, db):
    _make_indexed_course(db)
    res = client.get("/api/v1/search", params={"q": "pyth"})
    results = res.json()["results"]
    assert any(r["title"] == "Python Basics" for r in results)


def test_search_no_matches_returns_empty_list(client, db):
    _make_indexed_course(db)
    res = client.get("/api/v1/search", params={"q": "nonexistentzzz"})
    assert res.json()["results"] == []


def test_search_result_includes_snippet_field(client, db):
    _make_indexed_course(db)
    res = client.get("/api/v1/search", params={"q": "python"})
    results = res.json()["results"]
    assert "snippet" in results[0]


def test_search_does_not_require_auth(client, db):
    _make_indexed_course(db)
    res = client.get("/api/v1/search", params={"q": "python"})
    assert res.status_code == 200


def test_search_is_case_insensitive(client, db):
    _make_indexed_course(db)
    res = client.get("/api/v1/search", params={"q": "PYTHON"})
    results = res.json()["results"]
    assert any(r["title"] == "Python Basics" for r in results)


def test_search_ranks_title_match_above_body_only_match(client, db):
    # bm25 weighting (title=10.0, body=1.0): a course whose TITLE matches
    # should rank ahead of a course that only matches in its description.
    title_match = Course(slug="a", title="loops course", description="unrelated")
    body_match = Course(slug="b", title="unrelated course", description="all about loops")
    db.add_all([title_match, body_match])
    db.commit()
    reindex_course(db, title_match.id)
    reindex_course(db, body_match.id)

    res = client.get("/api/v1/search", params={"q": "loops"})
    results = res.json()["results"]
    ids = [r["title"] for r in results]
    assert ids.index("loops course") < ids.index("unrelated course")
