# 09 — Assessment / QCM System

## Purpose
Module-level multiple-choice assessments that feed into the global course score
alongside the final exam.

## Confirmed decisions
- **Scope: module-level only.** No per-page, no per-chapter assessments.
- **Minimum 50 questions per module assessment.**
- Scoring: `globalScore = moduleAssessmentAverage × 0.20 + finalExamScore × 0.80`,
  where `moduleAssessmentAverage` is the average of that course's module assessment
  scores (not 20% per module — 20% total, applied to the average).
- A course cannot exist without a final exam (`10-final-exam`). A module MAY lack an
  assessment; if it lacks one, it's simply excluded from the module average (document
  this rule precisely once implemented — don't let a missing assessment silently count as 0).

## Concepts that must be covered
1. `module_assessments` model: belongs to a module, has ≥50 questions
2. Question model: text, options (multiple choice), correct answer(s), explanation (optional), difficulty (optional)
3. `assessment_attempts` model: per user+assessment, started_at, submitted_at, score, answers
4. Attempt lifecycle: start → answer questions → submit → score → review
5. Multiple attempts: allowed or single-attempt? Best score kept, or latest?
6. Randomized question order / option order per attempt (reduces memorization)
7. Scoring calculation service (single source of truth, used by dashboard/course page too)
8. AI generation of QCM content (feeds from `12-ai-prompt-builder` / `13-ai-content-import-validation`)

## Questions to answer before implementation
- Multiple attempts allowed? → Recommend: allowed, unlimited, keep **best score** for the module average (learning tool, not a gatekeeping exam — that seriousness is reserved for the final exam per the master context).
- Are all 50+ questions shown every attempt, or a random subset drawn from a larger bank? → Recommend: if the module has more questions generated than 50, draw a random subset per attempt (keeps assessments fresh); if exactly the minimum, show all.
- Passing threshold: is there a pass/fail gate per module, or is it purely a score that feeds the average? → Recommend: purely a score feeding the average for v1; no hard gate blocking progress (avoid over-engineering a gating system not requested).

## Dependencies
- 06-course-structure, 07-content-system, 08-learning-progress

## Implementation prompts that will eventually be required
1. Question/assessment/attempt models + migrations
2. Assessment CRUD (created via AI import, per `13-ai-content-import-validation`)
3. Attempt lifecycle endpoints (start, submit answer(s), submit final, get result)
4. Scoring service (module score, module average, feeds `globalScore`)
5. Frontend: assessment-taking UI (question nav, submit, review)
6. Frontend: assessment results view (score, correct/incorrect breakdown)

## Learning opportunities
- Modeling attempts/answers as immutable event-like records vs. mutable state
- Scoring/aggregation logic as a testable service, isolated from API routing
- Randomization done correctly (server-side, not trusting the client)
