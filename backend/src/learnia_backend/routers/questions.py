"""
Question authoring endpoints (09-assessment-qcm / 10-final-exam) — CMS-only
CRUD for a module's assessment bank and a course's final-exam bank. All
gated by get_current_user, same authoring gate as course_structure.py.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DbSession

from learnia_backend.database import get_db
from learnia_backend.deps import get_current_user
from learnia_backend.exceptions import ValidationAppError
from learnia_backend.models.question import Question
from learnia_backend.models.user import User
from learnia_backend.repositories.question_repository import QuestionRepository
from learnia_backend.schemas.questions import QuestionAdminOut, QuestionWriteRequest

router = APIRouter(prefix="/api/v1/courses", tags=["questions"])


def _require_int(raw: str, what: str) -> int:
    try:
        return int(raw)
    except ValueError as exc:
        raise ValidationAppError(f"Invalid {what}: {raw!r}") from exc


def _question_out(question: Question) -> QuestionAdminOut:
    return QuestionAdminOut(
        id=str(question.id),
        scope=question.scope.value,
        courseId=str(question.course_id),
        moduleId=str(question.module_id) if question.module_id is not None else None,
        text=question.text,
        options=question.options,
        correctOptionIds=question.correct_option_ids,
        explanation=question.explanation,
        difficulty=question.difficulty,
    )


def _options_as_dicts(body: QuestionWriteRequest) -> list[dict]:
    return [{"id": o.id, "text": o.text} for o in body.options]


# -- module assessment bank ---------------------------------------------


@router.get("/modules/{module_id}/questions", response_model=list[QuestionAdminOut])
def list_module_questions(
    module_id: int,
    db: DbSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[QuestionAdminOut]:
    repo = QuestionRepository(db)
    return [_question_out(q) for q in repo.list_for_module(module_id)]


@router.post("/modules/{module_id}/questions", response_model=QuestionAdminOut)
def create_module_question(
    module_id: int,
    body: QuestionWriteRequest,
    db: DbSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> QuestionAdminOut:
    repo = QuestionRepository(db)
    question = repo.create_module_question(
        module_id,
        body.text,
        _options_as_dicts(body),
        body.correct_option_ids,
        body.explanation,
        body.difficulty,
    )
    return _question_out(question)


# -- final exam bank ------------------------------------------------------


@router.get("/{course_id}/final-exam/questions", response_model=list[QuestionAdminOut])
def list_final_exam_questions(
    course_id: int,
    db: DbSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[QuestionAdminOut]:
    repo = QuestionRepository(db)
    return [_question_out(q) for q in repo.list_for_final_exam(course_id)]


@router.post("/{course_id}/final-exam/questions", response_model=QuestionAdminOut)
def create_final_exam_question(
    course_id: int,
    body: QuestionWriteRequest,
    db: DbSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> QuestionAdminOut:
    repo = QuestionRepository(db)
    question = repo.create_final_exam_question(
        course_id,
        body.text,
        _options_as_dicts(body),
        body.correct_option_ids,
        body.explanation,
        body.difficulty,
    )
    return _question_out(question)


# -- shared: update/delete by question id ---------------------------------


@router.patch("/questions/{question_id}", response_model=QuestionAdminOut)
def update_question(
    question_id: int,
    body: QuestionWriteRequest,
    db: DbSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> QuestionAdminOut:
    repo = QuestionRepository(db)
    question = repo.update_question(
        question_id,
        body.text,
        _options_as_dicts(body),
        body.correct_option_ids,
        body.explanation,
        body.difficulty,
    )
    return _question_out(question)


@router.delete("/questions/{question_id}", status_code=204)
def delete_question(
    question_id: int,
    db: DbSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> None:
    QuestionRepository(db).delete_question(question_id)
