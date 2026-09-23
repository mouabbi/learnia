"""
Pydantic schemas for the courses domain (see routers/courses.py), built
against the real normalized schema (models/course.py, module.py, chapter.py,
page.py, question.py, assessment.py, final_exam.py, learning_progress.py) —
not a JSON blob.

Request bodies come from the frontend as camelCase JSON (pageId, moduleId,
...); response models serialize back out as camelCase, matching what
frontend/features/courses/coursesApi.js + progressStore.js already expect
(mirrors frontend/features/courses/mockCourses.js's Module > Chapter > Page
tree shape, and the flat {completedPageIds, lastPageId, moduleQuizzes,
finalExam} progress shape) — so the frontend needed zero changes to point
at this instead of the mock data.
"""

import re

from pydantic import BaseModel, ConfigDict, Field, field_validator

from learnia_backend.models.enums import ContentStatus

_SLUG_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


class CourseAdminSummary(BaseModel):
    """Course row for the CMS picker (routers/course_admin.py) — unlike the
    public CourseSummary, this includes every status (drafts included) and
    the status itself, since an admin needs to see what's unpublished."""

    id: int
    slug: str
    title: str
    description: str
    content_status: str = Field(serialization_alias="contentStatus")

    model_config = ConfigDict(populate_by_name=True)


class CourseCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    slug: str
    title: str
    description: str | None = None
    icon: str | None = None

    @field_validator("slug")
    @classmethod
    def slug_is_url_safe(cls, value: str) -> str:
        if not _SLUG_RE.match(value):
            raise ValueError("Slug must be lowercase letters, numbers and hyphens (e.g. 'my-course')")
        return value

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Title is required")
        return value


class CourseUpdateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    title: str | None = None
    description: str | None = None
    icon: str | None = None
    content_status: ContentStatus | None = Field(default=None, alias="contentStatus")


class MarkPageCompleteRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    page_id: str = Field(alias="pageId")


class SetLastPageRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    page_id: str = Field(alias="pageId")


class ModuleQuizAttemptRequest(BaseModel):
    """
    Frontend already grades the quiz client-side (see features/courses/
    Quiz.jsx) and posts the final tally — it does not (yet) submit
    per-question answers, so there's no AssessmentAnswer row written here,
    only the AssessmentAttempt summary. A real answer-by-answer submission
    flow is future work.
    """

    model_config = ConfigDict(populate_by_name=True)

    module_id: str = Field(alias="moduleId")
    score: int
    total: int


class FinalExamAttemptRequest(BaseModel):
    """Same simplification as ModuleQuizAttemptRequest, for the final exam."""

    score: int
    total: int


class QuestionOption(BaseModel):
    id: str
    text: str


class QuizQuestion(BaseModel):
    """
    One question, shaped for the frontend's single-answer Quiz/Exam UI —
    `correct_option_ids` (plural, supports multi-answer) collapses to the
    first id, since neither Quiz.jsx nor ExamPage.jsx support multi-select
    yet.
    """

    model_config = ConfigDict(populate_by_name=True)

    id: str
    prompt: str
    options: list[QuestionOption]
    correct_option_id: str = Field(alias="correctOptionId")


class Quiz(BaseModel):
    questions: list[QuizQuestion]


class FinalExam(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    duration_minutes: int = Field(alias="durationMinutes")
    questions: list[QuizQuestion]


class PageOut(BaseModel):
    id: str
    title: str
    content: str


class ChapterOut(BaseModel):
    id: str
    title: str
    points: int
    pages: list[PageOut]


class ModuleOut(BaseModel):
    id: str
    title: str
    summary: str | None = None
    chapters: list[ChapterOut]
    quiz: Quiz | None = None


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
    content_status: str = Field(alias="contentStatus")


class CourseDetail(CourseSummary):
    """What GET /courses/{slug} returns — includes the full content tree."""

    modules: list[ModuleOut] = Field(default_factory=list)
    final_exam: FinalExam | None = Field(default=None, alias="finalExam")


class CreateModuleRequest(BaseModel):
    title: str


class CreateChapterRequest(BaseModel):
    title: str


class CreatePageRequest(BaseModel):
    title: str


class RenameRequest(BaseModel):
    """Shared body for rename-module/chapter/page endpoints."""

    title: str


class MoveChapterRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    module_id: str = Field(alias="moduleId")


class MovePageRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    chapter_id: str = Field(alias="chapterId")


class ReorderRequest(BaseModel):
    """Shared body for reorder-modules/chapters/pages endpoints."""

    model_config = ConfigDict(populate_by_name=True)

    ordered_ids: list[str] = Field(alias="orderedIds")


class ModuleAdminOut(BaseModel):
    """What the CRUD endpoints return for a module — id/title/position only."""

    id: str
    title: str
    position: int


class ChapterAdminOut(BaseModel):
    id: str
    title: str
    position: int
    module_id: str = Field(alias="moduleId", serialization_alias="moduleId")


class PageAdminOut(BaseModel):
    id: str
    title: str
    position: int
    chapter_id: str = Field(alias="chapterId", serialization_alias="chapterId")


class ProgressResponse(BaseModel):
    """A learner's progress through one course — mirrors progressStore.js."""

    model_config = ConfigDict(populate_by_name=True)

    completed_page_ids: list[str] = Field(default_factory=list, alias="completedPageIds")
    last_page_id: str | None = Field(default=None, alias="lastPageId")
    module_quizzes: dict = Field(default_factory=dict, alias="moduleQuizzes")
    final_exam: dict | None = Field(default=None, alias="finalExam")
