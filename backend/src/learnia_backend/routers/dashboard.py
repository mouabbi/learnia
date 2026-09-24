"""
Dashboard aggregation endpoint (17-dashboard) — the landing view's data in
one call. Per-user (continue-learning card, per-user progress/status,
recommendations exclude what THIS user has started), so gated behind
get_current_user like the progress endpoints in routers/courses.py, unlike
that file's public GET /courses.

All the actual assembly lives in services/dashboard_service.py — this router
is just the HTTP shell.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DbSession

from learnia_backend.database import get_db
from learnia_backend.deps import get_current_user
from learnia_backend.models.user import User
from learnia_backend.schemas.dashboard import DashboardResponse
from learnia_backend.services.dashboard_service import get_dashboard

router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardResponse)
def get_dashboard_view(
    db: DbSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DashboardResponse:
    return DashboardResponse(**get_dashboard(db, user.id))
