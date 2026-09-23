"""
Per-course theme endpoints (16-theming): read/write the cohesive JSON
bundle stored at `Course.theme` (models/course.py), validated at this API
layer by schemas/theme.py's `CourseTheme` — the column itself stays plain
JSON, "validated on write by a Pydantic model at the API layer, not at the
DB layer" per that model's docstring.

Auth follows course_structure.py's pattern: get_current_user gates the
write, GET is public (the reader needs it to render for any visitor).

Contrast checking never blocks or auto-mutates the save — per prompts.md's
decision, a failing pair is returned as a `warnings` string so the CMS
theme editor can show it, but the user's colors are saved as given.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session as DbSession

from learnia_backend.database import get_db
from learnia_backend.deps import get_current_user
from learnia_backend.exceptions import NotFoundError
from learnia_backend.models.course import Course
from learnia_backend.models.user import User
from learnia_backend.schemas.theme import CourseTheme
from learnia_backend.utils.contrast import check_pair

router = APIRouter(prefix="/api/v1/courses", tags=["theme"])


class ThemeResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    theme: CourseTheme
    warnings: list[str] = Field(default_factory=list)


def _contrast_warnings(theme: CourseTheme) -> list[str]:
    """
    Checks the pairings that actually get rendered together in the reader:
    accent/heading text against each palette's background, and each
    palette's own text-on-background/text-on-surface.
    """
    warnings: list[str] = []
    for mode_name, palette in (("light", theme.light), ("dark", theme.dark)):
        pairs = [
            (f"accent on {mode_name} background", theme.accent, palette.background),
            (f"heading color on {mode_name} background", theme.heading_color, palette.background),
            (f"text on {mode_name} background", palette.text, palette.background),
            (f"text on {mode_name} surface", palette.text, palette.surface),
        ]
        for label, fg, bg in pairs:
            warning = check_pair(label, fg, bg)
            if warning:
                warnings.append(warning)
    return warnings


def _get_course_or_404(db: DbSession, course_id: int) -> Course:
    course = db.get(Course, course_id)
    if course is None:
        raise NotFoundError(f"Course {course_id} not found")
    return course


@router.get("/{course_id}/theme", response_model=ThemeResponse)
def get_theme(course_id: int, db: DbSession = Depends(get_db)) -> ThemeResponse:
    course = _get_course_or_404(db, course_id)
    theme = CourseTheme.model_validate(course.theme or {})
    return ThemeResponse(theme=theme, warnings=_contrast_warnings(theme))


@router.patch("/{course_id}/theme", response_model=ThemeResponse)
def update_theme(
    course_id: int,
    body: CourseTheme,
    db: DbSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> ThemeResponse:
    course = _get_course_or_404(db, course_id)
    # Saved via model_dump(by_alias=True) so the stored JSON keeps the same
    # camelCase shape course_repository.py's loosely-typed reads expect
    # (theme.get("accent"), theme.get("image"), ...).
    course.theme = body.model_dump(by_alias=True)
    db.commit()
    return ThemeResponse(theme=body, warnings=_contrast_warnings(body))
