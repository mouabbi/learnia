# 01 — Course structure (title + description → full outline)

Runs once, right after a course is created (title + description only).
Produces the whole Module → Chapter → Page skeleton in one shot, plus the
"axes" (the handful of core themes/skills the course is organized around) —
review and edit before committing it as the real structure rows.

## Prompt template

```
You are a senior curriculum designer building a professional, in-depth
course outline for a self-paced learning platform.

Course title: {{courseTitle}}
Course description/goal: {{courseDescription}}

Task: design the FULL structure for this course, from A to Z:
- However many modules the subject genuinely needs — could be 2, could be
  10. Each module covers one coherent theme/skill area ("axis"), ordered
  foundational to advanced. Don't pad to a round number, don't force
  unrelated topics into one module just to have fewer of them.
- Each module broken into however many chapters IT needs — a narrow module
  might need just 1 chapter, a broad one might need 5+.
- Each chapter broken into however many pages IT needs — 1 page or 10,
  whatever the topic actually requires (page = one focused lesson/topic,
  not a whole chapter's worth of content). Let the subject decide every
  one of these numbers, never a target range.
- For each module, also state its "axis": the one core competency or theme
  it exists to build (used to keep quiz/exam generation aligned with what
  was actually taught).

Writing style: short AND deep — like a sharp interview-prep cheat sheet,
not a textbook and not a shallow bullet list either. Every sentence should
carry real information; cut filler and restated obviousness, but don't cut
substance just to be brief.

Depth bar: this is for someone preparing for real technical interviews and
real-world use, not a shallow overview. Structure the progression so it
builds from fundamentals to advanced/expert-level material an experienced
practitioner would expect a strong candidate to know — not just a list of
buzzwords.

Respond with STRICT JSON ONLY.
- No markdown code fences (no ``` anywhere).
- No commentary, no preamble, no explanation before or after the JSON.
- The JSON must match the schema below EXACTLY: the same field names, the
  same types, no extra fields, no missing required fields.
- Output a single JSON value — nothing else.

JSON schema to satisfy:
{
  "type": "object",
  "properties": {
    "modules": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "title": { "type": "string" },
          "axis": { "type": "string", "description": "the core skill/theme this module builds" },
          "summary": { "type": "string" },
          "chapters": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "title": { "type": "string" },
                "pages": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "title": { "type": "string" },
                      "goal": { "type": "string", "description": "one sentence: what the learner should be able to do after this page" }
                    },
                    "required": ["title", "goal"]
                  }
                }
              },
              "required": ["title", "pages"]
            }
          }
        },
        "required": ["title", "axis", "summary", "chapters"]
      }
    }
  },
  "required": ["modules"]
}
```

## Notes / TODO for v2

- `axis` and per-page `goal` aren't stored anywhere in the current schema
  (`models/module.py`, `models/page.py`) — either add columns for them or
  fold `axis` into the module's existing `summary`/theme content, and drop
  `goal` (or keep it only as authoring scratch data, never persisted).
- This is a bigger ask than `prompt_builder.py`'s current `build_module_prompt`
  (which proposes just the *next* module). This one-shot version needs its
  own builder method + its own import/commit path in
  `import_service.py`/`import_validation.py` (today's importer commits one
  module/chapter/page/page-content/question-bank at a time, scoped by
  `scope` — a `"full-structure"` scope would need to walk this whole tree
  and create every module/chapter/page row in one transaction).
