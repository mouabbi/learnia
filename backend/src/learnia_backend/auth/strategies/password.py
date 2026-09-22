from typing import Any

from learnia_backend.auth.strategies.base import AuthenticationFailed, AuthStrategy
from learnia_backend.models.user import User
from learnia_backend.repositories.user_repository import UserRepository
from learnia_backend.security.passwords import DUMMY_HASH, verify_password


class PasswordStrategy(AuthStrategy):
    strategy_id = "password"

    def __init__(self, user_repository: UserRepository) -> None:
        self.user_repository = user_repository

    def authenticate(self, credentials: dict[str, Any]) -> User:
        email = credentials["email"]
        password = credentials["password"]

        user = self.user_repository.get_by_email(email)

        # Timing-attack defence: an unknown email must cost the same time as a
        # wrong password. Without this, "no such user" returns instantly while
        # a real user pays for a slow bcrypt check, so response time alone would
        # reveal which emails are registered.
        if user is None:
            verify_password(password, DUMMY_HASH)
            raise AuthenticationFailed("Invalid email or password")

        # Deliberately identical error for "no such email" and "wrong
        # password" — a different message for each would let an attacker
        # discover which registered emails exist (user enumeration).
        if not verify_password(password, user.hashed_password):
            raise AuthenticationFailed("Invalid email or password")

        return user
