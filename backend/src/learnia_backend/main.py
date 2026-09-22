import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from learnia_backend.config import settings
from learnia_backend.exceptions import register_exception_handlers
from learnia_backend.logging_config import configure_logging
from learnia_backend.middleware import register_request_logging
from learnia_backend.routers import auth, health

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
