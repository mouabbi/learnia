# 19 — Performance & Accessibility (cross-cutting)

## Purpose
Not a standalone feature phase — a checklist applied across systems, especially
content rendering, the CMS, and theming, once the core is functional.

## Concepts that must be covered
1. Accessibility: semantic HTML in block renderers, keyboard navigation (exam navigator, search, CMS forms), ARIA where native semantics fall short, color contrast (ties to `16-theming`)
2. Performance: avoid loading entire course content tree with full page content eagerly (structure metadata vs. lazy page content — ties to `06-course-structure`); pagination/virtualization for long lists if needed
3. Image handling (responsive sizing, lazy loading for course content images)
4. Bundle size hygiene on the frontend (code splitting per route, especially the heavy exam/CMS views)

## Questions to answer before implementation
- None blocking — this is applied incrementally as each system is built, then given a dedicated audit pass late in Phase 1/2. No upfront decision needed now.

## Dependencies
- 06-course-structure, 07-content-system, 11-content-workspace-cms (applied after these exist)

## Implementation prompts that will eventually be required
1. Accessibility audit + fixes pass (keyboard nav, ARIA, contrast) across learner view, CMS, exam
2. Frontend code-splitting pass (route-based lazy loading)
3. Content-loading performance pass (lazy page content, tree vs. full-content separation confirmed)

## Learning opportunities
- Accessibility as a practice, not a checkbox (keyboard-only walkthroughs, screen reader spot checks)
- Web performance fundamentals (lazy loading, code splitting, avoiding over-fetching)
