# 06 — Course Structure

## Purpose
The hierarchy: Course → Module → Chapter → Page (sections live inside page content,
see `07-content-system`). Ordering, CRUD, and moving/reorganizing nodes.

## Concepts that must be covered
1. Module, Chapter, Page models: title, order/position, parent fk, course fk (denormalized for query convenience?)
2. Ordering/reorder API (drag-and-drop reorder in the CMS → position updates)
3. CRUD for modules/chapters/pages (add/rename/delete/move)
4. Cascade rules (deleting a module deletes its chapters/pages — with confirmation)
5. Tree-fetching strategy (single endpoint returning full course tree vs. lazy per-level fetches)
6. Numbering/display (Module 1, Chapter 1, Page 1 — computed from position, not stored redundantly)

## Questions to answer before implementation
- Full tree in one API call (course + modules + chapters + pages, no content) vs. paginated/lazy loading? → Recommend one full structural tree call (it's metadata only, small payload even for a large course) — simplifies the CMS tree view and the learner's navigation sidebar.
- Should Page have its own fixed "type" (e.g. normal page vs. intro page) or is that unnecessary for v1? → Defer; treat all pages uniformly for now.

## Dependencies
- 05-course-system

## Implementation prompts that will eventually be required
1. Module/Chapter/Page models + migrations
2. Course tree endpoint (GET full structure)
3. CRUD endpoints: add/rename/delete module, chapter, page
4. Reorder endpoint(s) (update position within parent)
5. Frontend: tree view component (used by both CMS and learner navigation)
6. Frontend: CMS reorder interaction (drag-and-drop or up/down controls)

## Learning opportunities
- Modeling and querying tree/hierarchical data in a relational DB
- Building a reusable tree UI component
- Designing an API that serves both an editor and a read-only consumer from one shape
