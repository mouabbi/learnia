"""
Pydantic schema conventions, demonstrated on the `health` "entity".

Standard pattern per entity (used everywhere, e.g. `Course`, `User`...):
  - Base    : fields shared by every variant below
  - Create  : fields required to CREATE one (no id, no timestamps —
              those are assigned by the server/DB)
  - Update  : same fields as Create, but all OPTIONAL (for partial PATCH updates)
  - Read    : what the API RETURNS (includes id, timestamps, etc.)

`health` doesn't naturally need a Create/Update (you don't "create" a health
check) — only `Read` is real here. They're still shown below as comments so
this file also serves as the template to copy when building a real entity
(e.g. `schemas/course.py`).
"""

from pydantic import BaseModel


class HealthBase(BaseModel):
    """Fields shared across all variants. Health has just one: `status`."""

    status: str


class HealthResponse(HealthBase):
    """
    What GET /api/v1/health returns. This is the "Read" schema.
    Kept as `HealthResponse` (not `HealthRead`) since it's the router's
    return type and that name reads more clearly there.
    """

    pass


# --- Template for a real entity (e.g. schemas/course.py), for reference: ---
#
# class CourseBase(BaseModel):
#     title: str
#     description: str
#
# class CourseCreate(CourseBase):
#     pass  # nothing extra needed to create one
#
# class CourseUpdate(BaseModel):
#     title: str | None = None        # all fields optional: partial update
#     description: str | None = None
#
# class CourseRead(CourseBase):
#     id: int
#     created_at: datetime
