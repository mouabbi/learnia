from fastapi import APIRouter

from learnia_backend.schemas.health import HealthResponse

# prefix is /api/v1/... (not just /api/...) — see 02-architecture:
# versioning from day one means every router declares its version prefix here.
router = APIRouter(prefix="/api/v1", tags=["health"])


@router.get("/health", response_model=HealthResponse)
def get_health() -> HealthResponse:
    return HealthResponse(status="ok")
