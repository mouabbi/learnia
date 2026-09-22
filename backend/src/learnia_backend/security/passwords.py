"""
Password hashing. Never store or compare plaintext passwords, anywhere,
ever — if the database leaks, hashed passwords are (with a strong algorithm
and no shortcuts) computationally infeasible to reverse; plaintext ones are
an instant compromise of every user's password on every other site they
reused it on.

bcrypt is used because it's a "slow" hash by design (tunable work factor) —
that slowness is the point: it makes brute-forcing a stolen hash database
expensive, unlike a fast general-purpose hash (e.g. SHA-256) which is
*wrong* for passwords precisely because it's fast.

Using `pwdlib` (not `passlib`): passlib is unmaintained and, at the time of
writing, breaks with modern bcrypt releases (it expects an internal
`__about__` attribute recent bcrypt versions removed). pwdlib is the
actively maintained successor, built for this exact use case.
"""

from pwdlib import PasswordHash
from pwdlib.hashers.bcrypt import BcryptHasher

# Explicit bcrypt hasher (not PasswordHash.recommended(), which defaults to
# argon2 and would require the separate `pwdlib[argon2]` extra we didn't
# install). Bcrypt is a fine, well-understood choice for this project.
_password_hash = PasswordHash((BcryptHasher(),))


def hash_password(plain_password: str) -> str:
    return _password_hash.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Returns True/False rather than raising — the caller (PasswordStrategy)
    treats "wrong password" and "unknown email" identically (see
    strategies/password.py) to avoid leaking which one was wrong.
    """
    return _password_hash.verify(plain_password, hashed_password)


# A valid hash of a throwaway password, used to burn the same CPU time when a
# login names an email that doesn't exist (see auth/strategies/password.py).
DUMMY_HASH = hash_password("not-a-real-password")
