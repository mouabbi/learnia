from pydantic import BaseModel, EmailStr, field_validator


class PasswordLoginRequest(BaseModel):
    """Request body for POST /auth/login/password. Other strategies (later)
    get their own request schema — a Google OAuth login won't have a
    password field, so reusing one shared schema would be wrong."""

    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    """Request body for POST /auth/register. Separate from
    PasswordLoginRequest even though the fields look identical right now —
    registration enforces a minimum password length that login must NOT
    enforce (an old account created before this rule existed must still be
    able to log in with its existing, shorter password)."""

    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_minimum_length(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("Password must be at least 8 characters")
        return value


class UserRead(BaseModel):
    """
    The "Read" schema (see schemas/health.py for the Base/Create/Update/Read
    convention). Deliberately excludes `hashed_password` — this is what
    guarantees it can never leak into an API response, even by accident.
    """

    id: int
    email: str

    model_config = {"from_attributes": True}  # lets Pydantic read this straight from a User row
