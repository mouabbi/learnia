"""
Unit tests for services/dashboard_service.py's get_dashboard aggregation
(17-dashboard) — exercised directly against a DB session.
"""

from learnia_backend.models.chapter import Chapter
from learnia_backend.models.course import Course
from learnia_backend.models.enums import ContentStatus, LearningStatus
from learnia_backend.models.module import Module
from learnia_backend.models.page import Page
from learnia_backend.models.user import User
from learnia_backend.repositories.progress_repository import ProgressRepository
from learnia_backend.services.dashboard_service import get_dashboard


def _make_user(db, email="u@test.com") -> User:
    user = User(email=email, hashed_password="hash")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_course(db, slug, title, status=ContentStatus.PUBLISHED) -> Course:
    course = Course(slug=slug, title=title, content_status=status)
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


def _make_page(db, course) -> Page:
    """set_last_page() stores a real FK to pages, so tests exercising it need
    an actual Page row rather than a made-up id."""
    module = Module(course_id=course.id, title="Module", position=1)
    db.add(module)
    db.flush()
    chapter = Chapter(course_id=course.id, module_id=module.id, title="Chapter", position=1)
    db.add(chapter)
    db.flush()
    page = Page(course_id=course.id, chapter_id=chapter.id, title="Page", position=1)
    db.add(page)
    db.commit()
    db.refresh(page)
    return page


def test_get_dashboard_empty_state_has_no_continue_learning(db):
    user = _make_user(db)
    result = get_dashboard(db, user.id)
    assert result["continueLearning"] is None
    assert result["courses"] == []
    assert result["recommendations"] == []
    assert result["stats"] == {"inProgressCount": 0, "completedCount": 0, "totalCount": 0}


def test_get_dashboard_lists_published_courses_with_not_started_status(db):
    user = _make_user(db)
    _make_course(db, "a", "Course A")
    result = get_dashboard(db, user.id)
    assert len(result["courses"]) == 1
    assert result["courses"][0]["learningStatus"] == "not_started"
    assert result["courses"][0]["progressPct"] == 0


def test_get_dashboard_excludes_unpublished_courses_from_course_list(db):
    user = _make_user(db)
    _make_course(db, "draft", "Draft Course", status=ContentStatus.DRAFT)
    result = get_dashboard(db, user.id)
    assert result["courses"] == []
    assert result["stats"]["totalCount"] == 0


def test_get_dashboard_continue_learning_reflects_most_recently_touched_in_progress_course(db):
    user = _make_user(db)
    course_a = _make_course(db, "a", "Course A")
    course_b = _make_course(db, "b", "Course B")
    page_a = _make_page(db, course_a)
    page_b = _make_page(db, course_b)
    progress_repo = ProgressRepository(db)
    progress_repo.set_last_page(user.id, course_a.id, page_id=page_a.id)
    progress_repo.set_last_page(user.id, course_b.id, page_id=page_b.id)

    result = get_dashboard(db, user.id)
    # Both are IN_PROGRESS; course_b touched last -> should be "continue learning".
    assert result["continueLearning"]["course"]["id"] == course_b.id


def test_get_dashboard_continue_learning_is_none_without_in_progress_course(db):
    user = _make_user(db)
    _make_course(db, "a", "Course A")
    result = get_dashboard(db, user.id)
    assert result["continueLearning"] is None


def test_get_dashboard_recommendations_include_ready_and_published_not_started(db):
    user = _make_user(db)
    ready = _make_course(db, "ready", "Ready Course", status=ContentStatus.READY)
    published = _make_course(db, "pub", "Published Course", status=ContentStatus.PUBLISHED)
    result = get_dashboard(db, user.id)
    rec_ids = {c["id"] for c in result["recommendations"]}
    assert ready.id in rec_ids
    assert published.id in rec_ids


def test_get_dashboard_recommendations_exclude_courses_user_already_started(db):
    user = _make_user(db)
    course = _make_course(db, "a", "Course A")
    page = _make_page(db, course)
    ProgressRepository(db).set_last_page(user.id, course.id, page_id=page.id)
    result = get_dashboard(db, user.id)
    rec_ids = {c["id"] for c in result["recommendations"]}
    assert course.id not in rec_ids


def test_get_dashboard_recommendations_exclude_planned_and_draft_and_archived(db):
    user = _make_user(db)
    _make_course(db, "planned", "Planned", status=ContentStatus.PLANNED)
    _make_course(db, "draft", "Draft", status=ContentStatus.DRAFT)
    _make_course(db, "archived", "Archived", status=ContentStatus.ARCHIVED)
    result = get_dashboard(db, user.id)
    assert result["recommendations"] == []


def test_get_dashboard_recommendations_sorted_by_course_creation_order(db):
    user = _make_user(db)
    first = _make_course(db, "a", "A", status=ContentStatus.READY)
    second = _make_course(db, "b", "B", status=ContentStatus.READY)
    result = get_dashboard(db, user.id)
    ids = [c["id"] for c in result["recommendations"]]
    assert ids == sorted(ids)
    assert ids.index(first.id) < ids.index(second.id)


def test_get_dashboard_stats_counts_in_progress_and_completed_separately(db):
    user = _make_user(db)
    in_progress_course = _make_course(db, "a", "A")
    completed_course = _make_course(db, "b", "B")
    in_progress_page = _make_page(db, in_progress_course)
    progress_repo = ProgressRepository(db)
    progress_repo.set_last_page(user.id, in_progress_course.id, page_id=in_progress_page.id)
    progress = progress_repo.get_or_create_learning_progress(user.id, completed_course.id)
    progress.status = LearningStatus.COMPLETED
    db.commit()

    result = get_dashboard(db, user.id)
    assert result["stats"]["inProgressCount"] == 1
    assert result["stats"]["completedCount"] == 1
    assert result["stats"]["totalCount"] == 2


def test_get_dashboard_stats_only_counts_published_courses(db):
    user = _make_user(db)
    _make_course(db, "a", "A", status=ContentStatus.PUBLISHED)
    _make_course(db, "b", "B", status=ContentStatus.DRAFT)
    result = get_dashboard(db, user.id)
    assert result["stats"]["totalCount"] == 1


def test_get_dashboard_is_scoped_per_user(db):
    user_a = _make_user(db, email="a@test.com")
    user_b = _make_user(db, email="b@test.com")
    course = _make_course(db, "a", "A")
    page = _make_page(db, course)
    ProgressRepository(db).set_last_page(user_a.id, course.id, page_id=page.id)

    result_a = get_dashboard(db, user_a.id)
    result_b = get_dashboard(db, user_b.id)
    assert result_a["courses"][0]["learningStatus"] == "in_progress"
    assert result_b["courses"][0]["learningStatus"] == "not_started"
