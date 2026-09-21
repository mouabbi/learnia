# 02 — Architecture [DONE]

## What was built

The structural conventions the rest of the app builds on: API versioning, global
error handling, file-based logging, the Pydantic schema pattern, a reserved
(empty) repository layer, and the hybrid frontend folder structure.

## Project structure (new/changed files)

```text
backend/
├── logs/app.log                          # rotating log file (git-ignored)
└── src/learnia_backend/
    ├── main.py                            # lifespan logging hook, exception handlers wired in
    ├── exceptions.py                      # AppError + NotFoundError/ValidationAppError/UnauthorizedError + handler
    ├── logging_config.py                  # console + rotating file logging setup
    ├── routers/health.py                  # now under /api/v1
    ├── schemas/health.py                  # documents Base/Create/Update/Read pattern
    └── repositories/__init__.py            # empty — first real repo added in 05-course-system

frontend/
├── .env.development                       # VITE_API_BASE_URL=/api/v1
└── src/
    ├── api/client.js                      # shared fetch wrapper + ApiError
    ├── components/README.md               # explains type-based reusable UI folder
    ├── features/health/
    │   ├── healthApi.js
    │   └── BackendStatus.jsx
    ├── pages/HomePage.jsx
    └── App.jsx                            # now thin, renders HomePage
```

## How to run / verify

Same as Phase 01 (`uv run uvicorn learnia_backend.main:app --app-dir src --reload --port 8000` and `npm run dev`), with these checks specific to this phase:

1. `curl http://127.0.0.1:8000/api/v1/health` → `{"status":"ok"}`
2. `curl http://127.0.0.1:8000/api/health` → `404` (old unversioned path is gone)
3. `cat backend/logs/app.log` → shows timestamped startup log lines
4. Open the frontend → "Backend status: ok", now served via `features/health/BackendStatus.jsx` → `api/client.js`
5. `uv run ruff check .` (backend) and `npm run lint` (frontend) → both clean

## What I learned

- **API versioning**: prefixing routes with `/api/v1` costs nothing today and avoids
  ever having to break existing frontend calls when the API's shape changes later.
- **Centralized error handling**: FastAPI's `@app.exception_handler(AppError)` lets
  any router/service `raise NotFoundError(...)` without knowing anything about HTTP
  status codes or JSON shapes — that translation happens in exactly one place.
- **`lifespan` over `@app.on_event`**: the `on_event` decorator is FastAPI's older,
  now-deprecated startup/shutdown hook; `@asynccontextmanager` + `lifespan=` is the
  current recommended pattern (code before `yield` = startup, after = shutdown).
- **Python `logging` vs. `print`**: `logging` gives severity levels, timestamps, and
  can fan out to multiple destinations (console + file) at once via handlers —
  `RotatingFileHandler` specifically caps file size so logs don't grow forever.
- **Repository pattern trade-off**: it's a real, valid pattern (isolates data access
  so services are testable without a real DB), but for a single-developer SQLite app
  its main "swap the data store" benefit rarely pays off — which is why it's reserved
  for `05-course-system` rather than built against a throwaway entity now.
- **Vite env files**: `.env`, `.env.development`, `.env.production` are loaded
  automatically based on whether you run `npm run dev` or `npm run build` — no
  manual switching — and only `VITE_`-prefixed variables reach browser code.

## Decisions

- **Versioned API from day one** (`/api/v1`) — cheap now, avoids breaking changes later.
- **Lightweight repository layer, deferred to `05-course-system`** — wanted for the
  learning value (testable services), but not built against a fake entity now.
- **Hybrid frontend folders** (`api/`, `components/` by type; `features/` by domain;
  `pages/` by type) — reusable/generic code stays type-based, domain-specific code
  gets its own feature folder.
- **File-based logging on backend, console-only on frontend for now** — a browser
  can't usefully write to a log file; frontend error reporting to the backend is
  deferred until it's actually needed (e.g. post-deployment).
- **`.env` now, real secret store (AWS Secrets Manager/SSM) at deployment time** —
  `pydantic-settings` code doesn't change, only where the env vars come from.

## Not implemented yet

- Authentication (`03-authentication`)
- Database / SQLAlchemy models (`04-database`)
- The real repository layer (waits for `05-course-system`)
- Routing on the frontend (only one page exists so far)
- Testing, Docker, CI/CD, AWS deployment — later phases per the [roadmap](../README.md)
