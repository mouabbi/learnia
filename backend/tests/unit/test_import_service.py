"""
Unit tests for services/import_service.py (13-ai-content-import-validation):
validate() never writes; commit() re-validates then writes. Exercised
directly against a DB session.
"""

import json

import pytest

from learnia_backend.exceptions import NotFoundError, ValidationAppError
from learnia_backend.models.chapter import Chapter
from learnia_backend.models.course import Course
from learnia_backend.models.module import Module
from learnia_backend.models.page import Page
from learnia_backend.services.import_service import ImportService


def _make_course(db, slug="course-a", title="Course A") -> Course:
    course = Course(slug=slug, title=title, description="desc")
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


def _make_module(db, course, title="Module 1", position=0) -> Module:
    module = Module(course_id=course.id, title=title, position=position)
    db.add(module)
    db.commit()
    db.refresh(module)
    return module


def _make_chapter(db, module, course, title="Chapter 1", position=0) -> Chapter:
    chapter = Chapter(module_id=module.id, course_id=course.id, title=title, position=position)
    db.add(chapter)
    db.commit()
    db.refresh(chapter)
    return chapter


def _make_page(db, chapter, course, title="Page 1", position=0) -> Page:
    page = Page(chapter_id=chapter.id, course_id=course.id, title=title, position=position)
    db.add(page)
    db.commit()
    db.refresh(page)
    return page


# -- validate() never writes -------------------------------------------


def test_validate_bad_json_returns_invalid_with_json_error(db):
    result = ImportService(db).validate("course", "{not valid json")
    assert result.valid is False
    assert result.errors[0].field == "(json)"
    assert "Invalid JSON" in result.errors[0].message


def test_validate_course_scope_valid_payload_returns_parsed_dict(db):
    raw = json.dumps({"title": "New Title", "description": "New desc"})
    result = ImportService(db).validate("course", raw)
    assert result.valid is True
    # "modules" is optional (full-structure import) and defaults to empty.
    assert result.parsed == {"title": "New Title", "description": "New desc", "modules": []}


def test_validate_course_scope_missing_title_is_invalid(db):
    raw = json.dumps({"description": "no title"})
    result = ImportService(db).validate("course", raw)
    assert result.valid is False
    assert any(e.field == "title" for e in result.errors)


def test_validate_never_writes_to_db(db):
    course = _make_course(db)
    raw = json.dumps({"title": "Should Not Persist"})
    ImportService(db).validate("course", raw)
    db.refresh(course)
    assert course.title == "Course A"


def test_validate_unknown_scope_raises_validation_error(db):
    with pytest.raises(ValidationAppError):
        ImportService(db).validate("bogus", "{}")


def test_validate_question_list_scope_returns_parsed_list(db):
    raw = json.dumps(
        [
            {
                "text": "2+2?",
                "options": [{"id": "a", "text": "4"}, {"id": "b", "text": "5"}],
                "correctOptionIds": ["a"],
            }
        ]
    )
    result = ImportService(db).validate("module-qcm", raw)
    assert result.valid is True
    assert result.parsed[0]["text"] == "2+2?"


def test_validate_question_list_missing_correct_option_ids_is_invalid(db):
    raw = json.dumps(
        [{"text": "2+2?", "options": [{"id": "a", "text": "4"}]}]
    )
    result = ImportService(db).validate("module-qcm", raw)
    assert result.valid is False


# -- commit() re-validates and writes ------------------------------------


def test_commit_course_updates_title_and_description(db):
    course = _make_course(db)
    raw = json.dumps({"title": "Updated Title", "description": "Updated desc"})
    out = ImportService(db).commit_course(course.id, raw)
    assert out["title"] == "Updated Title"
    db.refresh(course)
    assert course.title == "Updated Title"
    assert course.description == "Updated desc"


def test_commit_course_invalid_json_raises_before_writing(db):
    course = _make_course(db)
    with pytest.raises(ValidationAppError):
        ImportService(db).commit_course(course.id, "{not json")
    db.refresh(course)
    assert course.title == "Course A"


def test_commit_course_unknown_course_raises_not_found(db):
    raw = json.dumps({"title": "X"})
    with pytest.raises(NotFoundError):
        ImportService(db).commit_course(999, raw)


def test_commit_module_updates_title(db):
    course = _make_course(db)
    module = _make_module(db, course)
    raw = json.dumps({"title": "New Module Title"})
    out = ImportService(db).commit_module(course.id, module.id, raw)
    assert out["title"] == "New Module Title"


def test_commit_module_without_module_id_creates_module_with_nested_content(db):
    course = _make_course(db)
    raw = json.dumps(
        {
            "title": "New Module",
            "chapters": [
                {
                    "title": "Chapter 1",
                    "pages": [
                        {
                            "title": "Page 1",
                            "blocks": [{"type": "paragraph", "text": "Hello."}],
                        }
                    ],
                }
            ],
        }
    )
    out = ImportService(db).commit_module(course.id, None, raw)
    assert out["title"] == "New Module"


