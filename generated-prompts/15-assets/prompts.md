# 15 — Assets

## Purpose
Upload, store, and reference images, diagrams, videos, YouTube links, audio, PDFs
and other files used in course content.

## Concepts that must be covered
1. `assets` table: id, course_id (nullable for global assets?), filename, mime_type, size, storage_path/URL, uploaded_at
2. Local storage layout (filesystem path convention, e.g. `assets/{course_slug}/{uuid}.{ext}`) — later swappable for S3 (`15` should design the storage interface so S3 is a drop-in later, per `21-deployment`)
3. Upload endpoint (validation: allowed mime types, max size)
4. Asset browser/picker UI (used from the CMS content editor to insert an image/video block)
5. Referencing assets from content blocks (store asset id or resolved URL in the block JSON?)
6. YouTube embeds are NOT uploaded assets — just a URL/ID field on a `youtube` block type (no asset storage needed)
7. Serving assets (static file serving locally; presigned URLs once on S3)

## Questions to answer before implementation
- Store an asset **id** in content block JSON (resolved to a URL at render time) or store the resolved **URL** directly? → Recommend storing the asset **id**, resolve to URL at render/serve time — this is what makes migrating local storage → S3 later transparent (content JSON never needs rewriting).
- Are assets scoped to a single course, or can they be shared/global (e.g. a reusable diagram)? → Recommend course-scoped for v1 (simpler ownership/cleanup story); revisit if reuse becomes a real need.

## Dependencies
- 04-database

## Implementation prompts that will eventually be required
1. Assets model + migration
2. Storage abstraction interface (local filesystem implementation now, S3 implementation later — same interface)
3. Upload endpoint (validation, storage write, DB record)
4. Asset serving endpoint/static mount
5. Frontend: asset browser/picker component (used inside CMS block editors)
6. Frontend: upload UI (drag/drop, progress, preview)

## Learning opportunities
- Designing a storage abstraction that survives a later infra swap (local disk → S3)
- File upload validation and security (mime sniffing vs. trusting extensions, size limits)
- Indirection (id → resolved URL) as a technique for decoupling content from storage location
