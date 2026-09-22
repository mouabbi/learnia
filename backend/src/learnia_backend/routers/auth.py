from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session as DbSession

from learnia_backend.config import settings
from learnia_backend.database import get_db
from learnia_backend.deps import get_current_user
from learnia_backend.models.user import User
from learnia_backend.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    PasswordLoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenRequest,
    UserRead,
)
from learnia_backend.services.account_service import AccountService
from learnia_backend.services.auth_service import AuthService


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/register", response_model=UserRead, status_code=201)
def register(
    body: RegisterRequest,
    request: Request,
    response: Response,
    db: DbSession = Depends(get_db),
) -> User:
    return AuthService(db).register(
        email=body.email,
        password=body.password,
        response=response,
        ip_address=_client_ip(request),
    )


@router.post("/login/password", response_model=UserRead)
def login_password(
    body: PasswordLoginRequest,
    request: Request,
    response: Response,
    db: DbSession = Depends(get_db),
) -> User:
    # Router stays thin: parse the request (Pydantic already did that),
    # delegate everything else to the service. `credentials` is a plain
    # dict because AuthStrategy.authenticate() is deliberately generic
    # across strategies (see auth/strategies/base.py).
    service = AuthService(db)
    return service.login(
        strategy_id="password",
        credentials={"email": body.email, "password": body.password},
        response=response,
        ip_address=_client_ip(request),
    )


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, db: DbSession = Depends(get_db)) -> None:
    session_id = request.cookies.get(settings.session_cookie_name)
    AuthService(db).logout(session_id, response, ip_address=_client_ip(request))


@router.get("/me", response_model=UserRead)
def get_me(current_user: User = Depends(get_current_user)) -> User:
    """Demo protected route: proves get_current_user works end to end."""
    return current_user


@router.post("/password/change", status_code=204)
def change_password(
    body: ChangePasswordRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
) -> None:
    AccountService(db).change_password(
        current_user,
        body.current_password,
        body.new_password,
        current_session_id=request.cookies.get(settings.session_cookie_name),
        ip_address=_client_ip(request),
    )


@router.post("/password/forgot", status_code=202)
def forgot_password(
    body: ForgotPasswordRequest, request: Request, db: DbSession = Depends(get_db)
) -> dict[str, str]:
    AccountService(db).request_password_reset(body.email, ip_address=_client_ip(request))
    # Same answer whether or not the email exists (no account enumeration).
    return {"message": "If that email is registered, a reset link has been sent."}


@router.post("/password/reset", status_code=204)
def reset_password(
    body: ResetPasswordRequest, request: Request, db: DbSession = Depends(get_db)
) -> None:
    AccountService(db).reset_password(body.token, body.new_password, ip_address=_client_ip(request))


@router.post("/email/verification/send", status_code=204)
def send_verification_email(
    current_user: User = Depends(get_current_user), db: DbSession = Depends(get_db)
) -> None:
    AccountService(db).send_verification_email(current_user)


@router.post("/email/verify", status_code=204)
def verify_email(body: TokenRequest, request: Request, db: DbSession = Depends(get_db)) -> None:
    AccountService(db).verify_email(body.token, ip_address=_client_ip(request))
