# 18 — Testing (Phase 2)

## Purpose
Establish test coverage once Phase 1 features exist: frontend unit/component,
backend unit/integration, and E2E across the whole stack.

## Confirmed scope
- Frontend: **Vitest + React Testing Library**
- Backend: **pytest + HTTPX** (via FastAPI's `TestClient`/async client)
- E2E: **Playwright**

## Concepts that must be covered
1. Backend test structure: fixtures (test DB — isolated SQLite per test run/transaction rollback), factory helpers for courses/modules/etc.
2. Backend test layers: unit (services, scoring logic, validators in isolation) vs. integration (API endpoints via HTTPX against a test app)
3. Frontend test structure: component tests (RTL) for block renderers, forms, progress UI; avoid testing implementation details
4. Auth in tests: how to simulate a logged-in session for protected-route tests
5. E2E critical paths: login → create course → add structure → add content → study flow → complete a module assessment → complete final exam → see dashboard update
6. Test data isolation (each test run should not pollute local dev DB/content files)
7. Coverage expectations (pragmatic — not 100%, focus on business logic: scoring, progress calc, validation, auth)

## Questions to answer before implementation
- Test database: separate SQLite file, in-memory SQLite, or transaction-rollback-per-test against the real file? → Recommend a separate throwaway SQLite file (or `:memory:`) per test session, created via the same Alembic migrations — keeps parity with real schema.
- How many E2E flows are "enough" for v1 — recommend a short fixed list rather than open-ended growth (see critical paths above); keep E2E suite intentionally small and fast.

## Dependencies
- All Phase 1 systems (01–17) — testing follows implementation, not the reverse.

## Implementation prompts that will eventually be required
1. Backend test infrastructure (pytest fixtures, test DB setup/teardown)
2. Backend unit tests: scoring service, progress calculation, content validation
3. Backend integration tests: auth flow, course/structure CRUD, content import, assessment/exam attempt flow
4. Frontend test infrastructure (Vitest config, RTL setup, mock API layer)
5. Frontend component tests: block renderers, progress controls, forms
6. Playwright setup + critical-path E2E suite
7. Wire test commands into a single local "run all tests" script (used later by CI)

## Learning opportunities
- Test pyramid thinking (unit vs. integration vs. E2E, and how much of each)
- Test fixtures/factories as a maintainability tool
- Testing async FastAPI endpoints
- E2E flakiness management (waits, selectors, isolation)
