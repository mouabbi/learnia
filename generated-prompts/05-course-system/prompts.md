# 05 — Course System

## Purpose
The course as a top-level entity: metadata, visual identity fields, content status
lifecycle, and CRUD.

## Concepts that must be covered
1. Course model fields: title, slug, description, icon, content_status, theme (fk/embedded — see `16-theming`), timestamps
2. Slug generation + uniqueness
3. Content status state machine: `PLANNED → DRAFT → READY → PUBLISHED → ARCHIVED`
   - define legal transitions (can you go PUBLISHED → DRAFT? probably yes, for edits)
4. Course CRUD API (create/list/get/update/archive)
5. Course icon handling (upload vs. icon picker — relates to `15-assets`)
6. Relationship to theme (`16-theming`) — does theme live inline on the course row or in a separate table?

## Questions to answer before implementation
- Legal content-status transitions: is any transition allowed, or should some be blocked (e.g. can't go straight from PLANNED to PUBLISHED without READY)? → Recommend a simple linear-forward + "can always move backward to DRAFT for edits" model; formalize as a small explicit transition table, not free-for-all.
- Can a course be deleted, or only archived? → Recommend soft-delete via ARCHIVED; hard delete only as a rare manual/admin action.

## Dependencies
- 04-database

## Implementation prompts that will eventually be required
1. Course SQLAlchemy model + migration (if not already in 04)
2. Course status state machine (backend enforcement)
3. Course CRUD endpoints
4. Course CRUD frontend (list view, create form, edit metadata form)
5. Slug generation + validation

## Learning opportunities
- State machines as a modeling tool (not just "a status column")
- CRUD API design done properly (validation, status codes, idempotency where relevant)
- Slugs and URL-safe identifiers
