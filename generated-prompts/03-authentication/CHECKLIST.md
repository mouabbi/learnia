# 03 — Authentication: Phase & Concept Checklist

Living tracker for this system. Check items off as they're actually implemented
and verified — not when merely discussed. When a phase's boxes are all checked,
`prompts.md` gets renamed to `03-authentication-completed.md` (or, if phases ship
one at a time, a per-phase completion note gets appended there) with a summary of
what was built, same pattern as `01-project-foundation` and `02-architecture`.

Design pattern decision (see discussion): **Strategy pattern, built now (not
deferred to Phase E)** — `AuthStrategy` (credential) and `SessionIssuer` (session
mechanism) are separate interfaces from day one, each with one real implementation
today, selected via a registry/factory reading config.

---

## Phase A — Baseline: password + server sessions
*The app's permanent, real authentication. Nothing here is a "lab."*

**Backend — done:**
- [x] User model (SQLAlchemy): id, email, hashed_password, created_at
- [x] Alembic migration for `users` table (and `user_sessions`, same migration)
- [x] Password hashing utility — using **pwdlib**, not passlib (passlib is
      unmaintained and broken against current bcrypt; see commit)
- [x] Seed script creating the single initial user (`scripts/seed_user.py`)
- [x] `POST /api/v1/auth/register` — open registration, auto-login on success
      (decision reversed: this app is no longer seed-only single-user; see commit)
- [x] `user_sessions` table/model (session id, user id, created_at, expires_at)
- [x] `POST /api/v1/auth/login/password` — verify credentials, create session, set cookie
- [x] `POST /api/v1/auth/logout` — invalidate session, clear cookie
- [x] `get_current_user` FastAPI dependency (reads session cookie, loads user or 401s)
- [x] Protected route example (`GET /api/v1/auth/me`)
- [x] Secure cookie flags: `HttpOnly`, `SameSite=lax`; `Secure` flag tied to
      `environment == "production"` (no-op locally, enabled at deployment)
- [x] Session expiration (TTL) enforced server-side (`UserSession.is_expired()`)
- [x] Strategy-pattern scaffolding: `AuthStrategy`/`SessionIssuer` interfaces +
      registry/factory, config-driven (`AUTH_ENABLED_STRATEGIES`, `AUTH_SESSION_MODE`)
- [x] First real repository layer (`UserRepository`, `SessionRepository`) per
      the `02-architecture` decision

**Frontend — done:**
- [x] Frontend: login page/form (`pages/LoginPage.jsx`)
- [x] Frontend: register page/form (`pages/RegisterPage.jsx`) — added alongside
      the backend register endpoint above
- [x] Frontend: auth state available app-wide (`features/auth/AuthContext.jsx`, `useAuth()`)
- [x] Frontend: protected route wrapper/redirect to login (`features/auth/ProtectedRoute.jsx`)
- [x] Frontend: logout action wired to the backend endpoint (`HomePage.jsx`)
- [x] Client-side routing added (`react-router-dom`) — didn't exist before this phase

## Phase B — Production-grade hardening on top of Phase A
- [ ] Rate limiting on `/auth/login` (per-IP and/or per-account)
- [ ] Account lockout after N failed attempts
- [ ] Security/audit event log (login success, login failure, lockout, logout)
- [ ] Password reset flow *(needs email sending infra — confirm before starting)*
- [ ] Email verification *(needs email sending infra — confirm before starting)*
- [ ] Password change endpoint (while logged in)
- [ ] Timing-attack review on login (constant-time comparison, no user-enumeration via error messages)

## Phase C — MFA (TOTP)
- [ ] `mfa_secrets` table (per user, encrypted secret)
- [ ] TOTP enrollment endpoint (generate secret + QR code)
- [ ] TOTP challenge step in the login flow (login pipeline becomes multi-step —
      candidate for Chain of Responsibility, see design-pattern discussion)
- [ ] Recovery codes (generate on enrollment, single-use, invalidate on use)
- [ ] Disable/reset MFA endpoint
- [ ] Frontend: MFA enrollment UI (QR code display)
- [ ] Frontend: MFA challenge step in login form

## Phase D — Authorization (RBAC)
- [ ] `roles` concept on the user model (even with one user, one role)
- [ ] Permission set per role (e.g. `course:read`, `course:write`, `course:delete`)
- [ ] `require_permission(...)` FastAPI dependency, composable with `get_current_user`
- [ ] At least one endpoint demonstrating a permission check
- [ ] Frontend: conditionally render/hide actions based on permissions

## Phase E — JWT as an alternate session mechanism
- [ ] `SessionStrategy` interface extracted (retrofit Phase A's cookie session behind it)
- [ ] `JwtStrategy` implementation (access token, signature algorithm decided: HS256 vs RS256)
- [ ] Refresh token + rotation
- [ ] Revocation strategy documented (denylist or short-lived-access-token approach — pick one)
- [ ] Config switch (`AUTH_SESSION_MODE=cookie_session|jwt`) wired to a Factory selecting the strategy
- [ ] Side-by-side comparison notes: what broke/got harder with JWT vs. cookie sessions

## Phase F — OAuth2 + OIDC client ("Login with Google")
- [ ] Register an OAuth app with a real provider (Google)
- [ ] Authorization Code + PKCE flow implemented
- [ ] `IdentityProvider` adapter interface (so a second provider later doesn't require new core logic)
- [ ] ID token validation (signature, issuer, audience, nonce)
- [ ] Account linking story (external identity → local user record)
- [ ] Frontend: "Login with Google" button + callback handling

## Phase G — Self-hosted Keycloak (lab/side-quest)
- [ ] Keycloak running locally (Docker) — *depends on Phase 3 (containerization) tooling existing*
- [ ] Realm + client configured in Keycloak
- [ ] App reconfigured as an OIDC client of Keycloak instead of Google
- [ ] SSO behavior demonstrated (if a second toy app/route is added to prove it)
- [ ] Written comparison: what Keycloak gave you for free vs. what Phases A–F built manually

## Phase H — Passkeys / WebAuthn
- [ ] Registration ceremony (public key generated + stored)
- [ ] Authentication ceremony (challenge/response)
- [ ] Platform authenticator tested (Windows Hello, given this is a Windows dev machine)
- [ ] Fallback path if passkey unavailable

## Phase I — Security lab pass
- [ ] CSRF review (needed if any cookie-based state-changing request lacks CSRF protection)
- [ ] XSS review (frontend — are user-supplied strings ever rendered unescaped?)
- [ ] CORS configuration reviewed against production origins (not just `*`/dev)
- [ ] Session fixation check (session id rotates on login, not reused)
- [ ] Session hijacking discussion (cookie theft scenarios, mitigations already in place)
- [ ] Security headers reviewed (`Content-Security-Policy`, `X-Frame-Options`, etc.)
- [ ] Audit log coverage reviewed end-to-end across all phases built so far

---

## Notes
- Phases A–D are the permanent app. E–H are explicit learning labs (E and F also
  ship as real features; G is a throwaway comparison exercise).
- Don't start a phase's boxes until the previous phase's boxes for the *permanent*
  track (A→D) are checked — E onward can be reordered if you get curious out of
  sequence, but A→D should stay in order since D depends on sessions existing (A)
  and rate limiting/lockout (B) is cheap to have before adding more surface area (C).
