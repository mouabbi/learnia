from datetime import timedelta

from learnia_backend.repositories.session_repository import SessionRepository
from learnia_backend.repositories.user_repository import UserRepository
from learnia_backend.utils.time import utc_now_naive


def test_create_and_get_user(db):
    repo = UserRepository(db)
    user = repo.create(email="a@b.com", hashed_password="hash")
    assert repo.get_by_id(user.id).email == "a@b.com"
    assert repo.get_by_email("a@b.com").id == user.id


def test_get_unknown_user_returns_none(db):
    repo = UserRepository(db)
    assert repo.get_by_email("nobody@b.com") is None
    assert repo.get_by_id(999) is None


def test_create_session_gets_random_id_and_future_expiry(db):
    user = UserRepository(db).create(email="a@b.com", hashed_password="hash")
    session = SessionRepository(db).create(user_id=user.id)
    assert len(session.id) >= 32
    assert session.expires_at > utc_now_naive() + timedelta(days=1)


def test_delete_session(db):
    user = UserRepository(db).create(email="a@b.com", hashed_password="hash")
    repo = SessionRepository(db)
    session = repo.create(user_id=user.id)
    repo.delete(session.id)
    assert repo.get_by_id(session.id) is None


def test_delete_unknown_session_does_not_raise(db):
    SessionRepository(db).delete("does-not-exist")
