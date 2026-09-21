"""
Factory: builds the AuthStrategy/SessionIssuer instances selected by config.

This is the ONE place that knows about every concrete strategy/issuer class.
Adding a new login option later = write the class, add one line to
_STRATEGY_CLASSES, add its id to AUTH_ENABLED_STRATEGIES in .env. Nothing
else in the app changes.
"""

from sqlalchemy.orm import Session as DbSession

from learnia_backend.auth.session_issuers.base import SessionIssuer
from learnia_backend.auth.session_issuers.cookie import CookieSessionIssuer
from learnia_backend.auth.strategies.base import AuthStrategy
from learnia_backend.auth.strategies.password import PasswordStrategy
from learnia_backend.config import settings
from learnia_backend.exceptions import NotFoundError
from learnia_backend.repositories.session_repository import SessionRepository
from learnia_backend.repositories.user_repository import UserRepository

_STRATEGY_CLASSES: dict[str, type[AuthStrategy]] = {
    "password": PasswordStrategy,
}

_SESSION_ISSUER_CLASSES: dict[str, type[SessionIssuer]] = {
    "cookie_session": CookieSessionIssuer,
    # "jwt": JwtSessionIssuer,  # added in Phase E
}


def get_strategy(strategy_id: str, db: DbSession) -> AuthStrategy:
    if strategy_id not in settings.auth_enabled_strategies:
        # Not just "not implemented" — deliberately disabled by config, so a
        # 404 (not 400) is correct: as far as the API is concerned, this
        # login option doesn't exist right now.
        raise NotFoundError(f"Login option '{strategy_id}' is not enabled")

    strategy_class = _STRATEGY_CLASSES.get(strategy_id)
    if strategy_class is None:
        raise NotFoundError(f"Unknown login option '{strategy_id}'")

    # Every current strategy takes a UserRepository; once a strategy needs
    # different dependencies (e.g. GoogleOAuthStrategy needing an HTTP
    # client), this becomes a per-class construction branch.
    return strategy_class(UserRepository(db))


def get_session_issuer(db: DbSession) -> SessionIssuer:
    issuer_class = _SESSION_ISSUER_CLASSES[settings.auth_session_mode]
    return issuer_class(SessionRepository(db))
