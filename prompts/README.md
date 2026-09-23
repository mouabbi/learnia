# AI content-generation prompts — v1 drafts

This folder holds the prompt *templates* behind the CMS's AI-assisted
authoring flow: given a course idea, generate the whole structure, then
generate each module's content, its quiz, and the course's final exam.

These are first-draft prompts to review and iterate on — not final copy.
The actual runtime prompt builder lives in
`backend/src/learnia_backend/services/prompt_builder.py` (12-ai-prompt-builder)
and today only covers "propose the next module/chapter/page" one at a time.
The prompts here describe the *bigger* flow you want on top of that:
one-shot full structure, then per-module content+quiz, then a final exam.

## The flow, end to end

1. **Create course** → enter title + description.
2. **Generate structure** (`01-course-structure.md`) → paste into an LLM →
   get back the full Module → Chapter → Page → axes outline as JSON. Review/
   edit it, then commit it (creates the actual modules/chapters/pages rows).
3. **Per module — generate content** (`02-module-content.md`) → a prompt
   built from course title/description + that module's own metadata
   (title, summary, chapter/page skeleton from step 2) → LLM returns page
   content as JSON (+ a manifest of any media files it *wants*, since an
   LLM can't literally attach binary files — see "Media" below).
4. **Per module — generate the QCM** (`03-module-qcm.md`) → same module
   context + the content just generated → LLM returns an interview-grade
   question bank, not trivia.
5. **Generate the final exam** (`04-final-exam.md`) → full course context
   (every module's title/summary + chapter/page titles) → LLM returns ~100
   serious questions plus an estimated duration.

Every prompt ends in the same strict-JSON contract already used by
`prompt_builder.py` (`STRICT_JSON_INSTRUCTIONS`): no markdown fences, no
commentary, exact field names, single JSON value. That's what lets
`import_service.py`/`import_validation.py` parse the response mechanically
instead of a human copy-pasting it into forms by hand.

## Best-practice structure to keep across every prompt

Each prompt template is built from four blocks, in this order:

1. **Role + task** — one line saying who the model is acting as and what
   it's producing (e.g. "You are a senior curriculum designer... produce a
   course outline").
2. **Context** — everything already decided that this generation step must
   stay consistent with: course title/description, and (for module/QCM/
   exam prompts) the module or full-course outline generated in an earlier
   step. Never re-paste full page content into a later prompt if a short
   summary is enough — keeps prompts short and cheap.
3. **Depth/quality bar** — explicit instruction to reason like a real
   subject-matter expert/interviewer, cover fundamentals *and* advanced
   material, and avoid shallow trivia. This is the "interview-level, not
   memorization" requirement — stated once per prompt, not left implicit.
4. **Output contract** — the JSON schema to satisfy + the strict-JSON
   instructions, verbatim every time so parsing behavior never drifts
   between scopes.

## Media (images/diagrams/video) — open question, proposed direction

An LLM chat response can't attach a real binary file. Two options, and the
recommended one:

- **(Recommended) JSON only, with placeholder media references.** The
  content JSON can include an `image`/`video` block whose `source` is a
  *description* (`{"kind": "image", "alt": "diagram of...", "generate":
  "a diagram showing..."}`) instead of a URL. The CMS then either (a) lets
  the author upload the real asset afterward via 15-assets' Asset Picker
  and swap it in, or (b) pipes that description to an image-generation
  step later. This keeps the whole pipeline single-format (JSON) and
  reuses the asset system that already exists instead of inventing a
  zip-import path.
- **(Deferred) zip with a manifest.json + files.** Only worth building if
  you specifically want the LLM step itself (via a tool-using agent, not a
  plain chat prompt) to produce real generated images alongside content.
  Out of scope for v1 — note it here so it isn't lost, revisit once plain
  JSON-only content is working end to end.

## Files in this folder

- `01-course-structure.md` — title+description → full course outline.
- `02-module-content.md` — one module's outline → page content JSON.
- `03-module-qcm.md` — one module's content → its QCM question bank.
- `04-final-exam.md` — full course outline → the final exam.
