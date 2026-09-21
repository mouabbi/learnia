# 14 — Global Search

## Purpose
Azure-Portal/Google-Cloud-Console-style global search across courses, structure,
content, and notes, with direct navigation to results.

## Concepts that must be covered
1. Search index scope (v1): courses, modules, chapters, pages (title + content text), notes
2. Indexing strategy: SQLite FTS5 (full-text search extension) vs. a simple `LIKE`-based search vs. an external engine (Elasticsearch/Meilisearch — likely overkill for single-user local)
3. Result ranking (basic relevance: title match > content match; recency as tiebreaker)
4. Result → navigation mapping (each result type resolves to a specific route/deep link)
5. Search UI: global command-palette-style trigger (keyboard shortcut, accessible from anywhere)
6. Debounced query-as-you-type

## Questions to answer before implementation
- SQLite FTS5 vs. plain `LIKE` queries for v1? → Recommend **FTS5**: it's built into SQLite (no new infra), a genuine "real search engine concept" learning opportunity, and avoids `LIKE '%term%'` performance/relevance problems even at small scale.
- Does search need to index code block content specifically (e.g. searching for a function name inside a code block)? → Recommend yes, treat code block text as searchable content like any other text block, but don't add code-aware tokenization/syntax parsing in v1.

## Dependencies
- 06-course-structure, 07-content-system, 08-learning-progress (for notes)

## Implementation prompts that will eventually be required
1. FTS5 virtual table setup + sync strategy (triggers or explicit reindex-on-write)
2. Search API endpoint (query → ranked results across entity types)
3. Frontend: global search trigger (keyboard shortcut + always-accessible UI element)
4. Frontend: results list with type icons + navigation on click
5. Reindex-on-content-change wiring (when a page's JSON file changes, its indexed text must update)

## Learning opportunities
- Full-text search concepts (tokenization, ranking) via SQLite FTS5
- Keeping a search index in sync with source-of-truth data that lives partly outside the DB (JSON files)
- Building an accessible, keyboard-driven global UI pattern
