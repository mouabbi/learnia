"""Read-only queries over course content — see repositories/user_repository.py for the pattern."""

from sqlalchemy.orm import Session

from learnia_backend.models.course import Course


class CourseRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_all(self) -> list[Course]:
        return self.db.query(Course).order_by(Course.id).all()

    def get_by_slug(self, slug: str) -> Course | None:
        return self.db.query(Course).filter(Course.slug == slug).first()

    def get_by_id(self, course_id: int) -> Course | None:
        return self.db.get(Course, course_id)
