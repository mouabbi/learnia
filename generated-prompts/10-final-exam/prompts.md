# 10 — Final Exam

## Purpose
A serious, monitored-feel, full-screen exam experience — distinct from normal
learning and from module assessments. 100 questions, timer, no normal navigation.

## Concepts that must be covered
1. `final_exam_attempts` model: started_at, submitted_at (or auto-submitted_at on timeout), score, answers, status
2. 100-question bank + selection (fixed set vs. random subset from a larger generated pool)
3. Timer (server-authoritative end time, not just client-side countdown — client displays, server enforces)
4. Full-screen exam route: separate layout, no dashboard/nav chrome, browser back-navigation handling
5. Free navigation between questions + question navigator (grid showing answered/unanswered/flagged)
6. Review screen before final submission
7. Submission flow: confirm → "processing" simulated delay (~1 min) → results
8. Optional audio/animation hooks (assets provided later by user — build the extension points now, not the assets)
9. Auto-submit on timeout
10. Result calculation + how it feeds `globalScore` (80% weight, per `09-assessment-qcm`)
11. Retake policy for the final exam

## Questions to answer before implementation
- Can the final exam be retaken, and if so does a new attempt overwrite the score or keep history? → Recommend: retakes allowed (single-user learning tool, not a certification body), keep full attempt history, but the **latest** attempt is what counts toward `globalScore` (contrast with module assessments' "best score" — flag this asymmetry explicitly to the user when implementing, since it's a deliberate but non-obvious choice).
- Is the "~1 minute processing" purely cosmetic (setTimeout) or should it actually reflect real grading work? → Grading (multiple choice) is trivial/instant server-side; the delay is purely UX/immersion — implement as a frontend-only staged animation, don't fake backend latency.
- Full-screen enforcement: use the Fullscreen API (browser prompt) or just a full-viewport layout with no chrome? → Recommend a full-viewport layout (simpler, no permission prompts/quirks); true Fullscreen API is optional polish, not required for v1.

## Dependencies
- 09-assessment-qcm

## Implementation prompts that will eventually be required
1. Final exam question model + migration (or reuse question model from 09 with a `scope` discriminator)
2. Final exam attempt lifecycle endpoints (start, save answer, submit, auto-submit on timeout)
3. Server-authoritative timer logic
4. Frontend: full-screen exam layout/route (route guard preventing normal nav)
5. Frontend: question navigator + review screen
6. Frontend: submission + processing animation + results screen
7. Extension points for audio/animation assets (documented hook, no hardcoded assets)

## Learning opportunities
- Server-authoritative state (timers, scoring) vs. trusting the client
- Building an isolated full-screen app-within-an-app route
- Handling timeouts/auto-submit as a first-class flow, not an edge case
- Designing extension points for assets that don't exist yet
