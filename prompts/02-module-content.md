# 02 — Module content (module outline → page content JSON)

Runs once per module, after the structure (01) exists. Context is
deliberately narrow: course title/description + this one module's own
metadata + its chapter/page skeleton — not the whole course's content, to
keep the prompt short and the output focused.

## Prompt template

```
You are writing the full lesson content for one module of a course on a
learning platform. Page content is a list of typed "blocks" (heading,
paragraph, code, terminal, image, video, callout, list, table, quote).

Course title: {{courseTitle}}
Course description/goal: {{courseDescription}}

Target module: "{{moduleTitle}}" — axis: {{moduleAxis}}
Module summary: {{moduleSummary}}

Chapter/page skeleton to fill in (write content for every page listed):
{{chapterPageSkeletonJSON}}

Depth bar: write like a senior practitioner teaching a strong engineer
preparing for real interviews and real work — cover fundamentals AND the
non-obvious/advanced parts an expert would actually care about, with
concrete examples (real code where relevant), not vague summaries.

Media: you cannot attach real image/video files. Where a diagram or
screenshot would genuinely help, add an "image" block whose "generate"
field describes what it should show — a human or a later generation step
fills in the real asset. Never invent a fake URL.

Respond with STRICT JSON ONLY.
- No markdown code fences (no ``` anywhere).
- No commentary, no preamble, no explanation before or after the JSON.
- The JSON must match the schema below EXACTLY: the same field names, the
  same types, no extra fields, no missing required fields.
- Output a single JSON value — nothing else.

Block types available, and their exact fields (this mirrors the real block
schema in `schemas/content.py` — use ONLY these types and fields, nothing
invented):

- `heading` — { text, level (1-4; use level 1-2 for a page's own
  title/section titles, level 3-4 for subtitles), numbered (bool) }
- `paragraph` — { text }
- `code` — { code, language }
- `terminal` — { text } (rendered as a terminal/output panel, not code)
- `image` — { src, alt, caption } — see "Media" above: put your
  description in `alt`/`caption` and set `src` to `"generate:"` followed
  by what the image should show; never invent a fake real URL
- `video` — { src, caption } — same `"generate:"` convention as image
- `youtube` — { videoId, caption }
- `link` — { href, text }
- `quote` — { text, attribution }
- `callout` — { variant ("tip"|"warning"|"important"|"note"), text }
- `list` — { ordered (bool), items (array of strings) }
- `table` — { headers (array of strings), rows (array of arrays of strings) }

There is no separate "title"/"subtitle" block — a page's own title is a
field on the page itself (given in the skeleton above), and any
title/subtitle *within* the page body is a `heading` block at the
appropriate `level`.

JSON schema to satisfy:
{
  "type": "object",
  "properties": {
    "pages": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "title": { "type": "string" },
          "blocks": {
            "type": "array",
            "items": {
              "oneOf": [
                { "type": "object", "properties": { "type": { "const": "heading" }, "text": { "type": "string" }, "level": { "type": "integer" }, "numbered": { "type": "boolean" } }, "required": ["type", "text"] },
                { "type": "object", "properties": { "type": { "const": "paragraph" }, "text": { "type": "string" } }, "required": ["type", "text"] },
                { "type": "object", "properties": { "type": { "const": "code" }, "code": { "type": "string" }, "language": { "type": "string" } }, "required": ["type", "code"] },
                { "type": "object", "properties": { "type": { "const": "terminal" }, "text": { "type": "string" } }, "required": ["type", "text"] },
                { "type": "object", "properties": { "type": { "const": "image" }, "src": { "type": "string" }, "alt": { "type": "string" }, "caption": { "type": "string" } }, "required": ["type", "src"] },
                { "type": "object", "properties": { "type": { "const": "video" }, "src": { "type": "string" }, "caption": { "type": "string" } }, "required": ["type", "src"] },
                { "type": "object", "properties": { "type": { "const": "youtube" }, "videoId": { "type": "string" }, "caption": { "type": "string" } }, "required": ["type", "videoId"] },
                { "type": "object", "properties": { "type": { "const": "link" }, "href": { "type": "string" }, "text": { "type": "string" } }, "required": ["type", "href", "text"] },
                { "type": "object", "properties": { "type": { "const": "quote" }, "text": { "type": "string" }, "attribution": { "type": "string" } }, "required": ["type", "text"] },
                { "type": "object", "properties": { "type": { "const": "callout" }, "variant": { "type": "string", "enum": ["tip", "warning", "important", "note"] }, "text": { "type": "string" } }, "required": ["type", "text"] },
                { "type": "object", "properties": { "type": { "const": "list" }, "ordered": { "type": "boolean" }, "items": { "type": "array", "items": { "type": "string" } } }, "required": ["type", "items"] },
                { "type": "object", "properties": { "type": { "const": "table" }, "headers": { "type": "array", "items": { "type": "string" } }, "rows": { "type": "array", "items": { "type": "array", "items": { "type": "string" } } } }, "required": ["type", "headers", "rows"] }
              ]
            }
          }
        },
        "required": ["title", "blocks"]
      }
    }
  },
  "required": ["pages"]
}
```

## Notes / TODO for v2

- This now matches the *existing* `PageContent` block schema
  (`schemas/content.py`) field-for-field. Once wired in for real, generate
  the JSON schema straight from the Pydantic model
  (`PageContent.model_json_schema()`, same as `prompt_builder.py` does for
  every other scope via `_schema_block`) instead of the hand-written
  `oneOf` above — it's spelled out here only so it's readable without
  cross-referencing the code.
- `"generate:"`-prefixed `src` values are a convention invented for this
  draft, not something `ImageBlock`/`VideoBlock` or the frontend's
  renderer understand yet — the CMS content editor would need to detect
  that prefix and render a "needs a real asset" placeholder instead of
  trying to load it as a URL.
- One LLM call per module here, not one per page (unlike today's
  `build_page_prompt`, which is one page at a time) — matches how you
  described the flow ("for each module I will find an auto-generated
  prompt"). Cheaper and keeps a module's pages consistent with each other.
- The `generate` field on image/video blocks needs a real destination: at
  minimum, the CMS content editor should flag any block with a `generate`
  field as "needs a real asset" until an editor swaps it for a real one via
  15-assets' Asset Picker.
