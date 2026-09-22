import pytest

from learnia_backend.auth.strategies.base import AuthenticationFailed
from learnia_backend.auth.strategies.password import PasswordStrategy
from learnia_backend.repositories.user_repository import UserRepository
from learnia_backend.security.passwords import hash_password


@pytest.fixture
def strategy(db):
    repo = UserRepository(db)
    repo.create(email="a@b.com", hashed_password=hash_password("password123"))
    return PasswordStrategy(repo)


def test_valid_credentials_return_user(strategy):
    user = strategy.authenticate({"email": "a@b.com", "password": "password123"})
    assert user.email == "a@b.com"


def test_wrong_password_fails(strategy):
    with pytest.raises(AuthenticationFailed):
        strategy.authenticate({"email": "a@b.com", "password": "nope"})


def test_unknown_email_gives_same_message_as_wrong_password(strategy):
    # Same message for both = no user enumeration.
    with pytest.raises(AuthenticationFailed) as unknown:
        strategy.authenticate({"email": "x@b.com", "password": "password123"})
    with pytest.raises(AuthenticationFailed) as wrong:
        strategy.authenticate({"email": "a@b.com", "password": "nope"})
    assert str(unknown.value) == str(wrong.value)
