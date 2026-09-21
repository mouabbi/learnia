# 12 — AI Prompt Builder

## Purpose
Generate copy-pasteable prompts (for external AI chat tools) that request strictly
valid JSON matching the platform's schemas, for various generation scopes.

## Concepts that must be covered
1. Prompt templates per scope: entire course, module, chapter, page, module QCM (≥50 questions), final exam (100 questions)
2. Template variables: course title, goal, level, roadmap/context, target module/chapter/page, requirements, JSON schema to satisfy
3. Schema injection: the prompt must embed the exact target Pydantic/JSON schema (generated from the actual schema definitions, not hand-duplicated, to avoid drift)
4. Strict-JSON instructions (no markdown fences, no commentary, exact field names/types)
5. Context assembly: for a "generate chapter 3" prompt, what prior context (course roadmap, sibling chapters) should be included so content stays coherent?
6. UI: a builder form (pick scope, fill variables) → generated prompt → copy button

## Questions to answer before implementation
- Should the schema embedded in the prompt be auto-generated from the Pydantic models (e.g. via `model_json_schema()`) to guarantee it never drifts from the real validator? → Strongly recommend yes — this is the single biggest risk (prompt schema and validator schema silently diverging over time).
- How much surrounding course context gets included for a single-chapter/page generation (to keep tone/level consistent) vs. keeping prompts short? → Recommend including a compact course summary (title, goal, level, module/chapter list) always, plus immediate siblings for a page-level generation; avoid dumping entire course content into every prompt.

## Dependencies
- 06-course-structure, 07-content-system, 09-assessment-qcm, 10-final-exam (needs their schemas to embed)

## Implementation prompts that will eventually be required
1. Prompt template engine (variables + template strings per scope)
2. Auto-generate JSON schema snippets from Pydantic models for embedding
3. Prompt Builder UI (scope selector, variable form, generated output, copy button)
4. Context-assembly service (pull course/module/chapter context for a given scope)

## Learning opportunities
- Prompt engineering as a structured, templated discipline (not ad hoc)
- Keeping a single source of truth (schema) shared between validation and prompt generation
- Designing for a "human in the loop" AI workflow before adding a live API integration
