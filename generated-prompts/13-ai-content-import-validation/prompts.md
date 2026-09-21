# 13 — AI Content Import & Validation

## Purpose
Take pasted AI-generated JSON, validate it strictly against the target schema, show
precise errors, allow preview, and only then commit it into the platform.

## Concepts that must be covered
1. Import entry point per scope (course/module/chapter/page/QCM/exam) — paste JSON textarea/modal
2. Parsing (handle malformed JSON gracefully — syntax errors shown with line/position if possible)
3. Schema validation via Pydantic (reuse the exact models used elsewhere — no duplicate schemas)
4. Error reporting: map Pydantic `ValidationError` into a human-readable, field-by-field error list (not a raw stack trace)
5. Preview step: render the parsed content using the real block-renderer/exam UI before committing
6. Commit step: on approval, persist (DB rows + JSON files as per `07-content-system`) — must be atomic (don't leave partial structure on failure)
7. Partial import handling: e.g. importing a module that already has some chapters — merge vs. replace decision

## Questions to answer before implementation
- On import of a scope that already has content (e.g. re-importing a page), does it replace outright or require explicit confirmation? → Recommend always requiring an explicit "replace existing content" confirmation with a diff-ish summary (at minimum: "this will overwrite page X"), never silent overwrite.
- Where does parsing/validation happen — backend only, or also client-side pre-validation for faster feedback? → Recommend backend as the single source of truth (never trust client validation alone); optional lightweight client-side JSON.parse check purely for instant syntax-error feedback before hitting the API.

## Dependencies
- 07-content-system, 12-ai-prompt-builder

## Implementation prompts that will eventually be required
1. Import API endpoints per scope (validate-only + commit modes, or a two-step validate-then-commit)
2. Pydantic-error-to-human-readable-message mapper
3. Frontend: paste/import modal with syntax + schema error display
4. Frontend: preview step reusing real renderers
5. Atomic commit logic (transaction across DB + file writes; rollback story if file write fails after DB commit or vice versa)

## Learning opportunities
- Turning framework validation errors into good UX
- Atomicity across two storage systems (DB + filesystem) — a real distributed-write problem at small scale
- Designing a safe "preview before commit" workflow
