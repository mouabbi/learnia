"""
Custom application exceptions + FastAPI exception handlers.

Why this file exists:
Instead of every router building its own error JSON with try/except blocks,
routers/services just `raise NotFoundError(...)` and this file's handlers
turn that into a consistent HTTP response, in one place, for the whole app.
"""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class AppError(Exception):
    """
    Base class for all application-raised errors.

    `code` is a machine-readable string the frontend can switch on
    (e.g. to show a specific message), `message` is human-readable.
    `status_code` controls the HTTP status returned to the client.
    """

    status_code: int = 400
    code: str = "APP_ERROR"

    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


class NotFoundError(AppError):
    """Raised when a requested resource (course, module, user...) doesn't exist."""

    status_code = 404
    code = "NOT_FOUND"


class ValidationAppError(AppError):
    """
    Raised for business-rule validation failures that aren't caught by
    Pydantic schema validation (e.g. an illegal state transition).
    Distinct from FastAPI/Pydantic's own 422 validation errors.
    """

    status_code = 422
    code = "VALIDATION_ERROR"


class UnauthorizedError(AppError):
    """Raised when a request has no valid session/credentials."""

    status_code = 401
    code = "UNAUTHORIZED"


def register_exception_handlers(app: FastAPI) -> None:
    """
    Wire up global exception handlers on the FastAPI app.

    Call this once from main.py. After this, any router/service can simply
    `raise NotFoundError("Course 42 not found")` and this handler turns it
    into a consistent JSON error response — no per-route error building.
    """

    @app.exception_handler(AppError)
    async def handle_app_error(_request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": exc.code, "message": exc.message}},
        )

    @app.exception_handler(RequestValidationError)
    async def handle_request_validation_error(
        _request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        """
        Without this, FastAPI's own request-body validation (e.g. a
        RegisterRequest field failing its Pydantic validator) returns its
        default `{"detail": [...]}` shape — different from every other
        error in this app. This normalizes it to the same
        `{"error": {code, message}}` shape as AppError, joining every
        field error into one readable message.
        """
        messages = "; ".join(
            f"{'.'.join(str(loc) for loc in err['loc'] if loc != 'body')}: {err['msg']}"
            for err in exc.errors()
        )
        return JSONResponse(
            status_code=422,
            content={"error": {"code": "VALIDATION_ERROR", "message": messages}},
        )
