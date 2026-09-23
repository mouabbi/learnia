"""
Pydantic schemas for GET /api/v1/dashboard (see routers/dashboard.py) — a
read-model aggregation over the courses + progress systems (05-course-system,
08-learning-progress), not new domain data. Response serializes to camelCase
like schemas/courses.py.
"""

from pydantic import BaseModel, ConfigDict, Field

from learnia_backend.schemas.courses import CourseSummary


class ContinueLearning(BaseModel):
    """The single course the user is currently IN_PROGRESS on, most
    recently touched (LearningProgress.updated_at) — null when none."""

    model_config = ConfigDict(populate_by_name=True)

    course: CourseSummary
    progress_pct: int = Field(alias="progressPct")
    last_page_id: str | None = Field(default=None, alias="lastPageId")
    last_page_title: str | None = Field(default=None, alias="lastPageTitle")


class DashboardCourse(CourseSummary):
    """A course plus this user's own learning status/progress on it."""

    model_config = ConfigDict(populate_by_name=True)

    learning_status: str = Field(alias="learningStatus")
    progress_pct: int = Field(alias="progressPct")


class DashboardStats(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    in_progress_count: int = Field(alias="inProgressCount")
    completed_count: int = Field(alias="completedCount")
    total_count: int = Field(alias="totalCount")


class DashboardResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    continue_learning: ContinueLearning | None = Field(default=None, alias="continueLearning")
    courses: list[DashboardCourse] = Field(default_factory=list)
    recommendations: list[CourseSummary] = Field(default_factory=list)
    stats: DashboardStats
