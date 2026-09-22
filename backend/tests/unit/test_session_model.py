from datetime import timedelta

from learnia_backend.models.session import UserSession
from learnia_backend.utils.time import utc_now_naive


def test_session_in_future_is_not_expired():
    session = UserSession(user_id=1, expires_at=utc_now_naive() + timedelta(minutes=5))
    assert session.is_expired() is False


def test_session_in_past_is_expired():
    session = UserSession(user_id=1, expires_at=utc_now_naive() - timedelta(seconds=1))
    assert session.is_expired() is True


def test_new_expiry_is_ttl_minutes_ahead():
    before = utc_now_naive()
    expiry = UserSession.new_expiry(10)
    assert before + timedelta(minutes=10) <= expiry <= utc_now_naive() + timedelta(minutes=10)
