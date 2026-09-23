"""
Response shapes for the two-step import flow (13-ai-content-import-validation):
POST .../validate always returns one of these, POST .../commit re-validates
with the same shape before writing anything.
"""

from typing import Any

from pydantic import BaseModel


class ImportFieldError(BaseModel):
    field: str
    message: str


class ImportValidateResult(BaseModel):
    valid: bool
    parsed: Any = None
    errors: list[ImportFieldError] = []

# Note: commit/validate request bodies are taken as a plain `dict` in
# routers/import_validation.py (`{"json": "<raw string>", "replace": bool}`)
# rather than a dedicated Pydantic model, since `json` as a field name
# shadows BaseModel's own `.json()` and the body is trivial either way.
