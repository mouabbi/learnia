"""
Prompt-template engine (12-ai-prompt-builder). Builds the single big
copy-pasteable string the user pastes into an external AI chat tool, for
each generation scope. The JSON schema embedded in every prompt is always
generated live from the *real* Pydantic model via `model_json_schema()` —
never hand-duplicated — so it can never silently drift from what
services/import_service.py actually validates against (12's explicitly
answered open question).

Context assembly (12 concept 5): every prompt gets a compact course
summary (title/description + module/chapter list) for coherence; a
chapter-scope prompt additionally lists its module's sibling chapters, and
a page-scope prompt lists its chapter's sibling pages — never the full
content tree, to keep prompts short.
"""

import json

from sqlalchemy.orm import Session

from learnia_backend.exceptions import NotFoundError, ValidationAppError
from learnia_backend.models.chapter import Chapter
from learnia_backend.models.course import Course
from learnia_backend.models.module import Module
from learnia_backend.models.page import Page
from learnia_backend.schemas.content import PageContent
from learnia_backend.schemas.prompt_builder import (
    ChapterMetadataJSON,
    CourseMetadataJSON,
    ModuleMetadataJSON,
)
from learnia_backend.schemas.questions import QuestionWriteRequest

STRICT_JSON_INSTRUCTIONS = """\
Respond with STRICT JSON ONLY.
- No markdown code fences (no ``` anywhere).
- No commentary, no preamble, no explanation before or after the JSON.
- The JSON must match the schema below EXACTLY: the same field names, the \
same types, no extra fields, no missing required fields.
- Field names are case-sensitive and must be written exactly as shown \
(camelCase where the schema uses camelCase).
- Output a single JSON value — nothing else."""


def _schema_block(model_or_list_item, *, as_list: bool = False) -> str:
    schema = model_or_list_item.model_json_schema()
    if as_list:
        schema = {"type": "array", "items": schema}
    return json.dumps(schema, indent=2)


def _course_summary(course: Course, modules: list[Module]) -> str:
    lines = [
        f"Course title: {course.title}",
        f"Course description/goal: {course.description or '(none yet)'}",
    ]
    if modules:
        lines.append("Existing modules (for coherence, keep tone/level consistent):")
        for m in modules:
            lines.append(f"  - Module {m.position + 1}: {m.title}")
    return "\n".join(lines)


