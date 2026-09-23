"""
Ad-hoc "metadata JSON" shapes for scopes that have no dedicated content
schema (12-ai-prompt-builder). Course/module/chapter authoring is just a
title (+ description for Course, since only Course has that column — see
models/module.py / models/chapter.py, neither of which has a description
field). These exist purely so a prompt/import round-trip for those scopes
has a real Pydantic model to generate a schema from and validate against,
instead of a hand-written dict shape that could drift.
"""

from pydantic import BaseModel

from learnia_backend.schemas.content import ContentBlock


class ModulePageJSON(BaseModel):
    title: str
    blocks: list[ContentBlock] = []


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
SCOPES = ("course", "module", "chapter", "page", "module-qcm", "final-exam")
