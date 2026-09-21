# 01 — Project Foundation [DONE]

## What was built

The initial monorepo skeleton: a React + Vite frontend, a FastAPI + uv backend,
a working health-check endpoint proving frontend↔backend connectivity, linting
and formatting for both apps, and a Git repository with an initial commit.

## Project structure

```text
Learnia/
├── .gitignore
├── README.md
├── generated-prompts/              # engineering roadmap (see its own README)
├── frontend/
│   ├── eslint.config.js
│   ├── .prettierrc.json
│   ├── .env.example
│   ├── vite.config.js              # dev server + /api proxy to backend
│   ├── index.html
│   ├── package.json
│   └── src/
│       ├── main.jsx
│       ├── App.jsx                 # renders backend health status
│       └── App.css
└── backend/
    ├── pyproject.toml              # deps + ruff config
    ├── .env.example
    ├── .python-version
    └── src/learnia_backend/
        ├── main.py                 # FastAPI app, CORS, router registration
        ├── config.py                # pydantic-settings Settings
        ├── routers/health.py       # GET /api/health
        ├── schemas/health.py       # HealthResponse Pydantic model
        ├── models/                 # (empty, reserved for future DB models)
        └── services/                # (empty, reserved for business logic)
```

## Technologies

- **React** — UI library for the frontend.
- **Vite** — frontend dev server and build tool; fast HMR, proxies `/api` calls to the backend in dev.
- **JavaScript** — frontend language for now; TypeScript is a deliberate later step, not adopted upfront.
- **npm** — frontend package manager (comes with Node, no extra install needed).
- **FastAPI** — backend web framework; async-capable, built on Starlette, integrates natively with Pydantic for request/response validation.
- **Python** — backend language.
- **Pydantic** — data validation/schema library; used here for `HealthResponse` and for typed settings (`pydantic-settings`).
- **uv** — Python package/project manager; replaces manual `venv` + `pip`, manages `pyproject.toml` and a lockfile (`uv.lock`), and runs commands inside the project's virtual environment (`uv run ...`).
- **Git** — version control; monorepo tracked as a single repository.
- **ESLint** — frontend linter (flat config, `eslint.config.js`); catches bugs and enforces React hooks rules.
- **Prettier** — frontend code formatter; paired with `eslint-config-prettier` so ESLint doesn't fight Prettier on formatting rules.
- **Ruff** — backend linter (and formatter-capable); extremely fast, configured in `pyproject.toml` under `[tool.ruff]`.

## Commands used

| Command | What it does |
|---|---|
| `git init` | Initialize the repository. |
| `npm create vite@latest frontend -- --template react` | Scaffold the React+Vite app in `frontend/`. |
| `npm install` (in `frontend/`) | Install frontend dependencies. |
| `uv init --name learnia-backend --python 3.12` (in `backend/`) | Scaffold a uv-managed Python project (`pyproject.toml`, `.venv`, `src/` layout). |
| `uv add fastapi "uvicorn[standard]" pydantic pydantic-settings` | Add backend runtime dependencies, resolved and locked by uv. |
| `uv add --dev ruff` | Add Ruff as a dev-only dependency. |
| `uv run uvicorn learnia_backend.main:app --app-dir src --port 8000` | Run the backend dev server. |
| `uv run ruff check .` | Lint the backend. |
| `npm run dev` (in `frontend/`) | Run the frontend dev server. |
| `npm run lint` (in `frontend/`) | Lint the frontend with ESLint. |
| `npm run format` (in `frontend/`) | Format frontend files with Prettier. |

## How to run

**Backend** (from `backend/`):
```bash
uv run uvicorn learnia_backend.main:app --app-dir src --reload --port 8000
```

**Frontend** (from `frontend/`, in a second terminal):
```bash
npm run dev
```

Open the URL Vite prints (typically `http://localhost:5173`). The page fetches
`/api/health`, which Vite proxies to the backend on port 8000.

## How to verify

1. `curl http://127.0.0.1:8000/api/health` → `{"status":"ok"}` (backend alone).
2. With both servers running, open the frontend in a browser — it should show
   "Backend status: ok".
3. `npm run lint` (frontend) → no errors.
4. `uv run ruff check .` (backend) → `All checks passed!`
5. `git log --oneline` → shows the initial foundation commit.

## What I learned

- **uv vs. pip/venv**: uv manages the virtual environment, dependency resolution, and
  a lockfile (`uv.lock`) together, and `uv run` executes commands inside that
  environment automatically — no manual `source .venv/bin/activate` step.
- **FastAPI + Pydantic**: response models (`HealthResponse`) aren't just documentation —
  FastAPI validates and serializes through them automatically, and they show up in
  the auto-generated OpenAPI docs at `/docs`.
- **Vite's dev proxy**: `server.proxy` in `vite.config.js` lets the frontend call
  relative `/api/...` paths in development without hardcoding the backend's host/port,
  and without CORS issues (the browser only ever talks to Vite's own origin).
- **Flat ESLint config**: modern ESLint (v9+) uses a JS array of config objects
  (`eslint.config.js`) instead of the old `.eslintrc` JSON/YAML format.
- **CORS**: even with the dev proxy, `CORSMiddleware` is configured on the FastAPI
  side so the backend can be called directly (e.g. via `/docs`, or once the proxy
  isn't in front of it in later phases).

## Decisions

- **Monorepo** (`frontend/` + `backend/` in one Git repo): simplest setup for a
  solo learner; still allows independent Docker images and independent deploys later
  without needing separate repos now.
- **npm**: default, zero-extra-install package manager for Node; no strong reason
  to add pnpm/yarn complexity yet.
- **uv**: modern, fast, increasingly standard Python tooling; combines what used to
  require `pip` + `venv` + a separate lockfile tool into one command.
- **React + Vite (no Next.js)**: this project doesn't need server-side rendering or
  file-based routing yet; a plain SPA is simpler to reason about while learning
  React fundamentals, and Next.js can be evaluated later on its own merits if needed.
- **JavaScript initially (no TypeScript)**: avoids learning React and TypeScript's
  type system simultaneously; TypeScript will be introduced per-file when a feature
  genuinely benefits from it, not mandated project-wide from day one.
- **ESLint + Prettier over the Vite-default oxlint**: oxlint is fast but newer/less
  configurable for this project's needs; ESLint + Prettier is the more widely used,
  more thoroughly documented combination, which matters more here than raw lint speed.

## Not implemented yet

- TypeScript
- Redux Toolkit
- SQLAlchemy
- Alembic
- SQLite (or any database)
- Authentication
- Testing (Vitest, pytest, Playwright)
- Docker / Docker Compose
- GitHub Actions / CI
- AWS deployment

These belong to later phases per the [roadmap](../README.md).
