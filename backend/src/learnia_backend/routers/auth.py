from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session as DbSession

from learnia_backend.config import settings
from learnia_backend.database import get_db
from learnia_backend.deps import get_current_user
from learnia_backend.models.user import User
from learnia_backend.schemas.auth import PasswordLoginRequest, RegisterRequest, UserRead
from learnia_backend.services.auth_service import AuthService

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/register", response_model=UserRead, status_code=201)
def register(
    body: RegisterRequest,
    response: Response,
    db: DbSession = Depends(get_db),
) -> User:
    return AuthService(db).register(email=body.email, password=body.password, response=response)


@router.post("/login/password", response_model=UserRead)
def login_password(
    body: PasswordLoginRequest,
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
    )


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, db: DbSession = Depends(get_db)) -> None:
    session_id = request.cookies.get(settings.session_cookie_name)
    AuthService(db).logout(session_id, response)


@router.get("/me", response_model=UserRead)
def get_me(current_user: User = Depends(get_current_user)) -> User:
    """Demo protected route: proves get_current_user works end to end."""
    return current_user
