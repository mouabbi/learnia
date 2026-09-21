"""
Creates the single initial user this app expects (see 03-authentication:
"seeded via a setup script, not an open /register endpoint" — this project
is single-user, so registration isn't a public API).

Usage (from backend/, with the venv active via uv):
    uv run python scripts/seed_user.py you@example.com "your-password"
"""

import sys
from pathlib import Path

# So `learnia_backend` is importable when running this script directly
# (it lives outside src/, which isn't on sys.path by default).
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from learnia_backend.database import SessionLocal  # noqa: E402
from learnia_backend.repositories.user_repository import UserRepository  # noqa: E402
from learnia_backend.security.passwords import hash_password  # noqa: E402


def main() -> None:
    if len(sys.argv) != 3:
        print('Usage: python scripts/seed_user.py <email> "<password>"')
        sys.exit(1)

    email, password = sys.argv[1], sys.argv[2]

    db = SessionLocal()
    try:
        repo = UserRepository(db)
        if repo.get_by_email(email) is not None:
            print(f"User {email} already exists — nothing to do.")
            return

        user = repo.create(email=email, hashed_password=hash_password(password))
        print(f"Created user #{user.id}: {user.email}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
