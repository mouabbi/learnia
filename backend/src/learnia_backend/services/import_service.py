"""
Validate + commit pasted AI JSON against the platform's real Pydantic
schemas (13-ai-content-import-validation). Two separate concerns, on
purpose: `validate()` never writes anything (safe to call as often as the
user wants while iterating on their AI chat); `commit()` re-validates from
scratch (never trusts that validate() was called first) and only then
writes, reusing the exact same write paths the hand-authored CMS forms use
(services/content_service.py, repositories/question_repository.py) so
imported content is indistinguishable from hand-authored content.
"""

import json

from pydantic import BaseModel, TypeAdapter, ValidationError
from sqlalchemy.orm import Session

from learnia_backend.exceptions import NotFoundError, ValidationAppError
from learnia_backend.models.chapter import Chapter
from learnia_backend.models.course import Course
from learnia_backend.models.module import Module
from learnia_backend.models.page import Page
from learnia_backend.repositories.question_repository import QuestionRepository
from learnia_backend.repositories.structure_repository import StructureRepository
from learnia_backend.schemas.content import PageContent
from learnia_backend.schemas.import_validation import ImportFieldError, ImportValidateResult
from learnia_backend.schemas.prompt_builder import (
    ChapterMetadataJSON,
    CourseMetadataJSON,
    ModuleMetadataJSON,
)
from learnia_backend.schemas.questions import QuestionWriteRequest
from learnia_backend.services.content_service import ContentService

_QUESTION_LIST_ADAPTER: TypeAdapter = TypeAdapter(list[QuestionWriteRequest])

_MODEL_BY_SCOPE: dict[str, type[BaseModel]] = {
    "course": CourseMetadataJSON,
    "module": ModuleMetadataJSON,
    "chapter": ChapterMetadataJSON,
    "page": PageContent,
}


def _humanize_errors(exc: ValidationError) -> list[ImportFieldError]:
    """Pydantic's ValidationError -> a flat, human-readable field list —
    never a raw stack trace (13 concept 4)."""
    out = []
    for err in exc.errors():
        field = ".".join(str(loc) for loc in err["loc"]) or "(root)"
        out.append(ImportFieldError(field=field, message=err["msg"]))
    return out


def _parse_json(raw: str) -> object:
    try:
        return json.loads(raw)
    except ValueError as exc:
        raise _BadJson(str(exc)) from exc


class _BadJson(Exception):
    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


