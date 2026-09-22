from datetime import timedelta

from learnia_backend.models.one_time_token import OneTimeToken
from learnia_backend.repositories.token_repository import TokenRepository
from learnia_backend.repositories.user_repository import UserRepository
from learnia_backend.utils.time import utc_now_naive


def _user_and_repo(db):
    user = UserRepository(db).create(email="a@b.com", hashed_password="h")
    return user, TokenRepository(db)


def test_token_works_once(db):
    user, repo = _user_and_repo(db)
    raw = repo.create(user_id=user.id, purpose="password_reset", ttl_minutes=10)
    assert repo.consume(raw, "password_reset").user_id == user.id
    assert repo.consume(raw, "password_reset") is None  # already used


def test_database_stores_only_the_hash(db):
    user, repo = _user_and_repo(db)
    raw = repo.create(user_id=user.id, purpose="password_reset", ttl_minutes=10)
    assert db.query(OneTimeToken).one().token_hash != raw


def test_wrong_purpose_is_rejected(db):
    user, repo = _user_and_repo(db)
    raw = repo.create(user_id=user.id, purpose="password_reset", ttl_minutes=10)
    assert repo.consume(raw, "email_verification") is None


def test_expired_token_is_rejected(db):
    user, repo = _user_and_repo(db)
    raw = repo.create(user_id=user.id, purpose="password_reset", ttl_minutes=10)
    db.query(OneTimeToken).one().expires_at = utc_now_naive() - timedelta(seconds=1)
    db.commit()
    assert repo.consume(raw, "password_reset") is None


def test_unknown_token_is_rejected(db):
    _, repo = _user_and_repo(db)
    assert repo.consume("nope", "password_reset") is None
