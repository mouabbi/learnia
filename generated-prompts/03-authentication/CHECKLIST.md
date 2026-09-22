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

## Phase B — Production-grade hardening on top of Phase A ✅
See `03-authentication-phase-b-completed.md`.
- [x] Rate limiting on `/auth/login` (per-IP and/or per-account)
- [x] Account lockout after N failed attempts
- [x] Security/audit event log (login success, login failure, lockout, logout)
- [x] Password reset flow (email via swappable `EmailSender`: console dev sender + free SMTP)
- [x] Email verification (same `EmailSender`)
- [x] Password change endpoint (while logged in)
- [x] Timing-attack review on login (constant-time comparison, no user-enumeration via error messages)

## Phase C — MFA (TOTP) ✅
See `03-authentication-phase-c-completed.md`.
- [x] `mfa_secrets` table (per user, encrypted secret)
- [x] TOTP enrollment endpoint (generate secret + QR code)
- [x] TOTP challenge step in the login flow (login pipeline becomes multi-step —
      kept as a plain conditional in AuthService rather than a full Chain of
      Responsibility refactor; see completion note)
- [x] Recovery codes (generate on enrollment, single-use, invalidate on use)
- [x] Disable/reset MFA endpoint
- [x] Frontend: MFA enrollment UI (QR code display)
- [x] Frontend: MFA challenge step in login form

## Roadmap revision (post-Phase-C)

Decision: don't treat every auth technology (OAuth, OIDC, TOTP, WebAuthn, JWT,
Google, Facebook, Keycloak...) as its own bolted-on system. Keep building one
authentication domain around four independent axes, each swappable via its own
interface:

- **Credential strategy** — *how the user proves who they are*: password, OIDC
  (per-provider), WebAuthn/passkey. (`AuthStrategy`, already scaffolded in
  Phase A — currently one impl: password.)
- **MFA method** — *extra proof after the primary credential*: TOTP, WebAuthn
  security key, recovery code (recovery is emergency-access, not itself an MFA
  factor). (Currently: TOTP + recovery codes, already built in Phase C, driven
  through a real MFA-pending ticket state — `AuthService.login()` →
  `mfa_ticket` → `complete_mfa_login()` — not an inline conditional.)
- **Session mechanism** — *how the app remembers you're authenticated after*:
  cookie session (built) or JWT + refresh (Phase E). (`SessionIssuer`, already
  scaffolded in Phase A.)
- **Identity provider** — *who vouches for the user externally*: Google,
  Microsoft, Facebook, generic OIDC, Keycloak. (Not started — new concept,
  arrives in Phase F onward via an `IdentityProvider` adapter interface.)

Authorization (RBAC) is a fifth, separate concern layered on top once a user
is authenticated, regardless of which credential/MFA/session combo got them
there.

New phase order (D was RBAC; still is — inserted before JWT/OAuth per the
original ordering note, since D only depends on sessions existing (A), not on
JWT or OIDC):

```
A  Password + cookie sessions              done
B  Hardening                                done
C  MFA (TOTP + recovery codes)              done
D  RBAC / Authorization                     next
E  JWT as an alternate session mechanism
F  OAuth 2.0 fundamentals (no provider yet)
G  OIDC + Google
H  Microsoft / Facebook OIDC (see provider differences firsthand)
I  Generic OIDC provider abstraction (IdentityProvider interface)
J  WebAuthn / Passkeys (new MFA method + new credential strategy)
K  MFA expansion / authentication policy (mfa_required, allowed methods, per-account config)
L  Self-hosted Keycloak (lab/side-quest — app becomes an OIDC client instead of an IdP)
M  Admin/runtime authentication policy (move policy out of .env into DB-backed settings)
N  Security lab pass
O  Final authentication scenario/test matrix (password+cookie, password+TOTP+JWT,
   passkey+cookie, Google+TOTP, Keycloak+cookie, etc. — see design discussion)
```

## Phase D — Authorization (RBAC)
- [ ] `roles` concept on the user model (even with one user, one role)
- [ ] Permission set per role (e.g. `course:read`, `course:write`, `course:delete`)
- [ ] `require_permission(...)` FastAPI dependency, composable with `get_current_user`
- [ ] At least one endpoint demonstrating a permission check
- [ ] Frontend: conditionally render/hide actions based on permissions

## Phase E — JWT as an alternate session mechanism
- [ ] `SessionStrategy`/`SessionIssuer` interface confirmed sufficient (already
      exists from Phase A; retrofit if needed)
- [ ] `JwtSessionIssuer` implementation (access token, signature algorithm
      decided: HS256 vs RS256)
- [ ] Refresh token + rotation
- [ ] Revocation strategy documented (denylist or short-lived-access-token approach — pick one)
- [ ] Config switch (`AUTH_SESSION_MODE=cookie_session|jwt`) wired to the
      existing registry/factory selecting the strategy
- [ ] Side-by-side comparison notes: what broke/got harder with JWT vs. cookie sessions

## Phase F — OAuth 2.0 fundamentals
- [ ] Small OAuth-only exercise (authorization code + PKCE, no OIDC/identity
      yet) to learn the delegated-authorization model before layering identity
      on top
