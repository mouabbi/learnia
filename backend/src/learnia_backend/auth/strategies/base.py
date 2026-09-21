"""
AuthStrategy — the "login option" abstraction (Bucket 1: credential type).

Contract, deliberately narrow: given whatever raw credentials this strategy
understands, either return the identified User or raise AuthenticationFailed.
A strategy knows NOTHING about sessions/cookies/JWTs — that's a separate
concern (see auth/session_issuers/). This is what makes it possible to add
GoogleOAuthStrategy or PasskeyStrategy later without touching session code.
"""

from abc import ABC, abstractmethod
from typing import Any

from learnia_backend.models.user import User


class AuthenticationFailed(Exception):
    """Raised by a strategy when credentials don't identify a valid user."""


class AuthStrategy(ABC):
    #: Unique id used in the URL and in AUTH_ENABLED_STRATEGIES config,
    #: e.g. "password", later "google_oauth", "passkey".
    strategy_id: str

    @abstractmethod
    def authenticate(self, credentials: dict[str, Any]) -> User:
        """
        `credentials` is intentionally untyped (dict) at this level, because
        each strategy expects a different shape (email+password vs. an OAuth
        code vs. a WebAuthn assertion). Each concrete strategy validates its
        own shape via its own Pydantic request schema before calling this.
        """
        raise NotImplementedError