class PromptBuilderService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def _get_course(self, course_id: int) -> Course:
        course = self.db.get(Course, course_id)
        if course is None:
            raise NotFoundError(f"Course not found: {course_id}")
        return course

    def _modules(self, course_id: int) -> list[Module]:
        return (
            self.db.query(Module)
            .filter(Module.course_id == course_id)
            .order_by(Module.position)
            .all()
        )

    def _chapters(self, module_id: int) -> list[Chapter]:
        return (
            self.db.query(Chapter)
            .filter(Chapter.module_id == module_id)
            .order_by(Chapter.position)
            .all()
        )

    def _pages(self, chapter_id: int) -> list[Page]:
        return (
            self.db.query(Page)
            .filter(Page.chapter_id == chapter_id)
            .order_by(Page.position)
            .all()
        )

    # -- per-scope builders --------------------------------------------

    def build_course_prompt(self, course_id: int) -> str:
        course = self._get_course(course_id)
        modules = self._modules(course_id)
        context = _course_summary(course, modules)
        schema = _schema_block(CourseMetadataJSON)

        if modules:
            # Structure already exists — this is just a metadata refine, not
            # a redesign (that's what per-module "Generate module/chapter/
            # page with AI" is for once a course is underway).
            task = (
                "Task: refine this course's own metadata (its title and a short "
                "description of what it teaches and who it's for). Leave "
                "\"modules\" as an empty array — this course already has a "
                "structure, don't propose a new one."
            )
        else:
            task = (
                "Task: refine this course's own metadata (title + description), "
                "AND design its FULL structure from scratch, from A to Z:\n"
                "- 4-8 modules, each covering one coherent theme/skill area of "
                "the subject, ordered from foundational to advanced.\n"
                "- Each module broken into 2-5 chapters.\n"
                "- Each chapter broken into 2-6 pages (page = one focused "
                "lesson/topic, not a whole chapter's worth of content).\n"
                "- Leave every page's \"blocks\" as an empty array for now — "
                "page content is generated separately, per page, once the "
                "structure is committed.\n\n"
                "Depth bar: this is for someone preparing for real technical "
                "interviews and real-world use, not a shallow overview. "
                "Structure the progression so it builds from fundamentals to "
                "advanced/expert-level material an experienced practitioner "
                "would expect a strong candidate to know."
            )

        return (
            f"You are helping author a course on a learning platform.\n\n"
            f"{context}\n\n"
            f"{task}\n\n"
            f"{STRICT_JSON_INSTRUCTIONS}\n\nJSON schema to satisfy:\n{schema}"
        )

    def build_module_prompt(self, course_id: int) -> str:
        course = self._get_course(course_id)
        modules = self._modules(course_id)
        context = _course_summary(course, modules)
        schema = _schema_block(ModuleMetadataJSON)
        return (
            f"You are helping author a course on a learning platform.\n\n"
            f"{context}\n\n"
            f"Task: propose the next module for this course (a coherent next step "
            f"given the existing modules above).\n\n"
            f"{STRICT_JSON_INSTRUCTIONS}\n\nJSON schema to satisfy:\n{schema}"
        )

    def build_chapter_prompt(self, course_id: int, module_id: int) -> str:
        course = self._get_course(course_id)
        modules = self._modules(course_id)
        module = next((m for m in modules if m.id == module_id), None)
        if module is None:
            raise NotFoundError(f"Module not found in course {course_id}: {module_id}")
        siblings = self._chapters(module_id)
        context = _course_summary(course, modules)
        sibling_lines = "\n".join(
            f"  - Chapter {c.position + 1}: {c.title}" for c in siblings
        ) or "  (no chapters yet)"
        schema = _schema_block(ChapterMetadataJSON)
        return (
            f"You are helping author a course on a learning platform.\n\n"
            f"{context}\n\n"
            f"Target module: \"{module.title}\"\n"
            f"Existing chapters in this module:\n{sibling_lines}\n\n"
            f"Task: propose the next chapter for this module (coherent with the "
            f"chapters already listed).\n\n"
            f"{STRICT_JSON_INSTRUCTIONS}\n\nJSON schema to satisfy:\n{schema}"
        )

    def build_page_prompt(self, course_id: int, chapter_id: int) -> str:
        course = self._get_course(course_id)
        modules = self._modules(course_id)
        chapter = self.db.get(Chapter, chapter_id)
        if chapter is None or chapter.course_id != course_id:
            raise NotFoundError(f"Chapter not found in course {course_id}: {chapter_id}")
        siblings = self._pages(chapter_id)
        context = _course_summary(course, modules)
        sibling_lines = "\n".join(
            f"  - Page {p.position + 1}: {p.title}" for p in siblings
        ) or "  (no pages yet)"
        schema = _schema_block(PageContent)
        return (
            f"You are helping author a page of course content on a learning "
            f"platform. Page content is a list of typed \"blocks\" (heading, "
            f"paragraph, code, terminal, image, video, youtube, link, quote, "
            f"callout, list, table).\n\n"
            f"{context}\n\n"
            f"Target chapter: \"{chapter.title}\"\n"
            f"Existing pages in this chapter:\n{sibling_lines}\n\n"
            f"Task: write the full block content for the next page in this "
            f"chapter — thorough, well-structured, using a good mix of block "
            f"types where they fit (headings to break up sections, code blocks "
            f"for real code, callouts for tips/warnings, etc).\n\n"
            f"{STRICT_JSON_INSTRUCTIONS}\n\nJSON schema to satisfy:\n{schema}"
        )

    def build_module_qcm_prompt(self, course_id: int, module_id: int) -> str:
        course = self._get_course(course_id)
        modules = self._modules(course_id)
        module = next((m for m in modules if m.id == module_id), None)
        if module is None:
            raise NotFoundError(f"Module not found in course {course_id}: {module_id}")
        context = _course_summary(course, modules)
        schema = _schema_block(QuestionWriteRequest, as_list=True)
        return (
            f"You are a technical interviewer writing an assessment quiz for one "
            f"module of a course, styled like a real technical-interview "
            f"screening round — not a trivia quiz.\n\n"
            f"{context}\n\n"
            f"Target module: \"{module.title}\"\n\n"
            f"Task: write AT LEAST 50 multiple-choice questions covering this "
            f"module's material.\n"
            f"- Mix of difficulty: roughly a third fundamentals (do they know "
            f"the basics cold), a third applied/scenario-based (would they get "
            f"this right under real conditions), a third advanced/expert-level "
            f"(the kind of question that separates someone who memorized "
            f"definitions from someone who actually understands the concept).\n"
            f"- Test understanding and reasoning, not memorization: prefer "
            f"\"what would happen if...\" / \"why does X break when...\" / "
            f"\"which approach is correct and why\" over \"what is the "
            f"definition of X\".\n"
            f"- Each question needs 3-5 plausible options (wrong options should "
            f"be genuinely tempting mistakes, not obviously silly), one or more "
            f"correct option ids (correctOptionIds), a short explanation of why "
            f"the correct answer is correct, and a difficulty "
            f"(\"easy\"|\"medium\"|\"hard\"). Option ids can be anything unique "
            f"per question (e.g. \"a\",\"b\",\"c\") — they only need to match "
            f"correctOptionIds within the same question.\n\n"
            f"{STRICT_JSON_INSTRUCTIONS}\n\nOutput a JSON array of questions matching "
            f"this schema:\n{schema}"
        )

    def build_final_exam_prompt(self, course_id: int) -> str:
        course = self._get_course(course_id)
        modules = self._modules(course_id)
        context = _course_summary(course, modules)
        schema = _schema_block(QuestionWriteRequest, as_list=True)
        return (
            f"You are designing the final certification exam for an entire "
            f"course on a learning platform — the exam someone takes to prove "
            f"they're ready for a real technical interview or real-world work "
            f"in this subject.\n\n"
            f"{context}\n\n"
            f"Task: write a serious, comprehensive final exam of AT LEAST 100 "
            f"multiple-choice questions, covering every module above (roughly "
            f"proportional to how much of the course each module represents — "
            f"don't skip any module entirely).\n"
            f"- Same difficulty mix and \"test understanding, not memorization\" "
            f"bar as the per-module quizzes: fundamentals, applied/scenario-based, "
            f"and advanced/expert-level questions, styled like a real "
            f"technical-interview screening exam.\n"
            f"- Include a handful of cross-module questions that connect "
            f"concepts from different modules — this is the one place that "
            f"should test whether the learner can combine what they learned, "
            f"not just recall each module in isolation.\n"
            f"- Each question needs 3-5 plausible options, one or more correct "
            f"option ids (correctOptionIds), a short explanation, and a "
            f"difficulty (\"easy\"|\"medium\"|\"hard\").\n\n"
            f"{STRICT_JSON_INSTRUCTIONS}\n\nOutput a JSON array of questions "
            f"matching this schema:\n{schema}"
        )

    # -- schema-only (for the optional /schema endpoint) -----------------

    def schema_for(self, scope: str) -> dict:
        if scope == "course":
            return CourseMetadataJSON.model_json_schema()
        if scope == "module":
            return ModuleMetadataJSON.model_json_schema()
        if scope == "chapter":
            return ChapterMetadataJSON.model_json_schema()
        if scope == "page":
            return PageContent.model_json_schema()
        if scope in ("module-qcm", "final-exam"):
            return {"type": "array", "items": QuestionWriteRequest.model_json_schema()}
        raise ValidationAppError(f"Unknown scope: {scope!r}")

    def build(self, scope: str, course_id: int, *, module_id: int | None, chapter_id: int | None) -> str:
        if scope == "course":
            return self.build_course_prompt(course_id)
        if scope == "module":
            return self.build_module_prompt(course_id)
        if scope == "chapter":
            if module_id is None:
                raise ValidationAppError("moduleId is required for scope=chapter")
            return self.build_chapter_prompt(course_id, module_id)
        if scope == "page":
            if chapter_id is None:
                raise ValidationAppError("chapterId is required for scope=page")
            return self.build_page_prompt(course_id, chapter_id)
        if scope == "module-qcm":
            if module_id is None:
                raise ValidationAppError("moduleId is required for scope=module-qcm")
            return self.build_module_qcm_prompt(course_id, module_id)
        if scope == "final-exam":
            return self.build_final_exam_prompt(course_id)
        raise ValidationAppError(f"Unknown scope: {scope!r}")
