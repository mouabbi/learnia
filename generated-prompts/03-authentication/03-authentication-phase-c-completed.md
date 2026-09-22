# 03 — Authentication: Phase C [DONE]

MFA (TOTP) on top of Phase A/B. See `CHECKLIST.md` for the full roadmap.

## What was built

MFA is opt-in, enabled **after** login from `/account` — never required at
registration.

- **Enrollment, two steps:** `POST /mfa/enroll` generates a secret (not yet
  active) and returns it as a QR code (`otpauth://` URI, rendered server-side
  as a PNG data URI) plus the raw secret for manual entry. `POST
  /mfa/enroll/confirm` requires one correct code before MFA actually turns
  on — so a bad scan never locks someone out. Confirming also generates 8
  single-use recovery codes, shown once.
- **Login becomes two steps for a protected account:** `POST
  /login/password` now returns `{mfa_required, user, mfa_ticket}`. If
  `mfa_required` is true, no session is issued yet — the caller must then
  call `POST /login/mfa` with the ticket and a TOTP or recovery code.
  The ticket is a single-use, 5-minute token (same `OneTimeToken` machinery
  as password reset). Kept as a plain conditional in `AuthService.login`
  rather than a full Chain-of-Responsibility pipeline — one branch didn't
  earn that abstraction yet.
- **Disable:** `POST /mfa/disable` requires the current password.
- **Secrets encrypted at rest** (Fernet/AES, `security/encryption.py`) —
  unlike a password, a TOTP secret must be read back in plaintext to check
  a code, so it's encrypted, not hashed.
- **Recovery codes stored hashed** (SHA-256), single-use.

## New files

```text
backend/src/learnia_backend/
├── security/encryption.py       # Fernet encrypt/decrypt (MFA_ENCRYPTION_KEY)
├── models/mfa.py                # MfaSecret, MfaRecoveryCode
├── repositories/mfa_repository.py
└── services/mfa_service.py      # enroll / confirm / disable / verify_login_code

frontend/src/
├── pages/MfaChallengePage.jsx   # /mfa-challenge — 2nd login step
└── features/auth/MfaSettings.jsx # used on AccountPage — enable/confirm/disable
```

Router: `GET /mfa/status`, `POST /mfa/enroll`, `POST /mfa/enroll/confirm`,
`POST /mfa/disable`, `POST /login/mfa`.

Migration `bee27b36d0fc` adds `mfa_secrets` and `mfa_recovery_codes`.

## Note on `.env`

`MFA_ENCRYPTION_KEY` ships with a dev-only default in `.env.example` —
generate a real one for any real deployment (command is in the comment
next to it there).

## Tests

100 backend tests (was 66), 47 frontend tests (was 34) — written alongside
this phase and already passing. Going forward, new test-writing is
deferred to `18-testing` rather than done phase-by-phase.

## Not implemented yet

Phases D–I — see `CHECKLIST.md`.
