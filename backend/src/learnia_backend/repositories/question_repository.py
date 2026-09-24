"""
Authoring CRUD for Question (09-assessment-qcm / 10-final-exam). The
learner-facing side (taking a quiz/exam, recording an attempt score) is
routers/courses.py's progress endpoints; this is the other half — putting
questions into a module's bank or the final exam's bank in the first place.

One shared `questions` table discriminated by `scope` (see models/
question.py's docstring), so one repository covers both module-assessment
and final-exam authoring instead of two near-identical ones.
"""

from sqlalchemy.orm import Session

from learnia_backend.exceptions import NotFoundError, ValidationAppError
from learnia_backend.models.course import Course
from learnia_backend.models.enums import QuestionScope
from learnia_backend.models.module import Module
from learnia_backend.models.question import Question
from learnia_backend.repositories.course_repository import CourseRepository


def _assign_option_ids(options: list[dict]) -> list[dict]:
    out = []
    for index, option in enumerate(options):
        option_id = option.get("id") or f"opt{index + 1}"
        out.append({"id": option_id, "text": option["text"]})
    return out


def _validate_options(options: list[dict], correct_option_ids: list[str]) -> None:
    if not options:
        raise ValidationAppError("A question needs at least one option")
    option_ids = {o["id"] for o in options}
    if not correct_option_ids or not set(correct_option_ids).issubset(option_ids):
        raise ValidationAppError("correctOptionIds must reference this question's own option ids")


class QuestionRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, question_id: int) -> Question:
        question = self.db.get(Question, question_id)
        if question is None:
            raise NotFoundError(f"Question not found: {question_id}")
        return question

    def list_for_module(self, module_id: int) -> list[Question]:
        return (
            self.db.query(Question)
            .filter(
                Question.scope == QuestionScope.MODULE_ASSESSMENT,
                Question.module_id == module_id,
            )
            .order_by(Question.id)
            .all()
        )

    def list_for_final_exam(self, course_id: int) -> list[Question]:
        return (
            self.db.query(Question)
            .filter(Question.scope == QuestionScope.FINAL_EXAM, Question.course_id == course_id)
            .order_by(Question.id)
            .all()
        )

    def create_module_question(
        self,
        module_id: int,
        text: str,
        options: list[dict],
        correct_option_ids: list[str],
        explanation: str | None,
        difficulty: str | None,
    ) -> Question:
        module = self.db.get(Module, module_id)
        if module is None:
            raise NotFoundError(f"Module not found: {module_id}")
        options = _assign_option_ids(options)
        _validate_options(options, correct_option_ids)
        question = Question(
            scope=QuestionScope.MODULE_ASSESSMENT,
            course_id=module.course_id,
            module_id=module.id,
            text=text,
            options=options,
            correct_option_ids=correct_option_ids,
            explanation=explanation,
            difficulty=difficulty,
        )
        self.db.add(question)
        self.db.commit()
        self.db.refresh(question)
        CourseRepository(self.db).touch(module.course_id)
        return question

    def create_final_exam_question(
        self,
        course_id: int,
        text: str,
        options: list[dict],
        correct_option_ids: list[str],
        explanation: str | None,
        difficulty: str | None,
    ) -> Question:
        course = self.db.get(Course, course_id)
        if course is None:
            raise NotFoundError(f"Course not found: {course_id}")
        options = _assign_option_ids(options)
        _validate_options(options, correct_option_ids)
        question = Question(
            scope=QuestionScope.FINAL_EXAM,
            course_id=course.id,
            module_id=None,
            text=text,
            options=options,
            correct_option_ids=correct_option_ids,
            explanation=explanation,
            difficulty=difficulty,
        )
        self.db.add(question)
        self.db.commit()
        self.db.refresh(question)
        CourseRepository(self.db).touch(course.id)
        return question

    def update_question(
        self,
        question_id: int,
        text: str,
        options: list[dict],
        correct_option_ids: list[str],
        explanation: str | None,
        difficulty: str | None,
    ) -> Question:
        question = self.get(question_id)
        options = _assign_option_ids(options)
        _validate_options(options, correct_option_ids)
        question.text = text
        question.options = options
        question.correct_option_ids = correct_option_ids
        question.explanation = explanation
        question.difficulty = difficulty
        self.db.commit()
        self.db.refresh(question)
        CourseRepository(self.db).touch(question.course_id)
        return question

    def delete_question(self, question_id: int) -> None:
        question = self.get(question_id)
        course_id = question.course_id
        self.db.delete(question)
        self.db.commit()
        CourseRepository(self.db).touch(course_id)
