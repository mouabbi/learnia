"""
Unit tests for services/prompt_builder.py (12-ai-prompt-builder) — pure
prompt-string assembly plus the scope-validation helpers, exercised
directly against a DB session (no HTTP client needed).
"""

import json

import pytest

from learnia_backend.exceptions import NotFoundError, ValidationAppError
from learnia_backend.models.chapter import Chapter
from learnia_backend.models.course import Course
from learnia_backend.models.module import Module
from learnia_backend.models.page import Page
from learnia_backend.schemas.prompt_builder import SCOPES
from learnia_backend.services.prompt_builder import PromptBuilderService


def _make_course(db, slug="python-101", title="Python 101", description="Learn Python") -> Course:
    course = Course(slug=slug, title=title, description=description)
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


def _make_module(db, course, title="Basics", position=0) -> Module:
    module = Module(course_id=course.id, title=title, position=position)
    db.add(module)
    db.commit()
    db.refresh(module)
    return module


def _make_chapter(db, module, course, title="Variables", position=0) -> Chapter:
    chapter = Chapter(module_id=module.id, course_id=course.id, title=title, position=position)
    db.add(chapter)
    db.commit()
    db.refresh(chapter)
    return chapter


def test_scopes_tuple_lists_all_six_known_scopes():
    assert set(SCOPES) == {"course", "module", "chapter", "page", "module-qcm", "final-exam"}


def test_build_course_prompt_includes_course_title_and_description(db):
    course = _make_course(db)
    prompt = PromptBuilderService(db).build_course_prompt(course.id)
    assert "Python 101" in prompt
    assert "Learn Python" in prompt
    assert "STRICT JSON ONLY" in prompt


def test_build_course_prompt_lists_existing_modules_for_coherence(db):
    course = _make_course(db)
    _make_module(db, course, title="Intro")
    prompt = PromptBuilderService(db).build_course_prompt(course.id)
    assert "Intro" in prompt


def test_build_course_prompt_unknown_course_raises_not_found(db):
    with pytest.raises(NotFoundError):
        PromptBuilderService(db).build_course_prompt(999)


def test_build_module_prompt_embeds_live_schema_from_pydantic_model(db):
    course = _make_course(db)
    prompt = PromptBuilderService(db).build_module_prompt(course.id)
    # The schema block is a live json.dumps of ModuleMetadataJSON's schema —
    # assert its "title" property shows up as real JSON, not hand-typed text.
    assert '"title"' in prompt
    assert "properties" in prompt


def test_build_chapter_prompt_requires_valid_module_in_course(db):
    course = _make_course(db)
    with pytest.raises(NotFoundError):
        PromptBuilderService(db).build_chapter_prompt(course.id, 999)


def test_build_chapter_prompt_lists_sibling_chapters(db):
    course = _make_course(db)
    module = _make_module(db, course)
    _make_chapter(db, module, course, title="Loops")
    prompt = PromptBuilderService(db).build_chapter_prompt(course.id, module.id)
    assert "Loops" in prompt
    assert module.title in prompt


def test_build_chapter_prompt_shows_placeholder_when_no_chapters_yet(db):
    course = _make_course(db)
    module = _make_module(db, course)
    prompt = PromptBuilderService(db).build_chapter_prompt(course.id, module.id)
    assert "no chapters yet" in prompt


def test_build_page_prompt_requires_chapter_belongs_to_course(db):
    course = _make_course(db)
    other_course = _make_course(db, slug="other", title="Other")
    module = _make_module(db, other_course)
    chapter = _make_chapter(db, module, other_course)
    with pytest.raises(NotFoundError):
        PromptBuilderService(db).build_page_prompt(course.id, chapter.id)


def test_build_page_prompt_lists_sibling_pages(db):
    course = _make_course(db)
    module = _make_module(db, course)
    chapter = _make_chapter(db, module, course)
    page = Page(chapter_id=chapter.id, course_id=course.id, title="Intro page", position=0)
    db.add(page)
    db.commit()
    prompt = PromptBuilderService(db).build_page_prompt(course.id, chapter.id)
    assert "Intro page" in prompt


def test_build_module_qcm_prompt_requests_at_least_50_questions(db):
    course = _make_course(db)
    module = _make_module(db, course)
    prompt = PromptBuilderService(db).build_module_qcm_prompt(course.id, module.id)
    assert "AT LEAST 50" in prompt


def test_build_final_exam_prompt_requests_at_least_100_questions(db):
    course = _make_course(db)
    prompt = PromptBuilderService(db).build_final_exam_prompt(course.id)
    assert "AT LEAST 100" in prompt


def test_build_dispatches_chapter_scope_requires_module_id(db):
    course = _make_course(db)
    with pytest.raises(ValidationAppError):
        PromptBuilderService(db).build("chapter", course.id, module_id=None, chapter_id=None)


def test_build_dispatches_page_scope_requires_chapter_id(db):
    course = _make_course(db)
    with pytest.raises(ValidationAppError):
        PromptBuilderService(db).build("page", course.id, module_id=None, chapter_id=None)


def test_build_dispatches_module_qcm_scope_requires_module_id(db):
    course = _make_course(db)
    with pytest.raises(ValidationAppError):
        PromptBuilderService(db).build("module-qcm", course.id, module_id=None, chapter_id=None)


def test_build_unknown_scope_raises_validation_error(db):
    course = _make_course(db)
    with pytest.raises(ValidationAppError):
        PromptBuilderService(db).build("bogus", course.id, module_id=None, chapter_id=None)


def test_build_final_exam_scope_ignores_module_and_chapter_ids(db):
    course = _make_course(db)
    # final-exam needs neither moduleId nor chapterId — should not raise.
    prompt = PromptBuilderService(db).build(
        "final-exam", course.id, module_id=None, chapter_id=None
    )
    assert isinstance(prompt, str)


def test_schema_for_course_scope_returns_valid_json_schema_dict(db):
    schema = PromptBuilderService(db).schema_for("course")
    assert schema["properties"]["title"]["type"] == "string"


def test_schema_for_qcm_scopes_returns_array_schema(db):
    schema = PromptBuilderService(db).schema_for("module-qcm")
    assert schema["type"] == "array"
    assert "items" in schema


def test_schema_for_unknown_scope_raises_validation_error(db):
    with pytest.raises(ValidationAppError):
        PromptBuilderService(db).schema_for("bogus")


def test_prompt_schema_block_is_valid_json(db):
    # Regression: the embedded schema block must be real parseable JSON
    # (json.dumps output), not just schema-shaped text, since the import
    # flow (13) validates against the *same* Pydantic model.
    course = _make_course(db)
    prompt = PromptBuilderService(db).build_course_prompt(course.id)
    schema_text = prompt.split("JSON schema to satisfy:\n", 1)[1]
    parsed = json.loads(schema_text)
    assert parsed["type"] == "object"
