import pyotp

from learnia_backend.config import settings

CREDS = {"email": "a@b.com", "password": "password123"}
API = "/api/v1/auth"


def _register_and_enable_mfa(client):
    """Register, enroll, confirm — returns (secret, recovery_codes)."""
    client.post(f"{API}/register", json=CREDS)
    enroll = client.post(f"{API}/mfa/enroll").json()
    code = pyotp.TOTP(enroll["secret"]).now()
    confirm = client.post(f"{API}/mfa/enroll/confirm", json={"code": code})
    return enroll["secret"], confirm.json()["recovery_codes"]


# --- status / enroll / confirm / disable ---


def test_status_starts_disabled(client):
    client.post(f"{API}/register", json=CREDS)
    assert client.get(f"{API}/mfa/status").json() == {"enabled": False}


def test_enroll_requires_login(client):
    assert client.post(f"{API}/mfa/enroll").status_code == 401


def test_enroll_returns_secret_uri_and_qr_code(client):
    client.post(f"{API}/register", json=CREDS)
    res = client.post(f"{API}/mfa/enroll")
    assert res.status_code == 200
    body = res.json()
    assert body["secret"]
    assert body["otpauth_uri"].startswith("otpauth://totp/")
    assert body["qr_code_data_uri"].startswith("data:image/png;base64,")


def test_enroll_alone_does_not_enable_mfa(client):
    client.post(f"{API}/register", json=CREDS)
    client.post(f"{API}/mfa/enroll")
    assert client.get(f"{API}/mfa/status").json()["enabled"] is False


def test_confirm_with_correct_code_enables_mfa(client):
    _register_and_enable_mfa(client)
    assert client.get(f"{API}/mfa/status").json()["enabled"] is True


def test_confirm_with_wrong_code_is_422(client):
    client.post(f"{API}/register", json=CREDS)
    client.post(f"{API}/mfa/enroll")
    res = client.post(f"{API}/mfa/enroll/confirm", json={"code": "000000"})
    assert res.status_code == 422
    assert client.get(f"{API}/mfa/status").json()["enabled"] is False


def test_disable_requires_correct_password(client):
    _register_and_enable_mfa(client)
    res = client.post(f"{API}/mfa/disable", json={"current_password": "wrong-password"})
    assert res.status_code == 401
    assert client.get(f"{API}/mfa/status").json()["enabled"] is True


def test_disable_turns_mfa_off(client):
    _register_and_enable_mfa(client)
    res = client.post(f"{API}/mfa/disable", json={"current_password": "password123"})
    assert res.status_code == 204
    assert client.get(f"{API}/mfa/status").json()["enabled"] is False


# --- login with MFA enabled ---


def test_login_without_mfa_is_a_single_step(client):
    client.post(f"{API}/register", json=CREDS)
    client.cookies.clear()
    res = client.post(f"{API}/login/password", json=CREDS)
    assert res.json() == {"mfa_required": False, "user": res.json()["user"], "mfa_ticket": None}
    assert client.get(f"{API}/me").status_code == 200


def test_login_with_mfa_enabled_returns_a_ticket_and_no_session(client):
    _register_and_enable_mfa(client)
    client.cookies.clear()

    res = client.post(f"{API}/login/password", json=CREDS)
    body = res.json()
    assert body["mfa_required"] is True
    assert body["mfa_ticket"]
    assert body["user"] is None
    assert "learnia_session" not in res.cookies
    assert client.get(f"{API}/me").status_code == 401  # not logged in yet


def test_login_mfa_step_with_correct_totp_code_logs_in(client):
    secret, _ = _register_and_enable_mfa(client)
    client.cookies.clear()
    ticket = client.post(f"{API}/login/password", json=CREDS).json()["mfa_ticket"]

    res = client.post(
        f"{API}/login/mfa", json={"mfa_ticket": ticket, "code": pyotp.TOTP(secret).now()}
    )
    assert res.status_code == 200
    assert res.json()["email"] == "a@b.com"
    assert client.get(f"{API}/me").status_code == 200


def test_login_mfa_step_with_wrong_code_is_401(client):
    _register_and_enable_mfa(client)
    client.cookies.clear()
    ticket = client.post(f"{API}/login/password", json=CREDS).json()["mfa_ticket"]

    res = client.post(f"{API}/login/mfa", json={"mfa_ticket": ticket, "code": "000000"})
    assert res.status_code == 401
    assert client.get(f"{API}/me").status_code == 401


def test_login_mfa_step_with_recovery_code_logs_in_once(client):
    _, recovery_codes = _register_and_enable_mfa(client)
    client.cookies.clear()
    ticket = client.post(f"{API}/login/password", json=CREDS).json()["mfa_ticket"]

    res = client.post(f"{API}/login/mfa", json={"mfa_ticket": ticket, "code": recovery_codes[0]})
    assert res.status_code == 200

    # Same recovery code cannot be reused on a second login.
    client.cookies.clear()
    ticket2 = client.post(f"{API}/login/password", json=CREDS).json()["mfa_ticket"]
    res2 = client.post(f"{API}/login/mfa", json={"mfa_ticket": ticket2, "code": recovery_codes[0]})
    assert res2.status_code == 401


def test_mfa_ticket_is_single_use(client):
    secret, _ = _register_and_enable_mfa(client)
    client.cookies.clear()
    ticket = client.post(f"{API}/login/password", json=CREDS).json()["mfa_ticket"]
    code = pyotp.TOTP(secret).now()

    assert (
        client.post(f"{API}/login/mfa", json={"mfa_ticket": ticket, "code": code}).status_code
        == 200
    )
    client.cookies.clear()
    # Same ticket again, even with a fresh valid code, must fail.
    res = client.post(
        f"{API}/login/mfa", json={"mfa_ticket": ticket, "code": pyotp.TOTP(secret).now()}
    )
    assert res.status_code == 401


def test_unknown_mfa_ticket_is_401(client):
    res = client.post(f"{API}/login/mfa", json={"mfa_ticket": "garbage", "code": "123456"})
    assert res.status_code == 401


def test_disabling_mfa_makes_login_single_step_again(client):
    _register_and_enable_mfa(client)
    client.post(f"{API}/mfa/disable", json={"current_password": "password123"})
    client.cookies.clear()

    res = client.post(f"{API}/login/password", json=CREDS)
    assert res.json()["mfa_required"] is False
    assert client.get(f"{API}/me").status_code == 200


def test_login_lockout_still_applies_before_mfa_is_reached(client):
    _register_and_enable_mfa(client)
    client.cookies.clear()
    for _ in range(settings.login_max_failed_attempts):
        client.post(f"{API}/login/password", json={**CREDS, "password": "wrongpassword"})

    res = client.post(f"{API}/login/password", json=CREDS)  # correct password, but locked
    assert res.status_code == 429
