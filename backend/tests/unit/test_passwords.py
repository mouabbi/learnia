from learnia_backend.security.passwords import hash_password, verify_password


def test_hash_is_not_plaintext():
    assert hash_password("secret123") != "secret123"


def test_correct_password_verifies():
    assert verify_password("secret123", hash_password("secret123")) is True


def test_wrong_password_fails():
    assert verify_password("wrong", hash_password("secret123")) is False


def test_same_password_hashes_differently_each_time():
    # bcrypt adds a random salt, so two hashes of one password differ.
    assert hash_password("secret123") != hash_password("secret123")
