"""
Authoring schemas for Question (09-assessment-qcm / 10-final-exam) — the
CMS-facing counterpart to schemas/courses.py's QuizQuestion (which is the
stripped, learner-facing shape with no `correctOptionIds`/`explanation`).
"""

from pydantic import BaseModel, ConfigDict, Field


class QuestionOptionIn(BaseModel):
    """`id` is optional on create — the repository assigns opt1/opt2/...
    for any option that doesn't supply one, so authoring forms never have
    to invent ids client-side."""

    id: str | None = None
    text: str


class QuestionWriteRequest(BaseModel):
    """Shared body for create and update — a question is always replaced
    whole, never patched field-by-field, since options/correctOptionIds
    are only meaningful together."""

    model_config = ConfigDict(populate_by_name=True)

    text: str
    options: list[QuestionOptionIn]
    correct_option_ids: list[str] = Field(alias="correctOptionIds")
    explanation: str | None = None
    difficulty: str | None = None


class QuestionOptionOut(BaseModel):
    id: str
    text: str


class QuestionAdminOut(BaseModel):
    """Full question shape, including answers — authoring/review only,
    never sent to a learner mid-attempt."""

    model_config = ConfigDict(populate_by_name=True)

    id: str
    scope: str
    course_id: str = Field(alias="courseId")
    module_id: str | None = Field(default=None, alias="moduleId")
    text: str
    options: list[QuestionOptionOut]
    correct_option_ids: list[str] = Field(alias="correctOptionIds")
    explanation: str | None = None
    difficulty: str | None = None
