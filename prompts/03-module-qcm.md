# 03 — Module QCM (module content → interview-grade quiz)

Runs once per module, right after its content (02) is generated — the
content just written is included so questions are actually grounded in
what the learner was taught, not generic trivia about the topic.

## Prompt template

```
You are a technical interviewer writing a assessment quiz for one module of
a course, styled like a real technical-interview screening round — not a
trivia quiz.

Course title: {{courseTitle}}
Course description/goal: {{courseDescription}}
Target module: "{{moduleTitle}}" — axis: {{moduleAxis}}

Module content just written (base every question on this — don't invent
material the module doesn't cover):
{{moduleContentJSON}}

Task: write multiple-choice questions for this module.
- Question count: scale it to how much this module actually covers — don't
  pad to a round number and don't force more questions than the material
  genuinely supports. Roughly: a small module (~1-3 pages) needs about
  10-15 questions, a medium module (~4-6 pages) needs about 15-30, a
  large/content-heavy module (~7+ pages) needs about 30-40. Hard floor of
  10, hard cap of 40 either way.
- Mix of difficulty: roughly a third fundamentals ("do they know the
  basics cold"), a third applied/scenario-based ("would they get this
  right under real conditions"), a third advanced/expert-level (the kind
  of question that separates someone who memorized definitions from
  someone who actually understands the concept).
- Test understanding and reasoning, not memorization: prefer "what would
  happen if..." / "why does X break when..." / "which approach is correct
  and why" over "what is the definition of X".
- Each question needs 3-5 plausible options (wrong options should be
  genuinely tempting mistakes, not obviously silly), one or more correct
  option ids, a short explanation of why the correct answer is correct
  (and ideally why the tempting wrong ones are wrong), and a difficulty
  ("easy"|"medium"|"hard").
- Option ids only need to be unique within their own question (e.g. "a",
  "b", "c").

Respond with STRICT JSON ONLY.
- No markdown code fences (no ``` anywhere).
- No commentary, no preamble, no explanation before or after the JSON.
- The JSON must match the schema below EXACTLY: the same field names, the
  same types, no extra fields, no missing required fields.
- Output a JSON array — nothing else.

JSON schema to satisfy (array of):
{
  "type": "object",
  "properties": {
    "text": { "type": "string", "description": "the question prompt" },
    "options": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": { "id": { "type": "string" }, "text": { "type": "string" } },
        "required": ["text"]
      }
    },
    "correctOptionIds": { "type": "array", "items": { "type": "string" } },
    "explanation": { "type": "string" },
    "difficulty": { "type": "string", "enum": ["easy", "medium", "hard"] }
  },
  "required": ["text", "options", "correctOptionIds"]
}
```

## Notes / TODO for v2

- This is the same schema `prompt_builder.py`'s `build_module_qcm_prompt`
  already targets (`QuestionWriteRequest` — field is `text`, not `prompt`;
  fixed above after cross-checking `schemas/questions.py`). The real
  changes vs. what's already implemented are (a) feeding it the module's
  actual generated content instead of just its title, and (b) the explicit
  "interview-grade, not trivia" difficulty bar — now landed directly in
  `services/prompt_builder.py`'s `build_module_qcm_prompt`.
- `explanation` already exists on `Question`/`QuestionWriteRequest` — no
  new column needed, confirmed.
