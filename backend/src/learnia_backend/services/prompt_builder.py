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
    ModuleContentJSON,
    ModuleMetadataJSON,
)
from learnia_backend.schemas.questions import QuestionWriteRequest

# Shared "how to write" bar, reused by every content-generation prompt
# (structure/module-content/page) so the tone stays consistent: dense and
# interview-ready, not padded, but never so terse it loses the substance —
# a "cheat sheet that actually teaches", not a bullet-point stub.
CONTENT_DEPTH_BAR = (
    "Writing style: short AND deep — like a sharp interview-prep cheat "
    "sheet or summary, not a textbook chapter and not a shallow bullet "
    "list either. Every sentence should carry real information (the "
    "non-obvious mechanism, the gotcha, the thing an expert actually "
    "checks) — cut throat-clearing, restating the question, and generic "
    "filler, but don't cut the substance just to be brief. If a topic "
    "genuinely needs more words to be correct and useful, use them; if it "
    "can be said precisely in two sentences, don't pad it to five."
)

# Question-count guidance, reused by build_module_qcm_prompt,
# build_final_exam_prompt, and build_batch_prompt so the three copies of
# this instruction can't drift. Deliberately a range tied to how much
# material there actually is, not a fixed number — a 2-page module and a
# 12-page module shouldn't get the same quiz size.
MODULE_QCM_SIZE_GUIDANCE = (
    "Question count: scale it to how much this module actually covers — "
    "don't pad to a round number and don't force more questions than the "
    "material genuinely supports. Roughly: a small module (~1-3 pages) "
    "needs about 10-15 questions, a medium module (~4-6 pages) needs about "
    "15-30, a large/content-heavy module (~7+ pages) needs about 30-40. "
    "Hard floor of 10, hard cap of 40 either way."
)

