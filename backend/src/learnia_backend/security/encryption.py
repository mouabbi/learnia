"""
Symmetric encryption for data that must be readable again later (unlike a
password — see security/passwords.py). Used for TOTP secrets: the server
needs the *plaintext* secret to check a 6-digit code, so it can't be hashed
the way a password is; it's encrypted at rest instead, so a stolen database
alone doesn't hand over every user's live MFA secret.

Fernet (from `cryptography`) is AES-128 under the hood, with a random IV
per encryption — the same secret encrypts to a different string every time.
"""

from cryptography.fernet import Fernet

from learnia_backend.config import settings

_fernet = Fernet(settings.mfa_encryption_key.encode())


def encrypt(plaintext: str) -> str:
    return _fernet.encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    return _fernet.decrypt(ciphertext.encode()).decode()
