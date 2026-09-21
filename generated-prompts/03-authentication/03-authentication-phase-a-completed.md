# 03 — Authentication: Phase A [DONE]

Phases B through I are still open — see `CHECKLIST.md` for the full roadmap and
the "Authentication Lab" analysis (buckets, phase ordering, design-pattern
discussion) that shaped this implementation.

## What was built

Password-based authentication with server-side sessions, plus registration —
the app's real, permanent login system (not a lab exercise). Built on a Strategy
pattern from the start: credential verification and session management are
separate, swappable interfaces, each with one concrete implementation today.

## Project structure (new files)

```text
backend/
├── alembic/                                   # migrations (new — needed for auth's tables)
│   ├── env.py                                 # wired to our models + settings.database_url
│   └── versions/..._create_users_and_user_sessions_tables.py
├── scripts/seed_user.py                       # creates a user from the CLI
└── src/learnia_backend/
    ├── database.py                            # SQLAlchemy engine/session (new — minimum for auth)
    ├── deps.py                                # get_current_user
    ├── models/
    │   ├── user.py
    │   └── session.py                         # UserSession — server-side session record
    ├── repositories/
    │   ├── user_repository.py                 # first real repository (per 02-architecture)
    │   └── session_repository.py
    ├── security/passwords.py                  # hash_password/verify_password (pwdlib)
    ├── auth/
    │   ├── strategies/
    │   │   ├── base.py                        # AuthStrategy interface
    │   │   └── password.py                    # PasswordStrategy
    │   ├── session_issuers/
    │   │   ├── base.py                         # SessionIssuer interface
    │   │   └── cookie.py                       # CookieSessionIssuer
    │   └── registry.py                         # config -> strategy/issuer instance (factory)
    ├── services/auth_service.py                # login/register/logout orchestration
    ├── schemas/auth.py                         # PasswordLoginRequest, RegisterRequest, UserRead
    ├── routers/auth.py                         # /auth/register, /auth/login/password, /auth/logout, /auth/me
    └── utils/time.py                           # utc_now_naive() — SQLite timezone workaround

frontend/src/
├── api/client.js                               # (from 02-architecture) now reads VITE_API_BASE_URL
├── features/auth/
│   ├── authApi.js
│   ├── AuthContext.jsx                         # useAuth() — app-wide auth state
│   └── ProtectedRoute.jsx
├── pages/
│   ├── LoginPage.jsx
│   ├── RegisterPage.jsx
│   └── HomePage.jsx                            # now protected, shows user + logout
├── App.jsx                                     # routing (/login, /register, / protected)
└── main.jsx                                    # wrapped in <BrowserRouter>
```

## The architecture, briefly

- **`AuthStrategy`** (Bucket 1 — credential): `authenticate(credentials) -> User`.
  `PasswordStrategy` is the only implementation today. Adding Google OAuth or a
  passkey later means writing one new class here — nothing else changes.
- **`SessionIssuer`** (Bucket 3 — session mechanism, independent of Bucket 1):
  `issue(user, response)` / `revoke(session_id, response)`. `CookieSessionIssuer`
  is the only implementation today (server-side session row + `HttpOnly` cookie).
  A `JwtSessionIssuer` slots in later (Phase E) without touching any strategy.
- **`auth/registry.py`** is the one place that knows every concrete class and
  builds the one selected by config (`AUTH_ENABLED_STRATEGIES`, `AUTH_SESSION_MODE`)
  — the Factory half of the Strategy+Factory pairing.
- **`AuthService`** orchestrates: resolve strategy → authenticate → issue session
  (or, for register: create user → issue session). Routers stay thin HTTP adapters.

## How to run / verify

```bash
# Backend
cd backend
uv run alembic upgrade head              # creates users + user_sessions tables
uv run python scripts/seed_user.py you@example.com "SomePassword123"
uv run uvicorn learnia_backend.main:app --app-dir src --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm run dev
```

Then, in the browser: visiting `/` while logged out redirects to `/login`;
`/register` creates an account and logs you straight in; `/` shows your email
and a logout button; logging out redirects back to `/login`.

Verified via curl through the real Vite proxy during implementation:
register → `Set-Cookie` issued → `/auth/me` returns the user → logout → `/auth/me`
correctly 401s afterward. Wrong password on login returns a generic
"Invalid email or password" (never reveals whether the email exists).

## What I learned

- **Strategy + Factory together**: Strategy defines the interchangeable interface;
  something still has to *pick* which implementation to construct — that's the
  Factory's job (`registry.py`), and they're almost always used as a pair.
- **Two independent axes, not one**: "how identity is proven" (credential) and
  "how the session is remembered" (session mechanism) are genuinely separate
  concerns — combining them into one abstraction would force a strategy explosion
  (password+cookie, password+jwt, oauth+cookie, oauth+jwt...) for no reason.
- **A real SQLite gotcha**: `DateTime(timezone=True)` columns still come back
  *naive* from SQLite (it has no real timezone-aware storage) — comparing that
  against `datetime.now(UTC)` raises `TypeError`. Fixed by standardizing on
  naive-but-actually-UTC timestamps everywhere (`utils/time.py`), documented
  there for when a future Postgres migration makes real tz-aware columns possible.
- **Dependency health matters**: `passlib` (originally planned) is unmaintained
  and currently broken against modern `bcrypt` — a real example of why "the docs
  say to use X" isn't the same as "X still works." Swapped to `pwdlib`.
- **Consistent error shape needs *two* handlers, not one**: `AppError` covers
  errors we raise ourselves, but FastAPI's own Pydantic request validation
  (`RequestValidationError`) has its own default error shape and needed its own
  handler to match — otherwise "every error looks the same" (from
  `02-architecture`) silently wasn't true for validation errors.
- **User enumeration**: returning the same error for "no such email" and "wrong
  password" isn't paranoia — a different message for each lets an attacker build
  a list of valid emails by trying logins.

## Decisions

- **Registration is open** (`POST /auth/register`), not seed-script-only as
  originally planned in this file — reversed per explicit request mid-implementation.
- **Strategy pattern built now**, not deferred to Phase E as the file originally
  suggested — decided together (see the design-pattern discussion this file used
  to contain, now in git history / `CHECKLIST.md`'s summary of it).
- **Cookie-based server sessions**, not JWT, for Phase A — simpler revocation,
  no refresh-token complexity; JWT arrives in Phase E specifically to contrast.
- **Registration enforces a minimum password length that login does not** — so a
  rule change never locks out an account created before the rule existed.

## Not implemented yet

Everything in Phases B–I of `CHECKLIST.md`: rate limiting/lockout/audit log (B),
MFA (C), RBAC (D), JWT as an alternate mode (E), OAuth/OIDC (F), Keycloak lab (G),
passkeys (H), full security-lab pass (I). See that file for the reasoning behind
the ordering.
