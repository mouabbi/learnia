"""
MfaService — TOTP enrollment/confirmation/disable and code verification.
Two-step enrollment on purpose: `enroll()` only generates+stores the secret
(unconfirmed, doesn't protect login yet); `confirm()` requires one valid
code first, so a user can't lock themselves out by scanning a QR code wrong
and walking away.
"""

import base64
import io

import pyotp
import qrcode
from sqlalchemy.orm import Session as DbSession

from learnia_backend.config import settings
from learnia_backend.exceptions import UnauthorizedError, ValidationAppError
from learnia_backend.models.mfa import generate_recovery_code
from learnia_backend.models.user import User
from learnia_backend.repositories.mfa_repository import MfaRepository
from learnia_backend.security.encryption import decrypt, encrypt
from learnia_backend.security.passwords import verify_password


class MfaService:
    def __init__(self, db: DbSession) -> None:
        self.mfa = MfaRepository(db)

    def is_enabled(self, user_id: int) -> bool:
        secret = self.mfa.get_secret(user_id)
        return secret is not None and secret.is_active()

    def start_enrollment(self, user: User) -> dict:
        raw_secret = pyotp.random_base32()
        self.mfa.replace_secret(user.id, encrypt(raw_secret))

        uri = pyotp.totp.TOTP(raw_secret).provisioning_uri(
            name=user.email, issuer_name=settings.mfa_issuer
        )
        return {"secret": raw_secret, "otpauth_uri": uri, "qr_code_data_uri": _qr_data_uri(uri)}



    def confirm_enrollment(self, user: User, code: str) -> list[str]:
        secret = self.mfa.get_secret(user.id)
        if secret is None:
            raise ValidationAppError("No MFA enrollment in progress")

        if not pyotp.TOTP(decrypt(secret.encrypted_secret)).verify(code, valid_window=1):
            raise ValidationAppError("Invalid code")

        self.mfa.confirm_secret(secret)
        raw_codes = [generate_recovery_code() for _ in range(settings.mfa_recovery_codes_count)]
        self.mfa.replace_recovery_codes(user.id, raw_codes)
        return raw_codes



    def disable(self, user: User, current_password: str) -> None:
        if not verify_password(current_password, user.hashed_password):
            raise UnauthorizedError("Current password is incorrect")
        self.mfa.delete_secret(user.id)
        self.mfa.delete_recovery_codes(user.id)


    def verify_login_code(self, user: User, code: str) -> bool:
        """Accepts either a 6-digit TOTP code or a single-use recovery code."""
        secret = self.mfa.get_secret(user.id)
        if secret is None or not secret.is_active():
            return False

        if code.strip().isdigit() and pyotp.TOTP(decrypt(secret.encrypted_secret)).verify(
            code.strip(), valid_window=1
        ):
            return True

        return self.mfa.consume_recovery_code(user.id, code.strip())


def _qr_data_uri(otpauth_uri: str) -> str:
    image = qrcode.make(otpauth_uri)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/png;base64,{encoded}"
