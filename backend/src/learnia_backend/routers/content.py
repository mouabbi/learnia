"""
Page content API (07-content-system): GET is public read-only content
(same trust level as routers/courses.py's course reads), PUT is the CMS
write path — gated by get_current_user like routers/course_structure.py.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DbSession

from learnia_backend.database import get_db
from learnia_backend.deps import get_current_user
from learnia_backend.models.user import User
from learnia_backend.repositories.structure_repository import StructureRepository
from learnia_backend.schemas.content import PageContent
from learnia_backend.services.content_service import ContentService

router = APIRouter(prefix="/api/v1/courses", tags=["content"])


@router.get("/pages/{page_id}/content", response_model=PageContent)
def get_page_content(page_id: int, db: DbSession = Depends(get_db)) -> PageContent:
    page = StructureRepository(db).get_page(page_id)
    return ContentService(db).read(page)


@router.put("/pages/{page_id}/content", response_model=PageContent)
def put_page_content(
    page_id: int,
    body: PageContent,
    db: DbSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> PageContent:
    page = StructureRepository(db).get_page(page_id)
    return ContentService(db).write(page, body)
