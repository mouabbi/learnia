from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings, loaded from environment variables / .env file."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Learnia API"
    environment: str = "development"
    cors_origins: list[str] = ["http://localhost:5173"]

    database_url: str = "sqlite:///./learnia.db"

    # Which AuthStrategy ids are active (see auth/registry.py). Comma-separated
    # in .env, e.g. "password,google_oauth" once more strategies exist.
    auth_enabled_strategies: list[str] = ["password"]

    # Global session mechanism, shared by every enabled strategy (see
    # auth/session_issuers/ — this is the "Bucket 3" axis, kept independent
    # of *how* identity was proven).
    auth_session_mode: str = "cookie_session"  # cookie_session | jwt (jwt not built yet)

    # How long a session stays valid without renewal.
    session_ttl_minutes: int = 60 * 24 * 7  # 7 days

    # Name of the cookie holding the session id.
    session_cookie_name: str = "learnia_session"

    # --- Login protection (see services/login_guard.py) ---
    # Lockout: this many failed logins for one email inside the window locks
    # that email out (for every caller) until old failures age out of it.
    login_max_failed_attempts: int = 5
    login_lockout_minutes: int = 15
    # Rate limit: this many failed logins from one IP inside the same window.
    login_max_failed_per_ip: int = 20

    # --- One-time tokens (password reset / email verification) ---
    password_reset_ttl_minutes: int = 30
    email_verification_ttl_minutes: int = 60 * 24

    # --- Email (see mail/) ---
    # console = print the email in the log (dev, no account needed)
    # smtp    = send it for real through an SMTP server (Gmail, Brevo, ...)
    email_backend: str = "console"  # console | smtp
    email_from: str = "Learnia <no-reply@localhost>"
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587  # 587 = STARTTLS
    smtp_username: str = ""
    smtp_password: str = ""  # Gmail: an "app password", never your real password
    # Base URL of the frontend, used to build the links inside emails.
    frontend_base_url: str = "http://localhost:5173"

    # --- MFA (TOTP, see mfa/) ---
    # Fernet key encrypting stored TOTP secrets at rest (security/encryption.py).
    # THIS DEFAULT IS FOR LOCAL DEV ONLY — generate your own for any real
    # deployment: `python -c "from cryptography.fernet import Fernet;
    # print(Fernet.generate_key().decode())"` and set it via .env, never commit it.
    mfa_encryption_key: str = "t814kcFy-rwFY8sFcldjdMJGTcY2vh--9mfqJv9od4c="
    mfa_issuer: str = "Learnia"
    mfa_recovery_codes_count: int = 8
    # How long a completed-password / pending-TOTP login stays valid.
    mfa_login_ticket_ttl_minutes: int = 5


settings = Settings()
