# 08 — Learning Progress

## Purpose
Track the learner's position, completion, and notes — entirely separate from content
status. Powers "continue where I left off" and progress percentages.

## Concepts that must be covered
1. `learning_progress` table: per user+course, current page pointer, per-page completion records
2. Progress calculation (completed pages / total pages → percentage)
3. "Mark as completed on Next" behavior (auto-complete current page when advancing)
4. Last-position tracking (course → module → chapter → page) surfaced on the dashboard
5. Notes: scope decision (page-level to start; section-level anchor reserved in schema per `04-database`)
6. Learning status state machine: `NOT_STARTED → IN_PROGRESS → COMPLETED`, transition triggers

## Questions to answer before implementation
- Is progress percentage weighted equally per page, or should longer pages count more? → Recommend equal weight per page for v1 (simplicity); revisit only if it feels wrong in practice.
- Notes scope for v1: page-level only, or also allow a note anchored to a specific section within a page? → Recommend page-level notes for v1; the reserved `section_id` column allows section-level later without a migration.

## Dependencies
- 06-course-structure, 07-content-system

## Implementation prompts that will eventually be required
1. Learning progress model + migration (if not covered in 04)
2. Progress update endpoint (mark page complete / advance position)
3. Progress calculation service (percentage per course)
4. "Continue learning" endpoint (last position lookup)
5. Notes CRUD endpoints
6. Frontend: progress bar, next/prev/skip controls wired to progress API
7. Frontend: notes panel in the learner view

## Learning opportunities
- Designing per-user state that's independent from content state
- Idempotent progress-update endpoints (re-visiting a completed page shouldn't corrupt state)
- Simple derived-metric calculation (percentage) done correctly
