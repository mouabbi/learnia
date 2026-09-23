import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from learnia_backend.config import settings
from learnia_backend.database import engine
from learnia_backend.exceptions import register_exception_handlers
from learnia_backend.logging_config import configure_logging
from learnia_backend.middleware import register_request_logging
from learnia_backend.routers import (
    assets,
    auth,
    content,
    course_admin,
    course_structure,
    courses,
    dashboard,
    health,
    import_validation,
    prompt_builder,
    questions,
    search,
    theme,
)
from learnia_backend.services.search_index import ensure_search_index

# Logging must be configured before anything else runs, so startup itself gets logged.
configure_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """
    Startup/shutdown hook (the modern FastAPI replacement for the older
    `@app.on_event("startup")` decorator). Code before `yield` runs on
    startup, code after `yield` runs on shutdown.
    """
    logger.info("Learnia backend started (environment=%s)", settings.environment)
    # Idempotent: safe to call on every boot (14-global-search).
    ensure_search_index(engine)
    yield
    logger.info("Learnia backend shutting down")


app = FastAPI(title=settings.app_name, lifespan=lifespan)

# Turns any `raise NotFoundError(...)` etc. into a consistent JSON error response.
# See exceptions.py for why this lives in one place instead of per-route try/except.
register_exception_handlers(app)

# Logs one line per request (client host, method, path, status, duration).
register_request_logging(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Every router is mounted here. Each router declares its own /api/v1 prefix
# internally (see routers/health.py) so versioning is explicit per-router.
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(courses.router)
app.include_router(course_admin.router)
app.include_router(course_structure.router)
app.include_router(content.router)
app.include_router(questions.router)
app.include_router(assets.router)
app.include_router(theme.router)
app.include_router(dashboard.router)
app.include_router(search.router)
app.include_router(prompt_builder.router)
app.include_router(import_validation.router)
