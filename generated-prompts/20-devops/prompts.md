# 20 — DevOps: Containerization & CI/CD (Phases 3–4)

## Purpose
Containerize frontend and backend, orchestrate locally with Docker Compose, and
automate test/build/validation via GitHub Actions.

## Concepts that must be covered (Phase 3 — Docker)
1. Backend Dockerfile (FastAPI, multi-stage build if needed, dependency install layer caching)
2. Frontend Dockerfile (Vite build → served via nginx or a lightweight static server; or dev-mode container for local iteration)
3. Docker Compose: frontend + backend + volume for SQLite file + volume for content/assets
4. Environment variable injection into containers (`.env` + compose `env_file`)
5. Local dev experience inside containers (hot reload considerations vs. production build)

## Concepts that must be covered (Phase 4 — CI/CD)
1. GitHub Actions workflow: on push/PR → lint → backend tests (pytest) → frontend tests (Vitest) → build Docker images → (optionally) run Playwright E2E in CI
2. Caching strategy (pip/npm caches, Docker layer caching) to keep CI fast
3. Branch protection expectations (what must pass before merge — decide once a real branching workflow exists)
4. Secrets management in GitHub Actions (for eventual deploy steps in Phase 5)

## Questions to answer before implementation
- Single Dockerfile per app with dev/prod build stages (multi-stage), or separate Dockerfiles for dev vs. prod? → Recommend multi-stage single Dockerfile per app — standard practice, less duplication.
- Should CI build and push images to a registry (ECR) as part of Phase 4, or is that deferred to Phase 5 when deployment actually happens? → Recommend deferring registry push to Phase 5 (ECR setup) — Phase 4 CI should stop at "tests pass + image builds successfully," not yet publish anywhere.

## Dependencies
- 18-testing (CI needs a test suite to run)

## Implementation prompts that will eventually be required
1. Backend Dockerfile
2. Frontend Dockerfile
3. `docker-compose.yml` (local orchestration, volumes for SQLite + content + assets)
4. GitHub Actions: lint + test workflow
5. GitHub Actions: Docker build validation workflow
6. (Later, ties into 21) GitHub Actions: build-and-push-to-ECR workflow

## Learning opportunities
- Docker fundamentals (images, layers, multi-stage builds, volumes)
- Docker Compose for multi-service local orchestration
- CI pipeline design (stages, caching, fail-fast)
- GitHub Actions YAML and reusable workflows
