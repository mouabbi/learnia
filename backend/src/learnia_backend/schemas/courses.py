"""
Pydantic schemas for the courses domain (see routers/courses.py).

Request bodies come from the frontend as camelCase JSON (pageId, moduleId,
...); response models are serialized back out as camelCase too, so they
drop straight into the existing frontend shapes in
features/courses/progressStore.js / coursesApi.js without any renaming on
that side. `populate_by_name=True` lets the Python side still use snake_case
field names.
"""

from pydantic import BaseModel, ConfigDict, Field


class MarkPageCompleteRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    page_id: str = Field(alias="pageId")


class SetLastPageRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    page_id: str = Field(alias="pageId")


class ModuleQuizAttemptRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    module_id: str = Field(alias="moduleId")
    score: int
    total: int


class FinalExamAttemptRequest(BaseModel):
    score: int
    total: int


class CourseSummary(BaseModel):
    """What GET /courses returns per course — no module content."""

    model_config = ConfigDict(populate_by_name=True)

    id: int
    slug: str
    title: str
    description: str
    icon: str | None = None
    image: str | None = None
    color: str | None = None
    difficulty: str | None = None
    estimated_minutes: int = Field(alias="estimatedMinutes")


class CourseDetail(CourseSummary):
    """What GET /courses/{slug} returns — includes the full content tree."""

    modules: list = Field(default_factory=list)
    final_exam: dict | None = Field(default=None, alias="finalExam")


class ProgressResponse(BaseModel):
    """A learner's progress through one course — mirrors progressStore.js."""

    model_config = ConfigDict(populate_by_name=True)

    completed_page_ids: list[str] = Field(default_factory=list, alias="completedPageIds")
    last_page_id: str | None = Field(default=None, alias="lastPageId")
    module_quizzes: dict = Field(default_factory=dict, alias="moduleQuizzes")
    final_exam: dict | None = Field(default=None, alias="finalExam")
