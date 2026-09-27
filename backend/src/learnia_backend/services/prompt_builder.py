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
from learnia_backend.services.batch_zip import (
    CONTENT_FILE,
    FINAL_EXAM_FILE,
    QUIZ_FILE,
    module_folder_name,
)
from learnia_backend.services.content_targets import content_targets

# What kind of platform this is — prepended to every prompt so the AI never
# writes a from-scratch beginner course. Learnia is for REVISION: the learner
# already studied the subject once and comes back to refresh it fast and get
# interview-ready.
PLATFORM_CONTEXT = (
    "About this platform: it is a REVISION and interview-prep platform, not "
    "a first-time course. Learners have already studied this subject once; "
    "they come here to refresh it quickly, lock in the key points, and be "
    "ready to answer interview questions on it. Never write beginner "
    "hand-holding or long introductions — assume they've seen it before and "
    "need the precise, condensed version.\n\n"
    "Language: the learners are junior developers and many are NOT native "
    "English speakers, so write in simple, plain English (about B1 level): "
    "short sentences, common everyday words, one idea per sentence, active "
    "voice. No idioms, slang, jokes or fancy vocabulary (say \"use\" not "
    "\"leverage\", \"start\" not \"spin up\" unless it's the real technical "
    "term). Keep real technical terms (namespace, cgroup, layer...), but "
    "the first time a page uses one, explain it in a few simple words. This "
    "applies to everything you write: page content, quiz questions, options "
    "and explanations. Simple words, still precise — never less correct."
)

