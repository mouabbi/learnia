# 11 — Content Workspace / CMS

## Purpose
The visual editor where courses, structure, content, assets and assessments are
managed without ever hand-editing JSON.

## Concepts that must be covered
1. Course management screens (create/edit metadata, theme, status)
2. Structure editor (tree view + add/rename/delete/reorder — reuses `06-course-structure` components)
3. Page content editor (block-by-block forms driven by the block registry from `07-content-system`)
4. Assessment/exam management screens (view/edit imported questions, regenerate a subset)
5. Asset manager panel (upload/browse/insert — `15-assets`)
6. Preview mode (render a page/course exactly as the learner would see it, from inside the CMS)
7. Import flow entry point (paste AI JSON → validate → preview → approve — `13-ai-content-import-validation`)
8. Workspace layout/navigation (how this fits into the app's main nav)

## Questions to answer before implementation
- Is there a single unified "workspace" route with sub-tabs (structure/content/assessments/assets), or separate top-level routes per concern? → Recommend a single workspace route per course with internal tabs — matches the master context's framing of one "content creation workspace."
- Autosave vs. explicit save per block/page edit? → Recommend explicit save per page (simpler correctness story, avoids partial/racy autosave complexity for v1); revisit if it's annoying in practice.

## Dependencies
- 06-course-structure, 07-content-system, 15-assets, 16-theming

## Implementation prompts that will eventually be required
1. Workspace shell/layout + course selector
2. Structure editor screen (tree + CRUD + reorder)
3. Page content editor (block forms, add/remove/reorder blocks within a page)
4. Preview mode (learner-view renderer reused inside CMS)
5. Asset manager panel
6. Assessment/exam review-and-edit screens
7. AI import entry point wiring (button → paste JSON modal → validation results)

## Learning opportunities
- Building a non-trivial editor UI (forms-over-JSON, not a JSON textarea)
- Reusing the same renderer for "preview" and "real" learner view (DRY across CMS and app)
- UX for structured content editing (drag/drop, inline validation)
