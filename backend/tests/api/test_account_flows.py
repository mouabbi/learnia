from learnia_backend.models.audit_event import AuditEvent
from learnia_backend.models.session import UserSession

CREDS = {"email": "a@b.com", "password": "password123"}
API = "/api/v1/auth"


def _register(client):
    client.post(f"{API}/register", json=CREDS)


# --- change password ---


def test_change_password_success_and_new_password_works(client):
    _register(client)
    res = client.post(
        f"{API}/password/change",
        json={"current_password": "password123", "new_password": "newpassword456"},
    )
    assert res.status_code == 204
    client.cookies.clear()
    assert (
        client.post(
            f"{API}/login/password", json={"email": "a@b.com", "password": "newpassword456"}
        ).status_code
        == 200
    )
    assert client.post(f"{API}/login/password", json=CREDS).status_code == 401


def test_change_password_wrong_current_password(client):
    _register(client)
    res = client.post(
        f"{API}/password/change",
        json={"current_password": "wrong-password", "new_password": "newpassword456"},
    )
    assert res.status_code == 401


def test_change_password_requires_login(client):
    res = client.post(
        f"{API}/password/change",
        json={"current_password": "password123", "new_password": "newpassword456"},
    )
    assert res.status_code == 401


def test_change_password_rejects_short_new_password(client):
    _register(client)
    res = client.post(
        f"{API}/password/change",
        json={"current_password": "password123", "new_password": "short"},
    )
    assert res.status_code == 422


def test_change_password_logs_out_other_sessions_but_keeps_current(client, db):
    _register(client)
    client.post(f"{API}/login/password", json=CREDS)  # second session (other "device")
    current = client.cookies.get("learnia_session")
    assert db.query(UserSession).count() == 2

    client.post(
        f"{API}/password/change",
        json={"current_password": "password123", "new_password": "newpassword456"},
    )
    remaining = db.query(UserSession).all()
    assert [s.id for s in remaining] == [current]
    assert client.get(f"{API}/me").status_code == 200


# --- forgot / reset password ---


def test_forgot_password_sends_email_with_link(client, outbox):
    _register(client)
    outbox.sent.clear()
    res = client.post(f"{API}/password/forgot", json={"email": "a@b.com"})
    assert res.status_code == 202
    assert outbox.sent[0]["to"] == "a@b.com"
    assert "/reset-password?token=" in outbox.sent[0]["body"]


def test_forgot_password_unknown_email_looks_identical_and_sends_nothing(client, outbox):
    known = client.post(f"{API}/password/forgot", json={"email": "a@b.com"})
    _register(client)
    outbox.sent.clear()
    unknown = client.post(f"{API}/password/forgot", json={"email": "ghost@b.com"})
    assert unknown.status_code == known.status_code == 202
    assert unknown.json() == known.json()
    assert outbox.sent == []


def test_reset_password_full_flow(client, outbox):
    _register(client)
    client.post(f"{API}/password/forgot", json={"email": "a@b.com"})
    token = outbox.last_token()

    res = client.post(
        f"{API}/password/reset", json={"token": token, "new_password": "brandnewpass1"}
    )
    assert res.status_code == 204
    client.cookies.clear()
    ok = client.post(
        f"{API}/login/password", json={"email": "a@b.com", "password": "brandnewpass1"}
    )
    assert ok.status_code == 200


def test_reset_token_is_single_use(client, outbox):
    _register(client)
    client.post(f"{API}/password/forgot", json={"email": "a@b.com"})
    token = outbox.last_token()
    body = {"token": token, "new_password": "brandnewpass1"}
    assert client.post(f"{API}/password/reset", json=body).status_code == 204
    assert client.post(f"{API}/password/reset", json=body).status_code == 422


def test_reset_with_bad_token_is_422(client):
    res = client.post(
        f"{API}/password/reset", json={"token": "garbage", "new_password": "brandnewpass1"}
    )
    assert res.status_code == 422


def test_reset_logs_out_every_session(client, outbox, db):
    _register(client)
    client.post(f"{API}/password/forgot", json={"email": "a@b.com"})
    client.post(
        f"{API}/password/reset",
        json={"token": outbox.last_token(), "new_password": "brandnewpass1"},
    )
    assert db.query(UserSession).count() == 0


def test_verification_token_cannot_reset_a_password(client, outbox):
    _register(client)  # sends a verification email
    token = outbox.last_token()
    res = client.post(
        f"{API}/password/reset", json={"token": token, "new_password": "brandnewpass1"}
    )
    assert res.status_code == 422


# --- email verification ---


def test_register_sends_verification_email_and_starts_unverified(client, outbox):
    res = client.post(f"{API}/register", json=CREDS)
    assert res.json()["email_verified"] is False
    assert "/verify-email?token=" in outbox.sent[0]["body"]


def test_verify_email_marks_user_verified(client, outbox):
    _register(client)
    res = client.post(f"{API}/email/verify", json={"token": outbox.last_token()})
    assert res.status_code == 204
    assert client.get(f"{API}/me").json()["email_verified"] is True


def test_verify_email_with_bad_token_is_422(client):
    assert client.post(f"{API}/email/verify", json={"token": "garbage"}).status_code == 422


def test_resend_verification_email(client, outbox):
    _register(client)
    outbox.sent.clear()
    assert client.post(f"{API}/email/verification/send").status_code == 204
    assert len(outbox.sent) == 1


def test_resend_verification_requires_login(client):
    assert client.post(f"{API}/email/verification/send").status_code == 401


def test_sensitive_actions_are_audited(client, outbox, db):
    _register(client)
    client.post(f"{API}/email/verify", json={"token": outbox.last_token()})
    client.post(
        f"{API}/password/change",
        json={"current_password": "password123", "new_password": "newpassword456"},
    )
    types = {e.event_type for e in db.query(AuditEvent)}
    assert {"email_verified", "password_changed"} <= types
