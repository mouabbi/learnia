"""
Pydantic schema for `Course.theme` (models/course.py) — the JSON bundle's
API-layer validation. The column itself is untyped JSON ("validated on
write by a Pydantic model at the API layer, not at the DB layer" per that
file's docstring); this is that model.

Backward compatibility matters here: `repositories/course_repository.py`'s
`course_summary()`/`course_detail()` already read loosely-shaped keys
(`image`, `accent` as `difficulty`... see below) off whatever dict happens
to be in `course.theme` today, without going through this schema at write
time. Every field this model doesn't recognize as new is kept optional
with defaults so an old `{accent, image, difficulty, estimatedMinutes}`
dict still validates, and so does a brand-new full theme.
"""

from pydantic import BaseModel, ConfigDict, Field

# A generated palette that cycles once a course has more modules than
# colors, per generated-prompts/16-theming/prompts.md's recommendation
# ("a generated palette of a reasonable set (e.g. 8-10 colors) that
# cycles/extends algorithmically, editable per-module afterward").
DEFAULT_MODULE_PALETTE = [
    "#4f46e5",  # indigo
    "#7c3aed",  # violet
    "#2563eb",  # blue
    "#0d9488",  # teal
    "#059669",  # emerald
    "#d97706",  # amber
    "#e11d48",  # rose
    "#475569",  # slate
]

DEFAULT_ACCENT = "#4f46e5"
DEFAULT_SECONDARY = "#7c3aed"


class ThemePalette(BaseModel):
    """
    One light-or-dark set of surface tokens. Deliberately small — just
    enough for the reader shell to render legibly against a course's
    brand color, not a full design-token system.
    """

    model_config = ConfigDict(populate_by_name=True)

    background: str
    surface: str
    text: str


DEFAULT_LIGHT_PALETTE = ThemePalette(background="#ffffff", surface="#f8fafc", text="#111827")
DEFAULT_DARK_PALETTE = ThemePalette(background="#0f172a", surface="#1e293b", text="#f1f5f9")


class CourseTheme(BaseModel):
    """
    The validated shape of `Course.theme`. All fields are optional with
    sensible defaults so:
      - an old course with only `{accent, image, difficulty,
        estimatedMinutes}` still validates (those four are kept verbatim
        as passthrough fields below), and
      - a brand-new course with no theme set at all gets a complete,
        usable default theme back from `GET .../theme` rather than null.
    """

    model_config = ConfigDict(populate_by_name=True)

    # -- brand identity ----------------------------------------------------
    accent: str = DEFAULT_ACCENT
    secondary: str = DEFAULT_SECONDARY
    heading_color: str = Field(default=DEFAULT_ACCENT, alias="headingColor")

    # -- module colors ------------------------------------------------------
    # A cycling palette (see DEFAULT_MODULE_PALETTE) plus optional overrides
    # for specific module ids, so a course can start from the generated
    # palette and have individual modules recolored afterward without
    # losing the rest.
    module_palette: list[str] = Field(default_factory=lambda: list(DEFAULT_MODULE_PALETTE), alias="modulePalette")
    module_colors: dict[str, str] = Field(default_factory=dict, alias="moduleColors")

    # -- light/dark palettes -------------------------------------------------
    light: ThemePalette = Field(default_factory=lambda: DEFAULT_LIGHT_PALETTE)
    dark: ThemePalette = Field(default_factory=lambda: DEFAULT_DARK_PALETTE)

    # -- pre-existing loosely-typed keys (course_repository.py reads these
    # directly off course.theme) — kept as optional passthrough so nothing
    # already reading course.theme breaks.
    image: str | None = None
    difficulty: str | None = None
    estimated_minutes: int | None = Field(default=None, alias="estimatedMinutes")
    final_exam_duration_minutes: int | None = Field(
        default=None, alias="finalExamDurationMinutes"
    )

    def module_color(self, module_id: str, index: int) -> str:
        """
        Resolve the color for one module: an explicit per-module override
        if set, otherwise the generated palette cycled by position — the
        "cycles/extends algorithmically" behavior prompts.md calls for.
        """
        if module_id in self.module_colors:
            return self.module_colors[module_id]
        palette = self.module_palette or DEFAULT_MODULE_PALETTE
        return palette[index % len(palette)]