- [ ] Authorization Code + PKCE flow implemented end-to-end against one provider
- [ ] `state` param CSRF protection, exact redirect-URI matching

## Phase G — OIDC + Google ("Login with Google")
- [ ] Register an OAuth app with Google
- [ ] ID token validation (signature, issuer, audience, nonce) — distinct from
      the OAuth access token from Phase F
- [ ] `CredentialStrategy` impl for OIDC (fits the existing `AuthStrategy`
      registry from Phase A)
- [ ] Account linking story (external identity → local user record)
- [ ] Frontend: "Login with Google" button + callback handling
- [ ] Scenario test: Google OIDC → MFA (TOTP) still required → cookie session

## Phase H — Additional OIDC providers (Microsoft, Facebook)
- [ ] Microsoft OIDC — note what differs from Google's flow/claims
- [ ] Facebook — note where it diverges from standard OIDC
- [ ] Frontend: additional provider buttons

## Phase I — Generic OIDC provider abstraction
- [ ] `IdentityProvider` adapter interface (`get_authorization_url`,
      `exchange_code`, `validate_identity`, `get_user_identity`) so Google/
      Microsoft/Facebook/Keycloak/any OIDC server fit the same shape
- [ ] Config-driven generic OIDC provider (issuer, client_id, client_secret,
      redirect_uri, scopes) — no provider-specific code required
- [ ] Refactor Phase G/H providers onto the interface if they predate it

## Phase J — WebAuthn / Passkeys
- [ ] Registration ceremony (public key generated + stored, private key never
      leaves the authenticator)
- [ ] Authentication ceremony (challenge/response, signature verification)
- [ ] Platform authenticator tested (Windows Hello, given this is a Windows dev machine)
- [ ] Fallback path if passkey unavailable
- [ ] Wire in as both a credential strategy (passwordless login) and an MFA
      method (step-up after password)

## Phase K — MFA expansion + authentication policy
- [ ] `AuthenticationPolicy` concept (mfa_required, allowed_auth_methods,
      allowed_mfa_methods, session_mode) — replaces scattered config checks
- [ ] Step-up authentication for sensitive operations (change password,
      disable MFA, add passkey, delete account) even with an existing session
- [ ] Optional educational MFA factors (email OTP and/or SMS OTP) — explicitly
      weaker, built to study the tradeoff, not as the primary design
- [ ] Security settings page groups login methods vs. MFA methods vs. sessions

## Phase L — Self-hosted Keycloak (lab/side-quest)
- [ ] Keycloak running locally (Docker) — *depends on Phase 3 (containerization) tooling existing*
- [ ] Realm + client configured in Keycloak
- [ ] App reconfigured as an OIDC client of Keycloak instead of Google, reusing
      the Phase I `IdentityProvider` interface
- [ ] SSO behavior demonstrated (if a second toy app/route is added to prove it)
- [ ] Written comparison: what Keycloak gave you for free vs. what Phases A–K built manually

## Phase M — Admin / runtime authentication policy
- [ ] Split config: `.env` keeps deployment secrets/capabilities
      (`GOOGLE_CLIENT_ID`, `KEYCLOAK_ENABLED`, ...); a DB-backed
      `system_settings`-style table holds runtime policy (mfa_required,
      allowed methods, password policy, session TTL)
- [ ] Admin UI (or at least an endpoint) to change runtime policy without a
      redeploy

## Phase N — Security lab pass
- [ ] CSRF review (needed if any cookie-based state-changing request lacks CSRF protection)
- [ ] XSS review (frontend — are user-supplied strings ever rendered unescaped?)
- [ ] CORS configuration reviewed against production origins (not just `*`/dev)
- [ ] Session fixation check (session id rotates on login, not reused)
- [ ] Session hijacking discussion (cookie theft scenarios, mitigations already in place)
- [ ] Security headers reviewed (`Content-Security-Policy`, `X-Frame-Options`, etc.)
- [ ] Audit log coverage reviewed end-to-end across all phases built so far

## Phase O — Final authentication scenario/test matrix
- [ ] Enumerate and test the credential × MFA × session combinations from the
      design discussion (password+cookie, password+TOTP+JWT, passkey+cookie,
      passkey+JWT, Google+cookie, Google+TOTP+cookie, Keycloak+cookie,
      Keycloak-managed-MFA+cookie, password+recovery-code+cookie, ...)
- [ ] Each scenario has an automated test asserting the expected end state

---

## Notes
- Phases A–D are the permanent app. E onward are explicit learning labs (E, G,
  J also ship as real features; F, H, I, L, M are comparison/abstraction
  exercises).
- Don't start a phase's boxes until the previous phase's boxes for the *permanent*
  track (A→D) are checked — E onward can be reordered if you get curious out of
  sequence, but A→D should stay in order since D depends on sessions existing (A)
  and rate limiting/lockout (B) is cheap to have before adding more surface area (C).
- Credential strategy, MFA method, session mechanism, and identity provider are
  kept as four separate axes (not one grab-bag `AuthStrategy`) specifically so
  OAuth/OIDC/WebAuthn/JWT/Keycloak don't each require a parallel, disconnected
  auth system — see design discussion for the full rationale and diagrams.
