from sqlalchemy.orm import Session as DbSession

from learnia_backend.models.mfa import MfaRecoveryCode, MfaSecret, hash_recovery_code
from learnia_backend.utils.time import utc_now_naive


class MfaRepository:
    def __init__(self, db: DbSession) -> None:
        self.db = db

    # --- secret ---

    def get_secret(self, user_id: int) -> MfaSecret | None:
        return self.db.query(MfaSecret).filter(MfaSecret.user_id == user_id).first()

    def replace_secret(self, user_id: int, encrypted_secret: str) -> MfaSecret:
        """Enrolling again (before confirming, or re-enrolling later) replaces any old row."""
        existing = self.get_secret(user_id)
        if existing is not None:
            self.db.delete(existing)
            self.db.flush()
        secret = MfaSecret(user_id=user_id, encrypted_secret=encrypted_secret)
        self.db.add(secret)
        self.db.commit()
        self.db.refresh(secret)
        return secret

    def confirm_secret(self, secret: MfaSecret) -> None:
        secret.confirmed_at = utc_now_naive()
        self.db.commit()

    def delete_secret(self, user_id: int) -> None:
        secret = self.get_secret(user_id)
        if secret is not None:
            self.db.delete(secret)
            self.db.commit()

    # --- recovery codes ---

    def replace_recovery_codes(self, user_id: int, raw_codes: list[str]) -> None:
        self.db.query(MfaRecoveryCode).filter(MfaRecoveryCode.user_id == user_id).delete()
        for raw_code in raw_codes:
            self.db.add(MfaRecoveryCode(user_id=user_id, code_hash=hash_recovery_code(raw_code)))
        self.db.commit()

    def consume_recovery_code(self, user_id: int, raw_code: str) -> bool:
        code = (
            self.db.query(MfaRecoveryCode)
            .filter(
                MfaRecoveryCode.user_id == user_id,
                MfaRecoveryCode.code_hash == hash_recovery_code(raw_code),
                MfaRecoveryCode.used_at.is_(None),
            )
            .first()
        )
        if code is None:
            return False
        code.used_at = utc_now_naive()
        self.db.commit()
        return True

    def delete_recovery_codes(self, user_id: int) -> None:
        self.db.query(MfaRecoveryCode).filter(MfaRecoveryCode.user_id == user_id).delete()
        self.db.commit()
