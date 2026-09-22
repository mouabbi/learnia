from datetime import timedelta

from learnia_backend.config import settings
from learnia_backend.models.session import UserSession
from learnia_backend.utils.time import utc_now_naive

CREDS = {"email": "a@b.com", "password": "password123"}
COOKIE = settings.session_cookie_name


def test_register_creates_user_and_logs_in(client):
    res = client.post("/api/v1/auth/register", json=CREDS)
    assert res.status_code == 201
    assert res.json()["email"] == "a@b.com"
    assert "hashed_password" not in res.json()
    assert COOKIE in res.cookies
    assert client.get("/api/v1/auth/me").status_code == 200


def test_register_duplicate_email_is_422(client):
    client.post("/api/v1/auth/register", json=CREDS)
    res = client.post("/api/v1/auth/register", json=CREDS)
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"


def test_register_short_password_uses_consistent_error_shape(client):
    res = client.post("/api/v1/auth/register", json={"email": "a@b.com", "password": "short"})
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"


def test_login_success_sets_httponly_cookie(client):
    client.post("/api/v1/auth/register", json=CREDS)
    client.cookies.clear()
    res = client.post("/api/v1/auth/login/password", json=CREDS)
    assert res.status_code == 200
    assert "httponly" in res.headers["set-cookie"].lower()
    assert client.get("/api/v1/auth/me").json()["email"] == "a@b.com"


def test_login_wrong_password_is_401(client):
    client.post("/api/v1/auth/register", json=CREDS)
    client.cookies.clear()
    res = client.post("/api/v1/auth/login/password", json={**CREDS, "password": "wrongpassword"})
    assert res.status_code == 401
    assert res.json()["error"]["message"] == "Invalid email or password"


def test_login_unknown_email_gets_same_error(client):
    res = client.post("/api/v1/auth/login/password", json=CREDS)
    assert res.status_code == 401
    assert res.json()["error"]["message"] == "Invalid email or password"


def test_me_without_cookie_is_401(client):
    assert client.get("/api/v1/auth/me").status_code == 401


def test_me_with_garbage_cookie_is_401(client):
    client.cookies.set(COOKIE, "garbage")
    assert client.get("/api/v1/auth/me").status_code == 401


def test_expired_session_is_401(client, db):
    client.post("/api/v1/auth/register", json=CREDS)
    session = db.query(UserSession).one()
    session.expires_at = utc_now_naive() - timedelta(minutes=1)
    db.commit()
    assert client.get("/api/v1/auth/me").status_code == 401


def test_logout_invalidates_session(client, db):
    client.post("/api/v1/auth/register", json=CREDS)
    assert client.post("/api/v1/auth/logout").status_code == 204
    assert db.query(UserSession).count() == 0
    assert client.get("/api/v1/auth/me").status_code == 401


def test_logout_without_session_is_fine(client):
    assert client.post("/api/v1/auth/logout").status_code == 204