class ImportService:
    def __init__(self, db: Session) -> None:
        self.db = db

    # -- validate (never writes) ----------------------------------------

    def validate(self, scope: str, raw_json: str) -> ImportValidateResult:
        try:
            data = _parse_json(raw_json)
        except _BadJson as exc:
            return ImportValidateResult(
                valid=False,
                errors=[ImportFieldError(field="(json)", message=f"Invalid JSON: {exc.message}")],
            )

        if scope in ("module-qcm", "final-exam"):
            try:
                parsed = _QUESTION_LIST_ADAPTER.validate_python(data)
            except ValidationError as exc:
                return ImportValidateResult(valid=False, errors=_humanize_errors(exc))
            return ImportValidateResult(
                valid=True, parsed=[q.model_dump(by_alias=True) for q in parsed]
            )

        model = _MODEL_BY_SCOPE.get(scope)
        if model is None:
            raise ValidationAppError(f"Unknown import scope: {scope!r}")
        try:
            parsed = model.model_validate(data)
        except ValidationError as exc:
            return ImportValidateResult(valid=False, errors=_humanize_errors(exc))
        return ImportValidateResult(valid=True, parsed=parsed.model_dump(by_alias=True))

    # -- commit (re-validates, then writes) ------------------------------

    def commit_course(self, course_id: int, raw_json: str) -> dict:
        result = self.validate("course", raw_json)
        if not result.valid:
            raise ValidationAppError("Cannot commit invalid JSON — validate it first")
        course = self.db.get(Course, course_id)
        if course is None:
            raise NotFoundError(f"Course not found: {course_id}")
        course.title = result.parsed["title"]
        course.description = result.parsed.get("description") or ""
        self.db.commit()

        # Full from-scratch structure (see build_course_prompt's no-modules
        # branch) — one commit creates every module/chapter/page, reusing
        # the exact same per-module creation path "Generate module with AI"
        # already uses for a single module.
        created_modules = [
            self._create_module(course_id, module_data)
            for module_data in result.parsed.get("modules", [])
        ]

        return {
            "id": str(course.id),
            "title": course.title,
            "description": course.description,
            "modules": created_modules,
        }

    def commit_module(self, course_id: int, module_id: int | None, raw_json: str) -> dict:
        result = self.validate("module", raw_json)
        if not result.valid:
            raise ValidationAppError("Cannot commit invalid JSON — validate it first")

        if module_id is None:
            # No target module — "Generate module with AI" from the
            # Structure tab toolbar, creating a brand-new module (with its
            # nested chapters/pages, if the AI included them) rather than
            # retitling an existing one.
            return self._create_module(course_id, result.parsed)

        module = self.db.get(Module, module_id)
        if module is None:
            raise NotFoundError(f"Module not found: {module_id}")
        module.title = result.parsed["title"]
        self.db.commit()
        return {"id": str(module.id), "title": module.title}

    def _create_module(self, course_id: int, parsed: dict) -> dict:
        structure = StructureRepository(self.db)
        content_service = ContentService(self.db)

        module = structure.create_module(course_id, parsed["title"])
        for chapter_data in parsed.get("chapters", []):
            chapter = structure.create_chapter(module.id, chapter_data["title"])
            for page_data in chapter_data.get("pages", []):
                page = structure.create_page(chapter.id, page_data["title"])
                if page_data.get("blocks"):
                    content_service.write(page, PageContent(blocks=page_data["blocks"]))
        return {"id": str(module.id), "title": module.title}

    def commit_chapter(self, chapter_id: int, raw_json: str) -> dict:
        result = self.validate("chapter", raw_json)
        if not result.valid:
            raise ValidationAppError("Cannot commit invalid JSON — validate it first")
        chapter = self.db.get(Chapter, chapter_id)
        if chapter is None:
            raise NotFoundError(f"Chapter not found: {chapter_id}")
        chapter.title = result.parsed["title"]
        self.db.commit()
        return {"id": str(chapter.id), "title": chapter.title}

    def commit_page(self, page_id: int, raw_json: str, *, replace: bool) -> dict:
        result = self.validate("page", raw_json)
        if not result.valid:
            raise ValidationAppError("Cannot commit invalid JSON — validate it first")
        page = StructureRepository(self.db).get_page(page_id)
        content_service = ContentService(self.db)
        existing = content_service.read(page)
        if existing.blocks and not replace:
            raise ValidationAppError(
                f"Page {page_id} already has {len(existing.blocks)} block(s) of "
                f"content — pass replace:true to overwrite"
            )
        new_content = PageContent.model_validate(result.parsed)
        written = content_service.write(page, new_content)
        return written.model_dump(by_alias=True)

    def commit_questions(
        self,
        scope: str,
        *,
        course_id: int,
        module_id: int | None,
        replace: bool,
        raw_json: str,
    ) -> list[dict]:
        """Atomic commit for a module QCM bank or the final exam bank: every
        question is created in one DB transaction — if any one fails, the
        whole batch is rolled back (13's "atomic commit" requirement), so a
        partially-imported bank never persists."""
        result = self.validate(scope, raw_json)
        if not result.valid:
            raise ValidationAppError("Cannot commit invalid JSON — validate it first")

        repo = QuestionRepository(self.db)
        if scope == "module-qcm":
            if module_id is None:
                raise ValidationAppError("moduleId is required for scope=module-qcm")
            existing = repo.list_for_module(module_id)
        else:
            existing = repo.list_for_final_exam(course_id)

        if existing and not replace:
            raise ValidationAppError(
                f"This bank already has {len(existing)} question(s) — pass "
                f"replace:true to overwrite"
            )

        try:
            if existing and replace:
                for question in existing:
                    self.db.delete(question)
                self.db.commit()

            created: list[dict] = []
            for item in result.parsed:
                options = [{"id": o.get("id"), "text": o["text"]} for o in item["options"]]
                if scope == "module-qcm":
                    question = repo.create_module_question(
                        module_id,
                        item["text"],
                        options,
                        item["correctOptionIds"],
                        item.get("explanation"),
                        item.get("difficulty"),
                    )
                else:
                    question = repo.create_final_exam_question(
                        course_id,
                        item["text"],
                        options,
                        item["correctOptionIds"],
                        item.get("explanation"),
                        item.get("difficulty"),
                    )
                created.append({"id": str(question.id), "text": question.text})
        except Exception:
            self.db.rollback()
            raise
        return created
