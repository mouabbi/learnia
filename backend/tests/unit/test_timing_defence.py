from unittest.mock import patch

import pytest

from learnia_backend.auth.strategies.base import AuthenticationFailed
from learnia_backend.auth.strategies.password import PasswordStrategy
from learnia_backend.repositories.user_repository import UserRepository


def test_unknown_email_still_runs_a_password_hash_check(db):
    """Constant-time defence: no-such-user must cost a bcrypt check, like a wrong password."""
    strategy = PasswordStrategy(UserRepository(db))
    with patch("learnia_backend.auth.strategies.password.verify_password") as verify:
        verify.return_value = False
        with pytest.raises(AuthenticationFailed):
            strategy.authenticate({"email": "ghost@b.com", "password": "password123"})
    assert verify.call_count == 1
