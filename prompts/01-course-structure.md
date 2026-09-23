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
- 4-8 modules or more , each covering one coherent theme/skill area ("axis") of the
  subject, ordered from foundational to advanced.
- Each module broken into 2-5 chapters or more .
- Each chapter broken into 2-6 pages or more  (page = one focused lesson/topic, not
  a whole chapter's worth of content).
- For each module, also state its "axis": the one core competency or theme
  it exists to build (used to keep quiz/exam generation aligned with what
  was actually taught).

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
