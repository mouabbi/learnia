"""
Ad-hoc "metadata JSON" shapes for scopes that have no dedicated content
schema (12-ai-prompt-builder). Course/module/chapter authoring is just a
title (+ description for Course, since only Course has that column — see
models/module.py / models/chapter.py, neither of which has a description
field). These exist purely so a prompt/import round-trip for those scopes
has a real Pydantic model to generate a schema from and validate against,
instead of a hand-written dict shape that could drift.
"""

from pydantic import BaseModel, ConfigDict, Field

from learnia_backend.schemas.content import ContentBlock


class ModulePageJSON(BaseModel):
    title: str
    blocks: list[ContentBlock] = []


class ModuleContentPageJSON(BaseModel):
    """One page's worth of generated content, for the "module-content"
    scope (fills in every page ALREADY in a module, in one shot) —
    deliberately just `blocks`, no `title`: this scope only ever fills
    content into pages that already exist (see
    StructureRepository.pages_in_module_order), it never creates/renames
    pages, so there's nothing else for the AI to specify per page."""

    blocks: list[ContentBlock] = []


class ModuleContentJSON(BaseModel):
    pages: list[ModuleContentPageJSON] = []


class ModuleChapterJSON(BaseModel):
    title: str
    pages: list[ModulePageJSON] = []


class ModuleMetadataJSON(BaseModel):
    title: str
    # Optional: a full "generate a new module" payload can include its
    # chapters/pages so one AI-generated module round-trips in one commit,
    # not just the title (see ImportService.commit_module).
    chapters: list[ModuleChapterJSON] = []


class ChapterMetadataJSON(BaseModel):
    title: str
    # Optional: "Add chapter with AI" on a module creates the chapter WITH
    # its page titles in one commit (see ImportService.commit_chapter).
    pages: list[ModulePageJSON] = []


class CourseMetadataJSON(BaseModel):
    title: str
    description: str = ""
    # Optional: for a brand-new course with no structure yet, the "course"
    # scope prompt (see services/prompt_builder.py's build_course_prompt)
    # asks for the FULL Module > Chapter > Page outline in the same
    # response — one commit creates every module/chapter/page row, the
    # same way ModuleMetadataJSON.chapters already lets one module-scope
    # response create a whole module's chapters/pages in one commit.
    modules: list[ModuleMetadataJSON] = []


# The scopes this whole feature (12 + 13) understands, shared by the
# prompt-builder and import-validation routers so both stay in sync.
SCOPES = ("course", "module", "chapter", "page", "module-content", "module-qcm", "final-exam")


class BatchGenerateRequest(BaseModel):
    """Body for the combined "Generate All" flow (one prompt covering several
    modules' content/quiz plus optionally the final exam, in one round-trip)
    — deliberately NOT one of SCOPES/`_check_scope`'s single-target scopes,
    since a batch selects several targets at once. Shared by the
    prompt-builder POST /prompts/batch endpoint and the two dedicated
    import/batch/validate + import/batch/commit routes (see
    routers/import_validation.py)."""

    model_config = ConfigDict(populate_by_name=True)

    module_content_ids: list[str] = Field(default_factory=list, alias="moduleContentIds")
    module_qcm_ids: list[str] = Field(default_factory=list, alias="moduleQcmIds")
    include_final_exam: bool = Field(default=False, alias="includeFinalExam")