def test_commit_chapter_updates_title(db):
    course = _make_course(db)
    module = _make_module(db, course)
    chapter = _make_chapter(db, module, course)
    raw = json.dumps({"title": "New Chapter Title"})
    out = ImportService(db).commit_chapter(chapter.id, raw)
    assert out["title"] == "New Chapter Title"


def test_commit_page_writes_blocks_when_page_is_empty(db):
    course = _make_course(db)
    module = _make_module(db, course)
    chapter = _make_chapter(db, module, course)
    page = _make_page(db, chapter, course)
    raw = json.dumps(
        {"blocks": [{"type": "heading", "text": "Hello", "level": 2}]}
    )
    out = ImportService(db).commit_page(page.id, raw, replace=False)
    assert out["blocks"][0]["text"] == "Hello"


def test_commit_page_requires_replace_true_to_overwrite_existing_content(db):
    course = _make_course(db)
    module = _make_module(db, course)
    chapter = _make_chapter(db, module, course)
    page = _make_page(db, chapter, course)
    raw = json.dumps({"blocks": [{"type": "heading", "text": "First", "level": 2}]})
    ImportService(db).commit_page(page.id, raw, replace=False)

    raw2 = json.dumps({"blocks": [{"type": "heading", "text": "Second", "level": 2}]})
    with pytest.raises(ValidationAppError):
        ImportService(db).commit_page(page.id, raw2, replace=False)


def test_commit_page_with_replace_true_overwrites_existing_content(db):
    course = _make_course(db)
    module = _make_module(db, course)
    chapter = _make_chapter(db, module, course)
    page = _make_page(db, chapter, course)
    raw = json.dumps({"blocks": [{"type": "heading", "text": "First", "level": 2}]})
    ImportService(db).commit_page(page.id, raw, replace=False)

    raw2 = json.dumps({"blocks": [{"type": "heading", "text": "Second", "level": 2}]})
    out = ImportService(db).commit_page(page.id, raw2, replace=True)
    assert out["blocks"][0]["text"] == "Second"


def test_commit_questions_module_qcm_creates_questions(db):
    course = _make_course(db)
    module = _make_module(db, course)
    raw = json.dumps(
        [
            {
                "text": "2+2?",
                "options": [{"id": "a", "text": "4"}, {"id": "b", "text": "5"}],
                "correctOptionIds": ["a"],
            }
        ]
    )
    created = ImportService(db).commit_questions(
        "module-qcm", course_id=course.id, module_id=module.id, replace=False, raw_json=raw
    )
    assert len(created) == 1
    assert created[0]["text"] == "2+2?"


def test_commit_questions_module_qcm_requires_module_id(db):
    course = _make_course(db)
    raw = json.dumps(
        [{"text": "q", "options": [{"id": "a", "text": "x"}], "correctOptionIds": ["a"]}]
    )
    with pytest.raises(ValidationAppError):
        ImportService(db).commit_questions(
            "module-qcm", course_id=course.id, module_id=None, replace=False, raw_json=raw
        )


def test_commit_questions_existing_bank_requires_replace_flag(db):
    course = _make_course(db)
    module = _make_module(db, course)
    raw = json.dumps(
        [{"text": "q1", "options": [{"id": "a", "text": "x"}], "correctOptionIds": ["a"]}]
    )
    ImportService(db).commit_questions(
        "module-qcm", course_id=course.id, module_id=module.id, replace=False, raw_json=raw
    )
    with pytest.raises(ValidationAppError):
        ImportService(db).commit_questions(
            "module-qcm", course_id=course.id, module_id=module.id, replace=False, raw_json=raw
        )


def test_commit_questions_replace_true_deletes_old_bank_atomically(db):
    course = _make_course(db)
    module = _make_module(db, course)
    raw1 = json.dumps(
        [{"text": "q1", "options": [{"id": "a", "text": "x"}], "correctOptionIds": ["a"]}]
    )
    ImportService(db).commit_questions(
        "module-qcm", course_id=course.id, module_id=module.id, replace=False, raw_json=raw1
    )
    raw2 = json.dumps(
        [{"text": "q2", "options": [{"id": "a", "text": "y"}], "correctOptionIds": ["a"]}]
    )
    created = ImportService(db).commit_questions(
        "module-qcm", course_id=course.id, module_id=module.id, replace=True, raw_json=raw2
    )
    assert len(created) == 1
    assert created[0]["text"] == "q2"


def test_commit_questions_invalid_json_raises_before_any_writes(db):
    course = _make_course(db)
    module = _make_module(db, course)
    with pytest.raises(ValidationAppError):
        ImportService(db).commit_questions(
            "module-qcm",
            course_id=course.id,
            module_id=module.id,
            replace=False,
            raw_json="{not json",
        )
    from learnia_backend.repositories.question_repository import QuestionRepository

    assert QuestionRepository(db).list_for_module(module.id) == []


def test_commit_questions_final_exam_scope_uses_course_id_not_module_id(db):
    course = _make_course(db)
    raw = json.dumps(
        [{"text": "final q", "options": [{"id": "a", "text": "x"}], "correctOptionIds": ["a"]}]
    )
    created = ImportService(db).commit_questions(
        "final-exam", course_id=course.id, module_id=None, replace=False, raw_json=raw
    )
    assert len(created) == 1
