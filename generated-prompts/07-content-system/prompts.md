# 07 — Content System

## Purpose
Page content: the structured JSON block format, its storage as files (not DB rows),
and the rendering layer that turns blocks into UI.

## Concepts that must be covered
1. JSON content schema per page: ordered list of blocks, each with `type` + `type`-specific fields
2. Block types (v1): heading, paragraph/text, code, terminal, image, video, youtube, link, quote, tip, warning, important, note, list, table
3. Sections (1.1, 1.2, 1.3) as a block-level construct (e.g. a `heading` block with a `level`/`numbered` flag) — NOT separate pages/routes
4. File storage layout: where page JSON files live on disk, naming convention tied to page id/slug, how the DB row (`pages.content_path` or similar) references the file
5. Pydantic schemas for each block type (used both for validation and for API responses)
6. Extensibility: how a new block type gets added later without breaking existing content
7. Rendering: a React block-renderer that maps `type` → component (registry pattern)
8. Read vs. write path: CMS writes JSON via structured editor forms (never raw JSON editing), learner view reads it read-only

## Questions to answer before implementation
- Exact file layout: `content/{course_slug}/{page_id}.json` vs. DB-adjacent path stored per page row? → Recommend storing an explicit `content_path` (or deterministic convention) on the `pages` row in SQLite, with files under a top-level `content/` directory outside the DB — keeps DB authoritative for "where is this" while content itself stays as files.
- Schema versioning per content file (a `schemaVersion` field in each JSON file) — needed now or later? → Recommend adding it now (cheap, 1 field) even though full versioning (`22-future-versioning`) is deferred; it avoids a painful migration later.

## Dependencies
- 06-course-structure

## Implementation prompts that will eventually be required
1. Define block-type JSON schema + Pydantic models for each block type
2. Content file storage service (read/write JSON to disk, path resolution)
3. Page content API (GET/PUT page content, validated through Pydantic)
4. Frontend block-renderer registry (read-only rendering for the learner view)
5. Frontend block editor components (CMS: one form/editor per block type)
6. Code block rendering (syntax highlighting library, copy button)

## Learning opportunities
- Designing an extensible, versioned content schema
- Separating "where data lives" (files) from "what references it" (DB)
- Registry/strategy pattern for rendering polymorphic content
- Pydantic discriminated unions for typed block validation
