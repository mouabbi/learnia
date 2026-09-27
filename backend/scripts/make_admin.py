"""One-off script to grant (or create) an admin account.

There is no admin-management UI yet, so promoting the first admin has to be
done directly against the app's database (DATABASE_URL in backend/.env) —
same pattern as scripts/seed_e2e_course.py.

Usage, from backend/:
    uv run python scripts/make_admin.py <email> [password]

- If a user with that email already exists, it's promoted to admin
  in place (password is ignored).
- If it doesn't exist, a new admin account is created with the given
  password (required in that case) and marked email-verified so it can
  log in immediately.

Safe to re-run: promoting an already-admin user is a no-op.
"""

import os
import sys

from learnia_backend.database import SessionLocal
from learnia_backend.models.user import User
from learnia_backend.security.passwords import hash_password
from learnia_backend.utils.time import utc_now_naive


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: uv run python scripts/make_admin.py <email> [password]")
        sys.exit(1)

    email = sys.argv[1]
    # Password from the command line, or from the ADMIN_PASSWORD environment
    # variable (used by deploy/create-admin.sh, so the password never appears
    # in a command line / `ps` output / shell history).
    password = sys.argv[2] if len(sys.argv) > 2 else os.environ.get("ADMIN_PASSWORD")

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()

        if user is None:
            if not password:
                print(f"No user with email '{email}' exists yet — pass a password to create one.")
                sys.exit(1)
            user = User(
                email=email,
                hashed_password=hash_password(password),
                email_verified_at=utc_now_naive(),
                is_admin=True,
            )
            db.add(user)
            db.commit()
            print(f"Created admin account '{email}' (id={user.id}).")
            return

        if user.is_admin:
            print(f"'{email}' (id={user.id}) is already an admin — nothing to do.")
            return

        user.is_admin = True
        db.commit()
        print(f"Promoted '{email}' (id={user.id}) to admin.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
