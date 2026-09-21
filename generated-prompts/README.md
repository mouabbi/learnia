# Learnia — Engineering Roadmap

This directory is the **Level 2** planning layer for the Learnia project (personal
interactive learning platform). It sits between:

- **Level 1 — Master Context**: the full product vision (provided by the user, not stored here).
- **Level 2 — System Prompt Plans** (this directory): one folder per engineering system,
  each with a `prompts.md` describing concepts, open questions, dependencies, and the
  future implementation prompts that will eventually be requested.
- **Level 3 — Implementation Prompts**: generated later, one at a time, on request
  ("Generate the implementation prompt for: Authentication → Session Management").

**Do not skip from Level 1 to Level 3.** Each system folder must be read and its open
questions resolved (or explicitly deferred) before Level 3 prompts are generated for it.

---

## Confirmed technology decisions

| Area | Decision | Notes |
|---|---|---|
| Frontend | React.js (Vite) | Plain JS initially; TypeScript introduced progressively, per-file, when it earns its place — not mandated project-wide. |
| Backend | FastAPI (Python) | Async-capable, Pydantic-native, strong typing on the server from day one. |
| Validation | Pydantic v2 | Both for API request/response models and for validating AI-generated JSON content. |
| API style | REST | No GraphQL. Keep endpoints resource-oriented and predictable. |
| Database | SQLite | Single-user, file-based, zero-ops locally; portable to RDS/Postgres later if ever needed. |
| ORM / migrations | **SQLAlchemy 2.0 + Alembic** | *Substituted for the requested Prisma*: Prisma has no FastAPI/Python binding. SQLAlchemy 2.0 (typed, declarative) + Alembic migrations is the direct Python equivalent — same learning goals (type-safe models, relational modeling, migrations). |
| State management (frontend) | `useState`/Context first | Redux Toolkit introduced later, only if/when a feature genuinely needs cross-tree shared state with complex updates — decided per-feature, not upfront. |
| Auth | Full session-based auth, from Phase 1 | Real signup/login, hashed passwords, server-side sessions. Single user initially, but built as if more could be added. |
| AI integration | Manual copy/paste workflow initially | No AI API calls in Phase 1. Platform builds prompts and validates/imports pasted JSON. |
| Content storage | Hybrid: SQLite (structure/metadata/progress) + JSON files (page content) + filesystem (assets) | Detailed per-system in `04-database/` and `07-content-system/`. |

---

## Phases (delivery order)

The roadmap below groups systems into 6 phases. Systems within a phase can be
implemented in roughly the listed order; later phases assume earlier ones exist.

### Phase 1 — Application Development
Core product, single-user, local only. No containers, no CI, no cloud.
Folders: `01` through `17`.

### Phase 2 — Testing
Frontend unit/component tests (Vitest + React Testing Library), backend tests
(pytest + HTTPX), E2E (Playwright). Folder: `18-testing/`.

### Phase 3 — Containerization
Docker for frontend and backend, Docker Compose for local orchestration.
Folder: `20-devops/` (Docker subsection).

### Phase 4 — CI/CD
GitHub Actions: lint, test, build, validate on push/PR.
Folder: `20-devops/` (CI/CD subsection).

### Phase 5 — AWS Deployment
Progressive: EC2 → RDS (if migrating off SQLite) → S3 (assets) → ECR → CloudWatch.
Folder: `21-deployment/`.

### Phase 6 — Hosting & Production
Domain, HTTPS, monitoring, backups, production security hardening.
Folder: `21-deployment/` (production subsection).

---

## System directory index

| # | System | Phase | Depends on |
|---|---|---|---|
| 01 | [Project Foundation ✅](01-project-foundation/01-project-foundation-completed.md) | 1 | — |
| 02 | [Architecture ✅](02-architecture/02-architecture-completed.md) | 1 | 01 |
| 03 | [Authentication ✅ (Phase A)](03-authentication/03-authentication-phase-a-completed.md) | 1 | 02, 04 |
| 04 | [Database](04-database/prompts.md) | 1 | 02 |
| 05 | [Course System](05-course-system/prompts.md) | 1 | 04 |
| 06 | [Course Structure](06-course-structure/prompts.md) | 1 | 05 |
| 07 | [Content System](07-content-system/prompts.md) | 1 | 06 |
| 08 | [Learning Progress](08-learning-progress/prompts.md) | 1 | 06, 07 |
| 09 | [Assessment / QCM](09-assessment-qcm/prompts.md) | 1 | 06, 07, 08 |
| 10 | [Final Exam](10-final-exam/prompts.md) | 1 | 09 |
| 11 | [Content Workspace / CMS](11-content-workspace-cms/prompts.md) | 1 | 06, 07, 15, 16 |
| 12 | [AI Prompt Builder](12-ai-prompt-builder/prompts.md) | 1 | 06, 07, 09, 10 |
| 13 | [AI Content Import & Validation](13-ai-content-import-validation/prompts.md) | 1 | 07, 12 |
| 14 | [Global Search](14-global-search/prompts.md) | 1 | 06, 07, 08 |
| 15 | [Assets](15-assets/prompts.md) | 1 | 04 |
| 16 | [Theming](16-theming/prompts.md) | 1 | 05 |
| 17 | [Dashboard](17-dashboard/prompts.md) | 1 | 05, 08 |
| 18 | [Testing](18-testing/prompts.md) | 2 | all of Phase 1 |
| 19 | [Performance & Accessibility](19-performance-accessibility/prompts.md) | 1–2 (cross-cutting) | 06, 07, 11 |
| 20 | [DevOps (Docker, CI/CD)](20-devops/prompts.md) | 3–4 | 18 |
| 21 | [Deployment (AWS, Production)](21-deployment/prompts.md) | 5–6 | 20 |
| 22 | [Future Versioning](22-future-versioning/prompts.md) | Deferred | 06, 07 |

---

## Cross-cutting design decisions already locked in

- **Assessment model**: module-level assessments only (no per-chapter, no per-page).
  Each module assessment has **at least 50 questions**. Final exam has 100 questions.
  Scoring: `globalScore = moduleAssessmentAverage × 0.20 + finalExamScore × 0.80`.
  See `09-assessment-qcm/prompts.md`.
- **Content vs. Learning status are separate state machines.** Never conflate
  `PLANNED/DRAFT/READY/PUBLISHED/ARCHIVED` with `NOT_STARTED/IN_PROGRESS/COMPLETED`.
- **Code execution is out of scope** for the initial version (display-only code blocks).
- **Versioning is deferred** — `22-future-versioning/` only captures the open questions,
  no implementation prompts yet.

## Git workflow

Read [GIT-WORKFLOW.md](GIT-WORKFLOW.md) once (setup from zero, daily loop, PRs, merging,
undo cheat sheet). Every system folder also has a short `GIT-GUIDE.md` with its own
branch name and the exact commands for that system.

## How to use this roadmap going forward

1. Open the relevant system's `prompts.md`.
2. Resolve any "Questions to answer before implementation" still marked open
   (ask the user if they materially affect architecture).
3. Ask: "Generate the implementation prompt for: `<System> → <specific item>`".
4. That produces a Level 3 prompt — precise, scoped, ready to execute.
5. Implement in small increments; do not jump ahead to unimplemented dependencies.
