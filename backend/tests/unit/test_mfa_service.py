import pyotp
import pytest

from learnia_backend.exceptions import UnauthorizedError, ValidationAppError
from learnia_backend.repositories.user_repository import UserRepository
from learnia_backend.security.passwords import hash_password
from learnia_backend.services.mfa_service import MfaService


@pytest.fixture
def user(db):
    return UserRepository(db).create(email="a@b.com", hashed_password=hash_password("password123"))


def test_not_enabled_before_enrollment(db, user):
    assert MfaService(db).is_enabled(user.id) is False


def test_enrollment_alone_does_not_enable_mfa(db, user):
    MfaService(db).start_enrollment(user)
    assert MfaService(db).is_enabled(user.id) is False


def test_confirm_with_correct_code_enables_mfa_and_returns_recovery_codes(db, user):
    service = MfaService(db)
    enrollment = service.start_enrollment(user)
    code = pyotp.TOTP(enrollment["secret"]).now()

    recovery_codes = service.confirm_enrollment(user, code)

    assert service.is_enabled(user.id) is True
    assert len(recovery_codes) == 8  # settings.mfa_recovery_codes_count
    assert len(set(recovery_codes)) == 8  # all unique


def test_confirm_strips_surrounding_whitespace_from_the_code(db, user):
    service = MfaService(db)
    enrollment = service.start_enrollment(user)
    code = pyotp.TOTP(enrollment["secret"]).now()

    recovery_codes = service.confirm_enrollment(user, f"  {code}\n")

    assert service.is_enabled(user.id) is True
    assert len(recovery_codes) == 8


def test_confirm_with_wrong_code_fails_and_does_not_enable(db, user):
    service = MfaService(db)
    service.start_enrollment(user)
    with pytest.raises(ValidationAppError):
        service.confirm_enrollment(user, "000000")
    assert service.is_enabled(user.id) is False


def test_confirm_without_enrollment_fails(db, user):
    with pytest.raises(ValidationAppError):
        MfaService(db).confirm_enrollment(user, "123456")


def test_verify_login_code_accepts_valid_totp(db, user):
    service = MfaService(db)
    enrollment = service.start_enrollment(user)
    service.confirm_enrollment(user, pyotp.TOTP(enrollment["secret"]).now())

    assert service.verify_login_code(user, pyotp.TOTP(enrollment["secret"]).now()) is True


def test_verify_login_code_rejects_wrong_totp(db, user):
    service = MfaService(db)
    enrollment = service.start_enrollment(user)
    service.confirm_enrollment(user, pyotp.TOTP(enrollment["secret"]).now())

    assert service.verify_login_code(user, "000000") is False


def test_verify_login_code_accepts_recovery_code_once(db, user):
    service = MfaService(db)
    enrollment = service.start_enrollment(user)
    codes = service.confirm_enrollment(user, pyotp.TOTP(enrollment["secret"]).now())

    assert service.verify_login_code(user, codes[0]) is True
    assert service.verify_login_code(user, codes[0]) is False  # single-use


def test_verify_login_code_false_when_mfa_not_enabled(db, user):
    assert MfaService(db).verify_login_code(user, "123456") is False


def test_disable_requires_correct_password(db, user):
    service = MfaService(db)
    enrollment = service.start_enrollment(user)
    service.confirm_enrollment(user, pyotp.TOTP(enrollment["secret"]).now())

    with pytest.raises(UnauthorizedError):
        service.disable(user, "wrong-password")
    assert service.is_enabled(user.id) is True


def test_disable_removes_secret_and_recovery_codes(db, user):
    service = MfaService(db)
    enrollment = service.start_enrollment(user)
    codes = service.confirm_enrollment(user, pyotp.TOTP(enrollment["secret"]).now())

    service.disable(user, "password123")

    assert service.is_enabled(user.id) is False
    assert service.verify_login_code(user, codes[0]) is False


def test_re_enrollment_replaces_the_old_secret(db, user):
    service = MfaService(db)
    first = service.start_enrollment(user)
    service.confirm_enrollment(user, pyotp.TOTP(first["secret"]).now())

    second = service.start_enrollment(user)  # re-enroll before confirming again
    assert first["secret"] != second["secret"]
    # Old secret no longer works once replaced.
    assert service.verify_login_code(user, pyotp.TOTP(first["secret"]).now()) is False


def test_qr_code_is_a_png_data_uri(db, user):
    enrollment = MfaService(db).start_enrollment(user)
    assert enrollment["qr_code_data_uri"].startswith("data:image/png;base64,")


def test_otpauth_uri_names_the_issuer_and_email(db, user):
    enrollment = MfaService(db).start_enrollment(user)
    assert "Learnia" in enrollment["otpauth_uri"]
    assert "a%40b.com" in enrollment["otpauth_uri"] or "a@b.com" in enrollment["otpauth_uri"]
