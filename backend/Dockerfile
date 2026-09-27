# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Learnia backend (FastAPI + uvicorn), managed with uv.
# Build:  docker build -t learnia-backend ./backend
# (normally you don't run this by hand — docker compose builds it for you)
# ---------------------------------------------------------------------------

# Small official Python image (Debian "slim" = no compilers/docs, ~50MB).
# Same Python version as backend/.python-version.
FROM python:3.12-slim

# Copy ONLY the uv binaries from uv's official image (a tiny "COPY --from"
# trick — no need to pip-install uv). Same version you use locally.
COPY --from=ghcr.io/astral-sh/uv:0.12.17 /uv /uvx /bin/

# UV_COMPILE_BYTECODE: pre-compile .pyc files -> faster container start.
# UV_LINK_MODE=copy: the uv cache mount below is a different filesystem,
#   so copy files instead of hard-linking them (avoids a warning).
# UV_PYTHON_DOWNLOADS=0: use this image's Python, never download another.
# PYTHONUNBUFFERED: print logs immediately (don't buffer) -> `docker logs` is live.
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=0 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# --- Layer caching trick -----------------------------------------------------
# Copy ONLY the dependency files first, then install dependencies.
# Docker caches each layer: as long as pyproject.toml/uv.lock don't change,
# this slow step is reused on every rebuild, even when you edit the code.
COPY pyproject.toml uv.lock README.md ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev --no-install-project

# Now copy the code (changes often -> only the layers from here re-run).
COPY src ./src
COPY alembic ./alembic
COPY alembic.ini ./
COPY scripts ./scripts

# Install the project itself into the same virtualenv (/app/.venv).
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev

# Put the virtualenv first on PATH, so `python`, `alembic`, `uvicorn`
# all come from /app/.venv without "uv run" or "source activate".
ENV PATH="/app/.venv/bin:$PATH"

# --- Don't run as root ---------------------------------------------------------
# Create a normal user and give it the folders the app writes to. These
# folders become volume mount points (see docker-compose.yml); an empty named
# volume copies this ownership on first use, so the app can write there.
RUN useradd --create-home --uid 1000 app \
    && mkdir -p /app/data /app/content /app/assets /app/logs \
    && chown -R app:app /app/data /app/content /app/assets /app/logs
USER app

# Documentation only: the app listens on 8000 inside the container.
EXPOSE 8000

# Docker asks the container "are you OK?" every 30s by calling /health.
# docker compose waits for "healthy" before starting the frontend.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health', timeout=4)"

# 1) apply DB migrations, 2) start the server.
# `exec` REPLACES the shell with uvicorn, so uvicorn becomes PID 1 and gets
# Docker's stop signal (SIGTERM) directly -> clean, fast shutdown.
# --proxy-headers: trust X-Forwarded-For from nginx, so the backend sees the
# real client IP (the login rate-limit counts failures per IP).
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn learnia_backend.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"]
