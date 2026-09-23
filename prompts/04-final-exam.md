# 04 — Final exam (full course outline → the certification-style exam)

Runs once, after every module's structure (and ideally content) exists.
Context is the whole course outline — every module's title/axis/summary
plus its chapter/page titles — not full page content, to keep this prompt
a reasonable size even for a large course.

## Prompt template

```
You are designing the final certification exam for an entire course on a
learning platform — the exam someone takes to prove they're ready for a
real technical interview or real-world work in this subject.

Course title: {{courseTitle}}
Course description/goal: {{courseDescription}}

Full course outline (every module this exam must draw from):
{{fullCourseOutlineJSON}}

Task: write a serious, comprehensive final exam of AT LEAST 100
multiple-choice questions, covering every module above (roughly
proportional to how much of the course each module represents — don't
skip any module entirely).
- Same difficulty mix and "test understanding, not memorization" bar as
  the per-module quizzes: fundamentals, applied/scenario-based, and
  advanced/expert-level questions, styled like a real technical-interview
  screening exam.
- Include a handful of cross-module questions that connect concepts from
  different modules — the final exam is the one place that should test
  whether the learner can combine what they learned, not just recall each
  module in isolation.
- Each question needs 3-5 plausible options, one or more correct option
  ids, a short explanation, and a difficulty ("easy"|"medium"|"hard").

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

## Notes / TODO for v2 — implemented as of this pass

- Matches `prompt_builder.py`'s `build_final_exam_prompt`, which now
  returns a bare `QuestionWriteRequest` array (this draft's field-name fix
  — `text`, not `prompt` — landed there too) and states the same
  cross-module + interview-grade bar described above.
- Estimated duration is intentionally NOT asked of the LLM: the platform
  already derives `FinalExam.durationMinutes`
  (`schemas/courses.py`/`course_repository.py`, currently a
  `theme.get("finalExamDurationMinutes", 30)` heuristic) from the actual
  committed question count, which is more reliable than trusting a
  model's guess and avoids reshaping the response into a wrapper object
  the importer would need special-casing for.
