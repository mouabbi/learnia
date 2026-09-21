"""
SessionIssuer — the "how do we remember you're logged in" abstraction
(Bucket 3). Independent of AuthStrategy: every enabled strategy, once it has
identified a user, hands that user to the SAME issuer (chosen once, globally,
via AUTH_SESSION_MODE) rather than each strategy managing sessions itself.
"""

from abc import ABC, abstractmethod

from fastapi import Response

from learnia_backend.models.user import User


class SessionIssuer(ABC):
    @abstractmethod
    def issue(self, user: User, response: Response) -> None:
        """Create a session for `user` and attach it to the HTTP response
        (e.g. set a cookie). Nothing is returned — the response is mutated
        in place, which matches how FastAPI expects cookies to be set."""
        raise NotImplementedError

    @abstractmethod
    def revoke(self, request_session_id: str | None, response: Response) -> None:
        """Invalidate the current session (logout) and clear it client-side."""
        raise NotImplementedError
