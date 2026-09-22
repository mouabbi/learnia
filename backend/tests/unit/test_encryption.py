from learnia_backend.security.encryption import decrypt, encrypt


def test_round_trip():
    assert decrypt(encrypt("JBSWY3DPEHPK3PXP")) == "JBSWY3DPEHPK3PXP"


def test_ciphertext_is_not_the_plaintext():
    assert encrypt("a-secret") != "a-secret"


def test_encrypting_twice_gives_different_ciphertext():
    # Fernet uses a random IV each time, even for the same input.
    assert encrypt("a-secret") != encrypt("a-secret")
