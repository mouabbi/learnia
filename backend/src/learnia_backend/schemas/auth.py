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
    email_verified: bool
    is_admin: bool

    model_config = {"from_attributes": True}  # lets Pydantic read this straight from a User row


def _check_min_length(value: str) -> str:
    if len(value) < 8:
        raise ValueError("Password must be at least 8 characters")
    return value


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    _validate_new = field_validator("new_password")(_check_min_length)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    _validate_new = field_validator("new_password")(_check_min_length)


class TokenRequest(BaseModel):
    token: str


class LoginResult(BaseModel):
    """
    Response for POST /auth/login/password and /auth/login/mfa.
    Exactly one of (`user`) or (`mfa_ticket`) is set, matched by
    `mfa_required` — see AuthService.login()'s docstring.
    """

    mfa_required: bool
    user: UserRead | None = None
    mfa_ticket: str | None = None


class MfaLoginRequest(BaseModel):
    mfa_ticket: str
    code: str


class MfaEnrollResponse(BaseModel):
    secret: str
    otpauth_uri: str
    qr_code_data_uri: str


class MfaConfirmRequest(BaseModel):
    code: str


class MfaConfirmResponse(BaseModel):
    recovery_codes: list[str]


class MfaDisableRequest(BaseModel):
    current_password: str


class MfaStatusResponse(BaseModel):
    enabled: bool
