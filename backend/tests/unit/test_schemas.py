import pytest
from pydantic import ValidationError

from learnia_backend.schemas.auth import PasswordLoginRequest, RegisterRequest


def test_register_rejects_short_password():
    with pytest.raises(ValidationError):
        RegisterRequest(email="a@b.com", password="short")


def test_register_accepts_8_char_password():
    assert RegisterRequest(email="a@b.com", password="12345678").password == "12345678"


def test_register_rejects_bad_email():
    with pytest.raises(ValidationError):
        RegisterRequest(email="not-an-email", password="12345678")


def test_login_does_not_enforce_min_length():
    # Old accounts with shorter passwords must still be able to log in.
    assert PasswordLoginRequest(email="a@b.com", password="abc").password == "abc"
