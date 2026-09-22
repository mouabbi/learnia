# 04 — Database

## Purpose
Design the SQLite schema and the SQLAlchemy/Alembic setup that will hold all
structural/system data, and define precisely what does NOT live in the database
(page content, assets — see `07-content-system` and `15-assets`).

## Concepts that must be covered
1. SQLAlchemy 2.0 setup (declarative models, typed columns, engine/session management for FastAPI)
2. Alembic migrations (init, autogenerate, review-before-apply discipline)
3. Core tables (draft, refine during 05/06/08/09/10):
   - `users`, `sessions`
   - `courses` (metadata, content status, theme reference)
   - `modules`, `chapters`, `pages` (hierarchy + ordering)
   - `learning_progress` (per-course, per-page: learning status, last position, completed_at)
   - `notes`
   - `module_assessments`, `assessment_attempts`, `assessment_answers`
   - `final_exam_attempts`
   - `assets` (metadata; files on disk/S3 later)
4. Ordering strategy for hierarchical/sortable lists (integer `position` column vs. fractional indexing) — needed for modules/chapters/pages and for "may rarely reorder" requirement
5. Foreign key constraints + cascade behavior (deleting a course should cascade sensibly)
6. Indexing strategy (lookup by slug, by course, by user)
7. Transactions (where multi-row writes must be atomic — e.g. reordering, exam submission)
8. SQLite-specific considerations (single-writer behavior, `WAL` mode, path to Postgres/RDS later)


## Questions to answer before implementation
- Ordering approach for modules/chapters/pages: simple integer `position` with renumbering on move, or fractional/lexicographic keys to avoid renumbering? → Recommend simple integer `position` initially (rare reordering per the master context; renumbering a short list is cheap and easy to understand).

ok position 


- Do notes belong to a page, a section within a page, or both? → Defer final answer to `08-learning-progress`, but reserve a nullable `section_id`-style anchor now so the schema doesn't need a breaking migration later.  note  to a page  



- Should `content status` and `learning progress` really live in different tables? → Yes: `courses.content_status` (system/content data) is separate from `learning_progress` (per-user, per-course/page). Do not merge.

yes  and  also  the app  now  just disgn it  for  multiuser    

## Dependencies
- 02-architecture

## Implementation prompts that will eventually be required
1. SQLAlchemy + Alembic setup (engine, session dependency, base model)
2. Core schema migration: users, sessions
3. Course/module/chapter/page schema migration (structure + ordering)
4. Learning progress schema migration
5. Assessment + exam schema migration
6. Notes schema migration
7. Assets metadata schema migration
8. Seed/fixture script for local development
9. Migration review checklist (what to check before running `alembic upgrade`)

## Learning opportunities
- Relational modeling of hierarchical data
- Migrations as a discipline (never hand-edit schema in prod)
- Indexing and query performance basics
- Transactions and data integrity
- SQLite operational characteristics vs. a client-server DB
