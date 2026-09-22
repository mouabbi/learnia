# 03 — Authentication: Phase B [DONE]

Production-grade hardening on top of Phase A. See `CHECKLIST.md` for the
full roadmap.

## What was built

- **Audit log** (`AuditEvent`): one row per login success/failure/blocked,
  logout, register, password change, password reset, email verification.
- **Account lockout + per-IP rate limit** (`LoginGuard`), computed from the
  audit log — no extra counters, survives restarts. Locks out an email
  even if the account doesn't exist, so lockout itself can't leak which
  emails are registered.
- **Password change** endpoint (logged in) — verifies the current password,
  logs out every *other* session (keeps the one making the change).
- **Password reset** flow — one-time token emailed, single-use, expires,
  resetting logs out every session.
- **Email verification** — sent on register, `users.email_verified_at`,
  a resend endpoint.
- **Timing-attack fix** — an unknown email now runs a dummy bcrypt check
  too, so login response time can't reveal which emails exist.
- **Email sending, two swappable implementations** (`EmailSender`
  interface, same Strategy pattern as `AuthStrategy`):
  - `ConsoleEmailSender` (default) — logs the email, no account needed.
  - `SmtpEmailSender` — real SMTP (`smtplib`), works with a free Gmail
    app password or a free-tier relay (Brevo, Resend...). Chosen via
    `EMAIL_BACKEND=console|smtp` in `.env`.
- One-time tokens (`OneTimeToken`) are stored **hashed** (SHA-256) — the
  raw token exists only in the email.

## New files

```text
backend/src/learnia_backend/
├── mail/
│   ├── base.py            # EmailSender interface
│   ├── console.py         # ConsoleEmailSender
│   ├── smtp.py             # SmtpEmailSender
│   └── __init__.py         # factory (EMAIL_BACKEND config)
├── models/
│   ├── audit_event.py
│   └── one_time_token.py
├── repositories/
│   ├── audit_repository.py
│   └── token_repository.py
└── services/
    ├── login_guard.py       # lockout + rate limit
    └── account_service.py   # change/reset password, verify email
```

Router: 5 new endpoints under `/api/v1/auth/` — `password/change`,
`password/forgot`, `password/reset`, `email/verification/send`,
`email/verify`.

## Frontend

New pages/components, wired to the endpoints above via `authApi.js`:

```text
frontend/src/
├── pages/
│   ├── ForgotPasswordPage.jsx   # /forgot-password — email in, generic confirmation
│   ├── ResetPasswordPage.jsx    # /reset-password?token=... — new password form
│   └── VerifyEmailPage.jsx      # /verify-email?token=... — verifies on load, no form
└── features/auth/
    └── ChangePasswordForm.jsx    # used on HomePage (logged in)
```

`HomePage` now shows a "resend verification email" banner when
`user.email_verified` is false, and renders `ChangePasswordForm`.
`LoginPage` links to `/forgot-password`. The three new routes are public
(reachable logged in or out) in `App.jsx`, since a just-registered user is
logged in but still needs `/verify-email`.

## Tests

66 backend tests (was 30) + 31 frontend tests (was 18). Backend additions
cover lockout/rate-limit boundaries, audit events, the two `EmailSender`
implementations (SMTP mocked, nothing real is ever sent in tests), token
single-use/expiry, and the full change/reset/verify flows. Frontend
additions cover the four new pages/components with `authApi` mocked.

## Not implemented yet

Everything in Phases C–I — see `CHECKLIST.md`.