FINAL_EXAM_SIZE_GUIDANCE = (
    "Question count: scale it to the size of the whole course, not a fixed "
    "number — a small course (2-3 modules) needs around 40 questions, a "
    "medium course (4-6 modules) needs around 50-70, a large course (7+ "
    "modules) needs around 100. Hard cap of 100. Hard floor of 40 — if this "
    "course is small enough that a final exam barely makes sense, that's a "
    "call for whoever decided to generate one in the first place, not "
    "something to solve by padding to 40 with trivial questions; write 40 "
    "genuinely good ones instead."
)

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
                "- However many modules the subject actually needs — could be "
                "2, could be 10. Each module covers one coherent theme/skill "
                "area, ordered from foundational to advanced. Don't pad the "
                "count to hit a round number, and don't force unrelated "
                "topics into one module just to have fewer of them.\n"
                "- Each module broken into however many chapters IT needs — a "
                "narrow module might only need 1 chapter, a broad one might "
                "need 5+. Same for chapters: however many pages it needs, "
                "could be 1, could be 10 (page = one focused lesson/topic, "
                "not a whole chapter's worth of content). Let the actual "
                "subject matter decide every one of these numbers, not a "
                "target range.\n"
                "- Leave every page's \"blocks\" as an empty array for now — "
                "page content is generated separately, per module, once the "
                "structure is committed.\n\n"
                f"{CONTENT_DEPTH_BAR}\n\n"
                "This course is for someone preparing for real technical "
                "interviews and real-world use, not a shallow overview — "
                "structure the progression so it builds from fundamentals to "
                "the advanced/expert-level material an experienced "
                "practitioner would expect a strong candidate to know, "
                "covered with the short-and-deep style above rather than "
                "padded out."
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
            f"{CONTENT_DEPTH_BAR}\n\n"
            f"Task: write the full block content for the next page in this "
            f"chapter — well-structured, using a good mix of block types "
            f"where they genuinely fit (headings to break up sections, code "
            f"blocks for real code, callouts for tips/warnings, etc) — not "
            f"blocks added just to check a box.\n\n"
            f"{STRICT_JSON_INSTRUCTIONS}\n\nJSON schema to satisfy:\n{schema}"
        )

    def build_module_content_prompt(self, course_id: int, module_id: int) -> str:
        course = self._get_course(course_id)
        modules = self._modules(course_id)
        module = next((m for m in modules if m.id == module_id), None)
        if module is None:
            raise NotFoundError(f"Module not found in course {course_id}: {module_id}")
        context = _course_summary(course, modules)
        page_count = sum(len(self._pages(c.id)) for c in self._chapters(module_id))
        skeleton = self._module_skeleton(module_id)
        schema = _schema_block(ModuleContentJSON)
        return (
            f"You are writing the full lesson content for one module of a "
            f"course on a learning platform. Page content is a list of typed "
            f"\"blocks\" (heading, paragraph, code, terminal, image, video, "
            f"youtube, link, quote, callout, list, table).\n\n"
            f"{context}\n\n"
            f"Target module: \"{module.title}\"\n"
            f"This module's existing page skeleton, in order (write content "
            f"for every page listed, in this exact order):\n{skeleton}\n\n"
            f"{CONTENT_DEPTH_BAR}\n\n"
            f"Write like a senior practitioner prepping a strong engineer for "
            f"real interviews and real work — the non-obvious/advanced parts "
            f"an expert actually cares about, with concrete examples (real "
            f"code where relevant), not padded restatements of the page "
            f"title.\n\n"
            f"Media: you cannot attach real image/video files. Where a "
            f"diagram or screenshot would genuinely help, add an \"image\" "
            f"block whose \"src\" starts with \"generate:\" followed by a "
            f"description of what it should show (e.g. "
            f"\"generate: a diagram of...\") — never invent a fake real URL. "
            f"Same convention for \"video\" blocks.\n\n"
            f"IMPORTANT: respond with content for EXACTLY {page_count} page(s), "
            f"in the exact same order as the skeleton above — one entry in "
            f"\"pages\" per page listed, no more, no fewer. This scope only "
            f"fills in content for pages that already exist; it never adds, "
            f"removes, or renames pages (use the Structure tab / "
            f"\"Generate chapter with AI\" for that).\n\n"
            f"{STRICT_JSON_INSTRUCTIONS}\n\nJSON schema to satisfy:\n{schema}"
        )

    def _module_skeleton(self, module_id: int) -> str:
        """Chapter/page titles for one module, in reading order — shared by
        every prompt that needs to ground itself in a module's actual scope
        without pulling in full page content (module-content, module-qcm)."""
        lines = []
        for chapter in self._chapters(module_id):
            lines.append(f"  Chapter: {chapter.title}")
            for page in self._pages(chapter.id):
                lines.append(f"    - {page.title}")
        return "\n".join(lines) or "  (no chapters/pages yet)"

    def build_module_qcm_prompt(self, course_id: int, module_id: int) -> str:
        course = self._get_course(course_id)
        modules = self._modules(course_id)
        module = next((m for m in modules if m.id == module_id), None)
        if module is None:
            raise NotFoundError(f"Module not found in course {course_id}: {module_id}")
        context = _course_summary(course, modules)
        skeleton = self._module_skeleton(module_id)
        schema = _schema_block(QuestionWriteRequest, as_list=True)
        return (
            f"You are a technical interviewer writing an assessment quiz for one "
            f"module of a course, styled like a real technical-interview "
            f"screening round — not a trivia quiz.\n\n"
            f"{context}\n\n"
            f"Target module: \"{module.title}\"\n"
            f"This module's chapters and pages (the actual scope to test — "
            f"don't test material outside this list):\n{skeleton}\n\n"
            f"Task: write multiple-choice questions covering this module's "
            f"material.\n"
            f"- {MODULE_QCM_SIZE_GUIDANCE}\n"
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
            f"Task: write a serious, comprehensive final exam covering every "
            f"module above (roughly proportional to how much of the course "
            f"each module represents — don't skip any module entirely).\n"
            f"- {FINAL_EXAM_SIZE_GUIDANCE}\n"
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

    def build_batch_prompt(
        self,
        course_id: int,
        *,
        module_content_ids: list[str],
        module_qcm_ids: list[str],
        include_final_exam: bool,
    ) -> str:
        """One combined prompt covering several modules' content/quiz plus
        (optionally) the final exam, so the "Generate All" flow needs only
        one copy-paste round-trip instead of one per module/exam. Reuses the
        exact same task wording as the single-scope prompts (minus their
        repeated course-context preamble) so output quality doesn't drift
        between "generate one module" and "generate everything"."""
        if not module_content_ids and not module_qcm_ids and not include_final_exam:
            raise ValidationAppError("Nothing selected to generate")

        course = self._get_course(course_id)
        modules = self._modules(course_id)
        modules_by_id = {m.id: m for m in modules}
        context = _course_summary(course, modules)

        sections: list[str] = [
            "You are helping author content for a course on a learning "
            "platform. This is a COMBINED request covering several tasks at "
            "once — read every section below carefully, they each target a "
            "different part of the response JSON.\n\n" + context
        ]

        schema_properties: dict = {}
        schema_required: list[str] = []

        if module_content_ids:
            id_lines = []
            for mid_str in module_content_ids:
                mid = int(mid_str)
                module = modules_by_id.get(mid)
                if module is None:
                    raise NotFoundError(f"Module not found in course {course_id}: {mid}")
                id_lines.append(f"  - Module id {mid_str}: \"{module.title}\"")
            sections.append(
                "=== SECTION: module content ===\n"
                "For EACH module listed below, write the full lesson content "
                "for every page already in that module (page content is a "
                "list of typed \"blocks\": heading, paragraph, code, "
                "terminal, image, video, youtube, link, quote, callout, "
                "list, table).\n\n"
                f"{CONTENT_DEPTH_BAR}\n\n"
                "Write like a senior practitioner prepping a strong engineer "
                "for real interviews and real work — the non-obvious/"
                "advanced parts an expert actually cares about, with "
                "concrete examples (real code where relevant), not padded "
                "restatements of the page title.\n\n"
                "Media: you cannot attach real image/video files. Where a "
                "diagram or screenshot would genuinely help, add an "
                "\"image\" block whose \"src\" starts with \"generate:\" "
                "followed by a description of what it should show — never "
                "invent a fake real URL. Same convention for \"video\" "
                "blocks.\n\n"
                "IMPORTANT: for each module, respond with content for "
                "EXACTLY the pages listed in its skeleton, in the exact same "
                "order — one entry per page, no more, no fewer. This never "
                "adds, removes, or renames pages.\n\n"
                "Modules for this section (id -> title):\n" + "\n".join(id_lines)
            )
            for mid_str in module_content_ids:
                mid = int(mid_str)
                skeleton = self._module_skeleton(mid)
                module = modules_by_id[mid]
                sections.append(
                    f"--- module content target: id {mid_str} (\"{module.title}\") ---\n"
                    f"Page skeleton, in order:\n{skeleton}"
                )
            schema_properties["moduleContent"] = {
                "type": "object",
                "description": (
                    "Keyed by the exact module id strings listed above for "
                    "the module-content section."
                ),
                "properties": {
                    mid_str: ModuleContentJSON.model_json_schema()
                    for mid_str in module_content_ids
                },
                "required": list(module_content_ids),
            }
            schema_required.append("moduleContent")

        if module_qcm_ids:
            id_lines = []
            for mid_str in module_qcm_ids:
                mid = int(mid_str)
                module = modules_by_id.get(mid)
                if module is None:
                    raise NotFoundError(f"Module not found in course {course_id}: {mid}")
                id_lines.append(f"  - Module id {mid_str}: \"{module.title}\"")
            sections.append(
                "=== SECTION: module quiz (QCM) ===\n"
                "You are a technical interviewer writing an assessment quiz "
                "for EACH module listed below, styled like a real "
                "technical-interview screening round — not a trivia quiz.\n\n"
                "For each module, write multiple-choice questions covering "
                "that module's material only (don't test material outside "
                "its own listed scope).\n"
                f"- {MODULE_QCM_SIZE_GUIDANCE}\n"
                "- Mix of difficulty: roughly a third fundamentals, a third "
                "applied/scenario-based, a third advanced/expert-level.\n"
                "- Test understanding and reasoning, not memorization.\n"
                "- Each question needs 3-5 plausible options (wrong options "
                "genuinely tempting, not obviously silly), one or more "
                "correct option ids (correctOptionIds), a short explanation, "
                "and a difficulty (\"easy\"|\"medium\"|\"hard\"). Option ids "
                "only need to be unique within their own question.\n\n"
                "Modules for this section (id -> title):\n" + "\n".join(id_lines)
            )
            for mid_str in module_qcm_ids:
                mid = int(mid_str)
                skeleton = self._module_skeleton(mid)
                module = modules_by_id[mid]
                sections.append(
                    f"--- module quiz target: id {mid_str} (\"{module.title}\") ---\n"
                    f"This module's chapters/pages (the actual scope to "
                    f"test):\n{skeleton}"
                )
            question_schema = QuestionWriteRequest.model_json_schema()
            schema_properties["moduleQcm"] = {
                "type": "object",
                "description": (
                    "Keyed by the exact module id strings listed above for "
                    "the module quiz section. Each value is an array of "
                    "questions."
                ),
                "properties": {
                    mid_str: {"type": "array", "items": question_schema}
                    for mid_str in module_qcm_ids
                },
                "required": list(module_qcm_ids),
            }
            schema_required.append("moduleQcm")

        if include_final_exam:
            sections.append(
                "=== SECTION: final exam ===\n"
                "You are also designing the final certification exam for "
                "the ENTIRE course above — the exam someone takes to prove "
                "they're ready for a real technical interview or real-world "
                "work in this subject.\n\n"
                "Write a serious, comprehensive final exam covering every "
                "module of the course above (roughly proportional to how "
                "much of the course each module represents — don't skip any "
                "module entirely).\n"
                f"- {FINAL_EXAM_SIZE_GUIDANCE}\n"
                "- Same difficulty mix and \"test understanding, not "
                "memorization\" bar as the module quizzes.\n"
                "- Include a handful of cross-module questions that connect "
                "concepts from different modules.\n"
                "- Each question needs 3-5 plausible options, one or more "
                "correct option ids (correctOptionIds), a short explanation, "
                "and a difficulty (\"easy\"|\"medium\"|\"hard\")."
            )
            schema_properties["finalExam"] = {
                "type": "array",
                "items": QuestionWriteRequest.model_json_schema(),
            }
            schema_required.append("finalExam")

        wrapper_schema = {
            "type": "object",
            "properties": schema_properties,
            "required": schema_required,
        }
        schema = json.dumps(wrapper_schema, indent=2)

        sections.append(
            f"{STRICT_JSON_INSTRUCTIONS}\n\n"
            "Respond with a SINGLE JSON object combining every section "
            "above, shaped exactly like this (only the keys for the "
            "sections actually requested are present — moduleContent/"
            "moduleQcm are objects KEYED BY THE EXACT MODULE ID STRINGS "
            "listed in each section above, not by title):\n" + schema
        )

        return "\n\n".join(sections)

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
        if scope == "module-content":
            return ModuleContentJSON.model_json_schema()
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
        if scope == "module-content":
            if module_id is None:
                raise ValidationAppError("moduleId is required for scope=module-content")
            return self.build_module_content_prompt(course_id, module_id)
        if scope == "module-qcm":
            if module_id is None:
                raise ValidationAppError("moduleId is required for scope=module-qcm")
            return self.build_module_qcm_prompt(course_id, module_id)
        if scope == "final-exam":
            return self.build_final_exam_prompt(course_id)
        raise ValidationAppError(f"Unknown scope: {scope!r}")