# Shared "how to write" bar, reused by every content-generation prompt
# (structure/module-content/page) so the tone stays consistent: a precise,
# summarised revision sheet — high-signal, never padded, but never so terse
# it drops the substance an interviewer would probe.
CONTENT_DEPTH_BAR = (
    "Writing style — a precise revision sheet, not a textbook chapter:\n"
    "- Open each page with the core idea in 1-2 sentences (the definition "
    "or rule, stated exactly), then the key points.\n"
    "- Summarise: no history, no \"in this lesson we will...\", no restating "
    "the page title, no motivational filler. Every sentence must carry "
    "information a candidate would actually use.\n"
    "- Prefer compact formats: short paragraphs, bullet lists, a table for "
    "any comparison (X vs Y), and a minimal code/terminal snippet that "
    "shows exactly the one thing that matters — not a full program.\n"
    "- Cover what interviewers probe: how it works under the hood, "
    "trade-offs and when to use which, common pitfalls/gotchas. Put the "
    "most-asked interview question(s) for the topic in an \"important\" "
    "callout with a crisp model answer.\n"
    "- End every page with a \"Key takeaways\" list of 3-5 bullets.\n"
    "- Length: roughly 150-400 words per page. Go longer only when the "
    "topic genuinely can't be stated correctly in less; never pad."
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

# Shared rules for every prompt that designs structure (module / chapter),
# matching the revision framing of the full-course structure prompt.
STRUCTURE_RULES = (
    "Structure rules:\n"
    "- Structure only: every page's \"blocks\" must be an empty array — "
    "content is generated separately afterwards.\n"
    "- As many chapters/pages as the topic genuinely needs, no padding to "
    "a round number. A page = one precise revision topic a candidate could "
    "be asked about, not a whole chapter's worth of content.\n"
    "- Since this is a revision course, prefer fewer, denser pages over "
    "many thin ones, skip pure setup/installation walkthroughs unless "
    "they're interview-relevant, and order from core fundamentals to the "
    "advanced material an interviewer expects.\n"
    "- Titles name the concept precisely (e.g. \"Copy-on-write layers\", "
    "not \"Learning about layers\")."
)

# Question shape rules, shared by every quiz/exam prompt. SINGLE answer on
# purpose: the learner quiz/exam UI is single-select and grades against one
# correctOptionId (see repositories/course_repository.py), so a question with
# two correct options would be unanswerable — ImportService also rejects it.
QUESTION_FORMAT = (
    "Question format — SINGLE-ANSWER multiple choice (the learner picks "
    "exactly one option):\n"
    "- 3-5 options, each with a short unique \"id\" (\"a\", \"b\", \"c\", ...).\n"
    "- EXACTLY ONE option is correct: \"correctOptionIds\" must contain "
    "exactly one id, matching one of that question's option ids. Never write "
    "\"select all that apply\" or questions with several correct answers — "
    "if two options would both be right, reword so only one is.\n"
    "- Wrong options must be genuinely tempting mistakes, not obviously "
    "silly, and never \"all/none of the above\".\n"
    "- A short \"explanation\" of why the correct answer is right (and why "
    "the most tempting wrong one isn't), and a \"difficulty\": \"easy\", "
    "\"medium\" or \"hard\"."
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


def _strip_schema_noise(node: object, *, keys_are_names: bool = False) -> object:
    """Drops Pydantic's auto "title"s and the model docstrings it copies into
    "description" — both are developer-facing (e.g. "the repository assigns
    opt1/opt2...") and only cost the AI tokens/attention. Keys directly under
    "properties"/"$defs" are field/model NAMES, never stripped (a field can
    legitimately be called "title" or "description")."""
    if isinstance(node, list):
        return [_strip_schema_noise(item) for item in node]
    if not isinstance(node, dict):
        return node
    out = {}
    for key, value in node.items():
        if keys_are_names:
            out[key] = _strip_schema_noise(value)
        elif key in ("title", "description"):
            continue
        else:
            out[key] = _strip_schema_noise(value, keys_are_names=key in ("properties", "$defs"))
    return out


def _schema_block(model_or_list_item, *, as_list: bool = False) -> str:
    schema = _strip_schema_noise(model_or_list_item.model_json_schema())
    if as_list:
        schema = {"type": "array", "items": schema}
    return json.dumps(schema, indent=1, ensure_ascii=False)


def _course_summary(course: Course, modules: list[Module]) -> str:
    lines = [
        PLATFORM_CONTEXT,
        "",
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
                "could be 1, could be 10 (page = one precise revision topic "
                "a candidate could be asked about, not a whole chapter's "
                "worth of content). Let the actual subject matter decide "
                "every one of these numbers, not a target range.\n"
                "- Leave every page's \"blocks\" as an empty array for now — "
                "page content is generated separately, per module, once the "
                "structure is committed.\n\n"
                "Since this is a revision course, prefer fewer, denser pages "
                "over many thin ones, skip pure setup/installation "
                "walkthroughs unless they're interview-relevant, and order "
                "modules from core fundamentals to the advanced/expert "
                "material an interviewer expects a strong candidate to know. "
                "Page titles should name the concept precisely (e.g. \"Copy-"
                "on-write layers\" rather than \"Learning about layers\")."
            )

        return (
            f"You are helping author a course on a learning platform.\n\n"
            f"{context}\n\n"
            f"{task}\n\n"
            f"{STRICT_JSON_INSTRUCTIONS}\n\nJSON schema to satisfy:\n{schema}"
        )

    def build_module_prompt(self, course_id: int, module_id: int | None = None) -> str:
        """Module STRUCTURE (chapters + page titles, no content). Two modes:
        no module_id -> design a brand-new next module; module_id -> the
        module already exists (e.g. you created it with just a title), so
        design only the chapters/pages to ADD to it. Content is generated
        afterwards (module content / Generate All), which then fills only
        the new, empty pages."""
        course = self._get_course(course_id)
        modules = self._modules(course_id)
        context = _course_summary(course, modules)
        schema = _schema_block(ModuleMetadataJSON)

        if module_id is None:
            task = (
                "Task: design the NEXT module for this course — a coherent next "
                "step after the existing modules above, not overlapping any of "
                "them — with its full chapter/page structure."
            )
        else:
            module = next((m for m in modules if m.id == module_id), None)
            if module is None:
                raise NotFoundError(f"Module not found in course {course_id}: {module_id}")
            task = (
                f"Target module (already exists): \"{module.title}\"\n"
                f"Its current chapters/pages:\n{self._module_skeleton(module_id)}\n\n"
                f"Task: design the chapters and pages to ADD to this module so it "
                f"fully covers its topic. Return ONLY the new chapters — never "
                f"repeat or rename a chapter/page already listed above (they are "
                f"kept as they are; yours are appended after them). If the module "
                f"is empty, design its full structure. Set \"title\" to exactly "
                f"\"{module.title}\" (the module keeps its current title)."
            )

        return (
            f"You are helping author a course on a learning platform.\n\n"
            f"{context}\n\n"
            f"{task}\n\n"
            f"{STRUCTURE_RULES}\n\n"
            f"{STRICT_JSON_INSTRUCTIONS}\n\nJSON schema to satisfy:\n{schema}"
        )

    def build_chapter_prompt(self, course_id: int, module_id: int) -> str:
        course = self._get_course(course_id)
        modules = self._modules(course_id)
        module = next((m for m in modules if m.id == module_id), None)
        if module is None:
            raise NotFoundError(f"Module not found in course {course_id}: {module_id}")
        context = _course_summary(course, modules)
        schema = _schema_block(ChapterMetadataJSON)
        return (
            f"You are helping author a course on a learning platform.\n\n"
            f"{context}\n\n"
            f"Target module: \"{module.title}\"\n"
            f"Its current chapters/pages:\n{self._module_skeleton(module_id)}\n\n"
            f"Task: design ONE new chapter to append to this module — the most "
            f"valuable topic it doesn't cover yet (never repeat a chapter/page "
            f"listed above) — with its page titles.\n\n"
            f"{STRUCTURE_RULES}\n\n"
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
            f"chapter, following the revision-sheet style above — block "
            f"types only where they genuinely fit (headings to break up "
            f"sections, code blocks for real code, a table for comparisons, "
            f"callouts for gotchas/interview questions), never added just "
            f"to check a box.\n\n"
            f"{STRICT_JSON_INSTRUCTIONS}\n\nJSON schema to satisfy:\n{schema}"
        )

    def build_module_content_prompt(self, course_id: int, module_id: int) -> str:
        course = self._get_course(course_id)
        modules = self._modules(course_id)
        module = next((m for m in modules if m.id == module_id), None)
        if module is None:
            raise NotFoundError(f"Module not found in course {course_id}: {module_id}")
        context = _course_summary(course, modules)
        skeleton, page_count, only_empty = self._content_skeleton(module_id)
        schema = _schema_block(ModuleContentJSON)
        which = (
            "ONLY the pages marked [WRITE] (the others are already written — "
            "they're listed just for context, don't repeat what they cover)"
            if only_empty
            else "every page listed"
        )
        return (
            f"You are writing the full lesson content for one module of a "
            f"course on a learning platform. Page content is a list of typed "
            f"\"blocks\" (heading, paragraph, code, terminal, image, video, "
            f"youtube, link, quote, callout, list, table).\n\n"
            f"{context}\n\n"
            f"Target module: \"{module.title}\"\n"
            f"This module's page skeleton, in order — write content for "
            f"{which}, in this exact order:\n{skeleton}\n\n"
            f"{CONTENT_DEPTH_BAR}\n\n"
            f"Media: you cannot attach real image/video files. Where a "
            f"diagram or screenshot would genuinely help, add an \"image\" "
            f"block whose \"src\" starts with \"generate:\" followed by a "
            f"description of what it should show (e.g. "
            f"\"generate: a diagram of...\") — never invent a fake real URL. "
            f"Same convention for \"video\" blocks.\n\n"
            f"IMPORTANT: respond with content for EXACTLY {page_count} page(s), "
            f"in the exact same order as the skeleton above — one entry in "
            f"\"pages\" per page to write, no more, no fewer. This scope only "
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

    def _content_skeleton(self, module_id: int) -> tuple[str, int, bool]:
        """Skeleton for content generation: (text, pages to write, partial?).
        When the module is partly written, only its empty pages are targets
        (see services/content_targets.py) and are marked [WRITE]; written
        pages stay listed as context so new pages don't repeat them."""
        targets = content_targets(self.db, module_id)
        target_ids = {p.id for p in targets.targets}
        lines = []
        for chapter in self._chapters(module_id):
            lines.append(f"  Chapter: {chapter.title}")
            for page in self._pages(chapter.id):
                if not targets.only_empty:
                    lines.append(f"    - {page.title}")
                elif page.id in target_ids:
                    lines.append(f"    - [WRITE] {page.title}")
                else:
                    lines.append(f"    - [already written, skip] {page.title}")
        text = "\n".join(lines) or "  (no chapters/pages yet)"
        return text, len(targets.targets), targets.only_empty

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
            f"- The learner has just revised this module's pages: check they "
            f"locked in the key points, trade-offs and pitfalls those pages "
            f"cover — the questions an interviewer would actually ask.\n"
            f"- Test understanding and reasoning, not memorization: prefer "
            f"\"what would happen if...\" / \"why does X break when...\" / "
            f"\"which approach is correct and why\" over \"what is the "
            f"definition of X\".\n"
            f"{QUESTION_FORMAT}\n\n"
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
            f"{QUESTION_FORMAT}\n\n"
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
        one round-trip instead of one per module/exam. The AI delivers a
        single .zip (one folder per module holding content.json/quiz.json,
        final-exam.json at the root — see services/batch_zip.py, which
        parses it back). Reuses the exact same task wording as the
        single-scope prompts (minus their repeated course-context preamble)
        so output quality doesn't drift between "generate one module" and
        "generate everything"."""
        if not module_content_ids and not module_qcm_ids and not include_final_exam:
            raise ValidationAppError("Nothing selected to generate")

        course = self._get_course(course_id)
        modules = self._modules(course_id)
        modules_by_id = {m.id: m for m in modules}
        context = _course_summary(course, modules)

        for mid_str in [*module_content_ids, *module_qcm_ids]:
            if int(mid_str) not in modules_by_id:
                raise NotFoundError(f"Module not found in course {course_id}: {mid_str}")

        sections: list[str] = [
            "You are helping author content for a course on a learning "
            "platform. This is a COMBINED request covering several tasks at "
            "once — read every section below carefully, each one targets "
            "different files in the .zip you will deliver.\n\n" + context
        ]

        if module_content_ids:
            file_lines = []
            for mid_str in module_content_ids:
                module = modules_by_id[int(mid_str)]
                folder = module_folder_name(module)
                file_lines.append(f"  - {folder}/{CONTENT_FILE}  (\"{module.title}\")")
            sections.append(
                "=== SECTION: module content ===\n"
                "For EACH module listed below, write the full lesson content "
                "for the pages its skeleton asks for (page content is a "
                "list of typed \"blocks\": heading, paragraph, code, "
                "terminal, image, video, youtube, link, quote, callout, "
                "list, table).\n\n"
                f"{CONTENT_DEPTH_BAR}\n\n"
                "Media: don't put image/video files in the zip. Where a "
                "diagram or screenshot would genuinely help, add an "
                "\"image\" block whose \"src\" starts with \"generate:\" "
                "followed by a description of what it should show — never "
                "invent a fake real URL. Same convention for \"video\" "
                "blocks.\n\n"
                "IMPORTANT: for each module, write content for EXACTLY the "
                "pages to write in its skeleton (all of them, or only the "
                "ones marked [WRITE] when some are already written), in the "
                "exact same order — one entry in \"pages\" per page to write, "
                "no more, no fewer. This never adds, removes, or renames "
                "pages.\n\n"
                "Files to write for this section:\n" + "\n".join(file_lines)
            )
            for mid_str in module_content_ids:
                module = modules_by_id[int(mid_str)]
                skeleton, page_count, only_empty = self._content_skeleton(module.id)
                note = (
                    f"write ONLY the {page_count} page(s) marked [WRITE]; the "
                    f"others are already written, listed for context only"
                    if only_empty
                    else f"write all {page_count} page(s)"
                )
                sections.append(
                    f"--- {module_folder_name(module)}/{CONTENT_FILE} (\"{module.title}\") ---\n"
                    f"Page skeleton, in order ({note}):\n{skeleton}"
                )

        if module_qcm_ids:
            file_lines = []
            for mid_str in module_qcm_ids:
                module = modules_by_id[int(mid_str)]
                folder = module_folder_name(module)
                file_lines.append(f"  - {folder}/{QUIZ_FILE}  (\"{module.title}\")")
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
                "- The learner has just revised these pages: check they "
                "locked in the key points, trade-offs and pitfalls — the "
                "questions an interviewer would actually ask.\n"
                "- Test understanding and reasoning, not memorization.\n"
                f"{QUESTION_FORMAT}\n\n"
                "Files to write for this section:\n" + "\n".join(file_lines)
            )
            for mid_str in module_qcm_ids:
                module = modules_by_id[int(mid_str)]
                sections.append(
                    f"--- {module_folder_name(module)}/{QUIZ_FILE} (\"{module.title}\") ---\n"
                    f"This module's chapters/pages (the actual scope to "
                    f"test):\n{self._module_skeleton(module.id)}"
                )

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
                f"{QUESTION_FORMAT}\n\n"
                f"File to write for this section: {FINAL_EXAM_FILE} (at the "
                f"zip root, NOT inside any module folder)"
            )

        tree_lines = ["<course>.zip"]
        for m in modules:
            files = [
                name
                for name, wanted in (
                    (CONTENT_FILE, module_content_ids),
                    (QUIZ_FILE, module_qcm_ids),
                )
                if str(m.id) in wanted
            ]
            if files:
                tree_lines.append(f"  {module_folder_name(m)}/")
                tree_lines.extend(f"    {name}" for name in files)
        if include_final_exam:
            tree_lines.append(f"  {FINAL_EXAM_FILE}")

        schema_blocks = []
        if module_content_ids:
            schema_blocks.append(
                f"Every {CONTENT_FILE} must match this JSON schema:\n"
                f"{_schema_block(ModuleContentJSON)}"
            )
        question_files = [
            label
            for label, wanted in (
                (f"every {QUIZ_FILE}", module_qcm_ids),
                (FINAL_EXAM_FILE, include_final_exam),
            )
            if wanted
        ]
        if question_files:
            schema_blocks.append(
                f"{' and '.join(question_files)} must each be a JSON array of "
                f"questions matching this schema:\n"
                f"{_schema_block(QuestionWriteRequest, as_list=True)}"
            )

        sections.append(
            "=== OUTPUT FORMAT: ONE .zip file ===\n"
            "Deliver everything above as a single downloadable .zip file "
            "(build it with your code/file tools) — do NOT paste the JSON "
            "into the chat. Use EXACTLY this layout: one folder per module, "
            "named exactly as shown, and the final exam (if requested) at "
            "the zip root, not inside any folder:\n\n"
            + "\n".join(tree_lines)
            + "\n\nRules for every file in the zip:\n"
            "- Each .json file holds STRICT JSON only: no markdown code "
            "fences, no comments, no text before or after, UTF-8.\n"
            "- Match the schema EXACTLY: same field names (case-sensitive, "
            "camelCase where shown), same types, no extra fields, no "
            "missing required fields.\n"
            "- Don't rename any folder or file — the platform maps each "
            "folder to its module by name.\n"
            "- Only create the files listed above: no README, no media "
            "files, no extra folders.\n\n"
            + "\n\n".join(schema_blocks)
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

    def build(
        self, scope: str, course_id: int, *, module_id: int | None, chapter_id: int | None
    ) -> str:
        if scope == "course":
            return self.build_course_prompt(course_id)
        if scope == "module":
            return self.build_module_prompt(course_id, module_id)
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
