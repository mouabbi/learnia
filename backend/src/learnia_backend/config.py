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


settings = Settings()
