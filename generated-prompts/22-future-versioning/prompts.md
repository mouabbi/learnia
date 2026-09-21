# 22 — Future Versioning (Deferred)

## Purpose
Capture the open questions around content/course versioning so the decision isn't
lost, without implementing anything now. **No implementation prompts should be
generated from this file until explicitly revisited.**

## Open questions (all deliberately unresolved)
1. Do course versions matter at all for a single-user app, or is this only valuable once multiple people/collaborators are involved?
2. If page versioning exists, is it full snapshot history, or just "previous version" (one level of undo)?
3. When published content changes, what happens to a learner's in-progress progress against the old content? (e.g. does progress reset, stay, or get flagged as "content changed since you last visited"?)
4. Should PUBLISHED versions be immutable (edits create a new draft version, publish is a discrete promotion step), or can PUBLISHED content be edited in place?
5. Rollback: if immutability is adopted, what does restoring a previous version actually do to structure (modules/chapters/pages) as well as content?
6. Does versioning interact with the AI import/validation flow (`13-ai-content-import-validation`) — e.g. does every AI import create a new version automatically?

## Why this is deferred
The master context explicitly flags this as "probably useful, not an immediate
priority." Implementing it prematurely would add real complexity (immutability
rules, diffing, rollback UI) to systems (`06`, `07`, `11`, `13`) that don't yet need
it for a single learner using the app locally.

## Dependencies
- 06-course-structure, 07-content-system (would touch both if ever implemented)

## Implementation prompts that will eventually be required
*(None yet — revisit only after Phase 1 is stable and the need becomes concrete.)*

## Learning opportunities (for when this is revisited)
- Content versioning models (event-sourced history vs. snapshot-per-version)
- Immutability as a design constraint and its tradeoffs
- Diffing structured content
