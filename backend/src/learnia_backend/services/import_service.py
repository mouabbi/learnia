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
    ModuleContentJSON,
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
    "module-content": ModuleContentJSON,
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

    def validate_batch(
        self,
        raw_json: str,
        *,
        module_content_ids: list[str],
        module_qcm_ids: list[str],
        include_final_exam: bool,
    ) -> ImportValidateResult:
        """Validates the combined "Generate All" response: a single JSON
        object with up to three top-level keys (moduleContent, moduleQcm,
        finalExam), each checked against the real per-part schemas so a
        validation error is traceable to exactly which section+module+item
        it's in (e.g. "moduleContent.12.pages.0.blocks")."""
        try:
            data = _parse_json(raw_json)
        except _BadJson as exc:
            return ImportValidateResult(
                valid=False,
                errors=[ImportFieldError(field="(json)", message=f"Invalid JSON: {exc.message}")],
            )

        if not isinstance(data, dict):
            return ImportValidateResult(
                valid=False,
                errors=[ImportFieldError(field="(root)", message="Expected a JSON object")],
            )

        errors: list[ImportFieldError] = []
        parsed: dict = {}

        if module_content_ids:
            module_content_raw = data.get("moduleContent")
            if not isinstance(module_content_raw, dict):
                errors.append(
                    ImportFieldError(
                        field="moduleContent",
                        message="Expected an object keyed by module id — was this section selected but missing from the pasted JSON?",
                    )
                )
            else:
                parsed_module_content: dict = {}
                for mid in module_content_ids:
                    if mid not in module_content_raw:
                        errors.append(
                            ImportFieldError(
                                field=f"moduleContent.{mid}",
                                message="Missing content for this module id",
                            )
                        )
                        continue
                    try:
                        item = ModuleContentJSON.model_validate(module_content_raw[mid])
                    except ValidationError as exc:
                        for err in exc.errors():
                            field = ".".join(str(loc) for loc in err["loc"])
                            field = f"moduleContent.{mid}.{field}" if field else f"moduleContent.{mid}"
                            errors.append(ImportFieldError(field=field, message=err["msg"]))
                        continue
                    parsed_module_content[mid] = item.model_dump(by_alias=True)
                parsed["moduleContent"] = parsed_module_content

        if module_qcm_ids:
            module_qcm_raw = data.get("moduleQcm")
            if not isinstance(module_qcm_raw, dict):
                errors.append(
                    ImportFieldError(
                        field="moduleQcm",
                        message="Expected an object keyed by module id — was this section selected but missing from the pasted JSON?",
                    )
                )
            else:
                parsed_module_qcm: dict = {}
                for mid in module_qcm_ids:
                    if mid not in module_qcm_raw:
                        errors.append(
                            ImportFieldError(
                                field=f"moduleQcm.{mid}",
                                message="Missing question list for this module id",
                            )
                        )
                        continue
                    try:
                        items = _QUESTION_LIST_ADAPTER.validate_python(module_qcm_raw[mid])
                    except ValidationError as exc:
                        for err in exc.errors():
                            field = ".".join(f"[{loc}]" if isinstance(loc, int) else str(loc) for loc in err["loc"])
                            field = f"moduleQcm.{mid}.{field}" if field else f"moduleQcm.{mid}"
                            errors.append(ImportFieldError(field=field, message=err["msg"]))
                        continue
                    parsed_module_qcm[mid] = [q.model_dump(by_alias=True) for q in items]
                parsed["moduleQcm"] = parsed_module_qcm

        if include_final_exam:
            final_exam_raw = data.get("finalExam")
            if final_exam_raw is None:
                errors.append(
                    ImportFieldError(
                        field="finalExam",
                        message="Expected an array of questions — was this section selected but missing from the pasted JSON?",
                    )
                )
            else:
                try:
                    items = _QUESTION_LIST_ADAPTER.validate_python(final_exam_raw)
                except ValidationError as exc:
                    for err in exc.errors():
                        field = ".".join(f"[{loc}]" if isinstance(loc, int) else str(loc) for loc in err["loc"])
                        field = f"finalExam.{field}" if field else "finalExam"
                        errors.append(ImportFieldError(field=field, message=err["msg"]))
                else:
                    parsed["finalExam"] = [q.model_dump(by_alias=True) for q in items]

        if errors:
            return ImportValidateResult(valid=False, errors=errors)
        return ImportValidateResult(valid=True, parsed=parsed)

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

    def commit_module_content(self, module_id: int, raw_json: str, *, replace: bool) -> dict:
        """Fills in content for EVERY page already in a module, from one AI
        response, matched back to the existing pages positionally (chapter
        order, then page order — see StructureRepository.pages_in_module_order).
        Deliberately does not create/rename/delete pages: that's what the
        chapter/page structure endpoints are for. Same replace-confirmation
        pattern as commit_page, just checked across every page in the module
        instead of just one, so generating content twice for an
        already-written module can't silently wipe it out."""
        result = self.validate("module-content", raw_json)
        if not result.valid:
            raise ValidationAppError("Cannot commit invalid JSON — validate it first")

        structure = StructureRepository(self.db)
        pages = structure.pages_in_module_order(module_id)
        parsed_pages = result.parsed.get("pages", [])

        if len(parsed_pages) != len(pages):
            raise ValidationAppError(
                f"Expected content for exactly {len(pages)} page(s) — this module's "
                f"current structure — but got {len(parsed_pages)}. Regenerate the "
                f"prompt if the structure changed since you copied it, or fix the "
                f"pasted JSON to match."
            )

        content_service = ContentService(self.db)
        already_written = [p.title for p in pages if content_service.read(p).blocks]
        if already_written and not replace:
            raise ValidationAppError(
                f"{len(already_written)} page(s) in this module already have content "
                f"({', '.join(already_written)}) — pass replace:true to overwrite"
            )

        written = []
        for page, page_data in zip(pages, parsed_pages):
            content = content_service.write(page, PageContent(blocks=page_data.get("blocks", [])))
            written.append({"id": str(page.id), "title": page.title, "blockCount": len(content.blocks)})
        return {"pages": written}

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

    def commit_batch(
        self,
        course_id: int,
        raw_json: str,
        *,
        module_content_ids: list[str],
        module_qcm_ids: list[str],
        include_final_exam: bool,
        replace: bool,
    ) -> dict:
        """Commits the combined "Generate All" response: re-validates first
        (never trusts the caller called validate_batch), then, unless
        replace=True, checks EVERY selected part upfront for a would-overwrite
        conflict and raises one combined error naming every conflicting part
        (same "...pass replace:true to overwrite" phrasing the single-scope
        commit_* methods use, since AiImportModal detects that substring to
        show its retry button). Only once that pre-check passes does it
        actually write, by delegating to the existing commit_module_content /
        commit_questions methods per part — no duplicated write logic.

        NOTE on atomicity: this is NOT one giant cross-table transaction.
        Each part's own commit_* call commits independently once the
        upfront pre-check has passed for every part. If something
        genuinely unexpected fails deep into a multi-part batch (not the
        replace-conflict case, which is already ruled out beforehand),
        parts committed earlier in this call stay committed — the upfront
        conflict pre-check is the real safety net here, not a single
        atomic transaction across unrelated tables (module content pages,
        module question banks, and the final exam bank are independent
        aggregates with their own existing atomic commit paths already).
        """
        result = self.validate_batch(
            raw_json,
            module_content_ids=module_content_ids,
            module_qcm_ids=module_qcm_ids,
            include_final_exam=include_final_exam,
        )
        if not result.valid:
            raise ValidationAppError("Cannot commit invalid JSON — validate it first")

        structure = StructureRepository(self.db)
        content_service = ContentService(self.db)
        question_repo = QuestionRepository(self.db)

        conflicts: list[str] = []

        module_titles: dict[str, str] = {}
        if module_content_ids or module_qcm_ids:
            for mid in {*module_content_ids, *module_qcm_ids}:
                module = self.db.get(Module, int(mid))
                module_titles[mid] = module.title if module else mid

        if not replace:
            for mid in module_content_ids:
                pages = structure.pages_in_module_order(int(mid))
                if any(content_service.read(p).blocks for p in pages):
                    conflicts.append(f"module content for \"{module_titles[mid]}\" (id {mid})")
            for mid in module_qcm_ids:
                if question_repo.list_for_module(int(mid)):
                    conflicts.append(f"module quiz for \"{module_titles[mid]}\" (id {mid})")
            if include_final_exam and question_repo.list_for_final_exam(course_id):
                conflicts.append("final exam")

        if conflicts:
            raise ValidationAppError(
                f"{len(conflicts)} part(s) of this batch already have content — "
                f"{'; '.join(conflicts)} — pass replace:true to overwrite"
            )

        module_content_out: dict = {}
        for mid in module_content_ids:
            part_json = json.dumps(result.parsed["moduleContent"][mid])
            module_content_out[mid] = self.commit_module_content(int(mid), part_json, replace=replace)

        module_qcm_out: dict = {}
        for mid in module_qcm_ids:
            part_json = json.dumps(result.parsed["moduleQcm"][mid])
            created = self.commit_questions(
                "module-qcm",
                course_id=course_id,
                module_id=int(mid),
                replace=replace,
                raw_json=part_json,
            )
            module_qcm_out[mid] = {"created": created}

        final_exam_out: dict | None = None
        if include_final_exam:
            part_json = json.dumps(result.parsed["finalExam"])
            created = self.commit_questions(
                "final-exam",
                course_id=course_id,
                module_id=None,
                replace=replace,
                raw_json=part_json,
            )
            final_exam_out = {"created": created}

        out: dict = {}
        if module_content_ids:
            out["moduleContent"] = module_content_out
        if module_qcm_ids:
            out["moduleQcm"] = module_qcm_out
        if include_final_exam:
            out["finalExam"] = final_exam_out
        return out
