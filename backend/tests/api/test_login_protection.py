from datetime import timedelta

from learnia_backend.config import settings
from learnia_backend.models.audit_event import AuditEvent
from learnia_backend.utils.time import utc_now_naive

CREDS = {"email": "a@b.com", "password": "password123"}
BAD = {"email": "a@b.com", "password": "wrongpassword"}
LOGIN = "/api/v1/auth/login/password"


def _fail(client, n, email="a@b.com"):
    for _ in range(n):
        client.post(LOGIN, json={"email": email, "password": "wrongpassword"})


def _events(db, event_type):
    return db.query(AuditEvent).filter(AuditEvent.event_type == event_type).count()


def test_account_is_locked_after_max_failures(client):
    client.post("/api/v1/auth/register", json=CREDS)
    client.cookies.clear()
    _fail(client, settings.login_max_failed_attempts)

    res = client.post(LOGIN, json=CREDS)  # even the CORRECT password is refused
    assert res.status_code == 429
    assert res.json()["error"]["code"] == "TOO_MANY_REQUESTS"


def test_unknown_email_is_locked_too_so_lockout_does_not_leak_accounts(client):
    _fail(client, settings.login_max_failed_attempts, email="ghost@b.com")
    res = client.post(LOGIN, json={"email": "ghost@b.com", "password": "whatever123"})
    assert res.status_code == 429


def test_failures_below_the_limit_do_not_lock(client):
    client.post("/api/v1/auth/register", json=CREDS)
    client.cookies.clear()
    _fail(client, settings.login_max_failed_attempts - 1)
    assert client.post(LOGIN, json=CREDS).status_code == 200


def test_successful_login_resets_the_failure_count(client):
    client.post("/api/v1/auth/register", json=CREDS)
    client.cookies.clear()
    _fail(client, settings.login_max_failed_attempts - 1)
    assert client.post(LOGIN, json=CREDS).status_code == 200
    _fail(client, settings.login_max_failed_attempts - 1)
    assert client.post(LOGIN, json=CREDS).status_code == 200


def test_old_failures_age_out_of_the_window(client, db):
    client.post("/api/v1/auth/register", json=CREDS)
    client.cookies.clear()
    _fail(client, settings.login_max_failed_attempts)
    old = utc_now_naive() - timedelta(minutes=settings.login_lockout_minutes + 1)
    for event in db.query(AuditEvent).filter(AuditEvent.event_type == "login_failure"):
        event.created_at = old
    db.commit()
    assert client.post(LOGIN, json=CREDS).status_code == 200


def test_per_ip_rate_limit_blocks_many_different_emails(client, monkeypatch):
    monkeypatch.setattr(settings, "login_max_failed_per_ip", 3)
    for i in range(3):
        _fail(client, 1, email=f"user{i}@b.com")
    res = client.post(LOGIN, json={"email": "fresh@b.com", "password": "password123"})
    assert res.status_code == 429


def test_audit_log_records_events(client, db):
    client.post("/api/v1/auth/register", json=CREDS)
    client.post("/api/v1/auth/logout")
    client.post(LOGIN, json=BAD)
    client.post(LOGIN, json=CREDS)
    assert _events(db, "register") == 1
    assert _events(db, "logout") == 1
    assert _events(db, "login_failure") == 1
    assert _events(db, "login_success") == 1


def test_blocked_attempts_are_audited(client, db):
    _fail(client, settings.login_max_failed_attempts)
    client.post(LOGIN, json=BAD)
    assert _events(db, "login_blocked") == 1


def test_audit_log_never_stores_passwords(client, db):
    client.post(LOGIN, json=BAD)
    columns = AuditEvent.__table__.columns.keys()
    assert not any("password" in c for c in columns)
