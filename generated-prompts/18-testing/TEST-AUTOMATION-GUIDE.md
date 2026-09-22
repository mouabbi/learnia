# Test automation: what it is and what to learn

## 1. What you just did vs. what comes next

- **Manual testing** (what you did with `03-authentication/TEST.md`): a human clicks and checks.
  Good for exploring; slow, and easy to forget cases.
- **Test automation** (yes, that is the name): you write *programs that test your program*.
  One command re-runs every check in seconds, the same way every time.

Why it matters: every future change (phases B to I, new features) can silently break login.
Automated tests tell you within seconds, before you merge. A test that catches an old bug
coming back is called a **regression test**.

The professional domain is **QA / test automation engineering** (job titles: QA automation
engineer, SDET). Developers also write tests themselves; that is what you are doing.

## 2. The test pyramid (what kinds of tests exist)

```
        /\        E2E tests        few, slow, real browser, whole app       (Playwright)
       /  \
      /----\      Integration      some, medium: API + database together   (pytest + HTTPX)
     /      \     Component        React pieces with a fake API             (Vitest + Testing Library)
    /--------\
   /   Unit   \   Unit tests       MANY, tiny, milliseconds, one function   (pytest, Vitest)
  /____________\
```
Rule: many cheap tests at the bottom, few expensive ones at the top. E2E tests are the most
realistic but slowest and most fragile, so you keep them for the critical journeys only.

## 3. Your toolset (already chosen in the roadmap)

| Layer | Tool | Tests |
|---|---|---|
| Backend | **pytest** + **HTTPX** (FastAPI's `TestClient`) | Python functions and API endpoints |
| Frontend | **Vitest** + **React Testing Library** | React components in a fake browser (jsdom) |
| End to end | **Playwright** | A real browser clicking through the real app |

## 4. Core ideas (learn these first, they apply to every tool)

- **AAA pattern**: *Arrange* (set up data), *Act* (do the thing), *Assert* (check the result).
- **Assertion**: the actual check, e.g. `assert response.status_code == 401`.
- **Isolation**: each test starts from a clean state (fresh empty database), so tests never
  depend on each other or on the order they run in.
- **Fixture**: reusable setup code (e.g. "an app connected to a temporary test database").
- **Mock / fake**: a stand-in for something slow or external (a fake API for React tests,
  a fake clock for expiry tests).
- **Test behavior, not implementation**: assert what the user or caller sees (status codes,
  text on screen), not which internal function got called.
- **Deterministic**: same result every run. A test that sometimes fails for no reason is
  **flaky**, and worse than no test.
- **Coverage** = % of code executed by tests. Useful to find untested areas; **not a goal**.
  100% coverage with weak assertions proves nothing.
- **Name tests as sentences**: `test_login_with_wrong_password_returns_401`.

A first backend test looks like this (illustration, not yet in the project):
```python
def test_register_duplicate_email_is_rejected(client):
    body = {"email": "a@example.com", "password": "longenough1"}
    client.post("/api/v1/auth/register", json=body)          # Arrange
    response = client.post("/api/v1/auth/register", json=body)  # Act
    assert response.status_code == 422                          # Assert
```

## 5. What to test in THIS project (auth phase A), in learning order

Your 14 manual cases in `TEST.md` map onto the pyramid like this.

**Step 1: backend unit tests (easiest, learn pytest here)**
- Password hashing: the hash differs from the password; `verify_password` is true for the
  right password and false for a wrong one.
- `UserSession.is_expired()`: false for a future time, true for a past time.
- `RegisterRequest`: rejects a password under 8 characters, accepts 8.
- `_classify_source` in `middleware.py`: curl -> `script`, `/docs` referer -> `docs`, and so on.

**Step 2: backend integration tests (the most valuable set for auth)**
Use `TestClient` with a temporary SQLite database, one fresh database per test.
- Register succeeds (201) and sets the cookie; duplicate email -> 422; short password -> 422.
- Wrong password and unknown email give the **same** 401 message (no user enumeration).
- Cookie flags: `HttpOnly` and `SameSite=lax` are present.
- `/auth/me` -> 401 with no cookie, 200 with the cookie; 401 again after logout.
- An expired session -> 401.
- Every error uses the `{"error": {"code", "message"}}` shape (including validation errors).
- The stored password is a bcrypt hash, never the plain text.

**Step 3: frontend component tests**
- `LoginPage`: shows "Invalid email or password" when the (mocked) API returns 401.
- `ProtectedRoute`: redirects to `/login` when logged out; shows the page when logged in.
- `PublicOnlyRoute`: redirects logged-in users away from `/login`.
- `BackendGate`: shows "Server unreachable" + Retry when the health call fails.

**Step 4: a few E2E tests with Playwright (manual cases 1 to 14, automated)**
- Register -> lands on home -> reload stays logged in -> log out -> redirected to `/login`.
- Wrong password shows the error; logged-in user opening `/login` goes home.
Keep this to about 3 to 5 journeys.

**Not worth testing**: library internals (does FastAPI parse JSON?), trivial getters, and CSS look.

## 6. Learning order

1. **pytest basics** (assert, fixtures, running one test): step 1 above.
2. **FastAPI `TestClient` + a temporary database fixture**: step 2. This is the biggest skill.
3. **Vitest + React Testing Library** and mocking `fetch`: step 3.
4. **Playwright**: step 4.
5. **Coverage reports**, then running everything in **CI** (GitHub Actions, folder `20-devops`)
   so tests run automatically on every pull request.

Install commands for when you start (not run yet):
```bash
cd backend  && uv add --dev pytest httpx
cd frontend && npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
cd frontend && npm install -D @playwright/test && npx playwright install
```

## 7. Habits

- Work on a branch `feature/testing` (see `GIT-GUIDE.md`), commit after each test file that passes.
- When you find a bug, **write the failing test first**, then fix the code: the test proves the fix.
- Run the tests before every pull request. Later CI enforces it.

## 8. Mini glossary

test runner (runs the tests) | assertion | fixture | mock | flaky | regression |
coverage | CI (runs tests automatically on every push) | TDD (write the test first, then the code).
