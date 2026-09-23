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

from pydantic import BaseModel, ConfigDict, Field


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


class CourseDetail(CourseSummary):
    """What GET /courses/{slug} returns — includes the full content tree."""

    modules: list[ModuleOut] = Field(default_factory=list)
    final_exam: FinalExam | None = Field(default=None, alias="finalExam")


class ProgressResponse(BaseModel):
    """A learner's progress through one course — mirrors progressStore.js."""

    model_config = ConfigDict(populate_by_name=True)

    completed_page_ids: list[str] = Field(default_factory=list, alias="completedPageIds")
    last_page_id: str | None = Field(default=None, alias="lastPageId")
    module_quizzes: dict = Field(default_factory=dict, alias="moduleQuizzes")
    final_exam: dict | None = Field(default=None, alias="finalExam")
