# 17 — Dashboard

## Purpose
The landing view: courses overview, last-started course with a continue action,
recommendations, and basic learning stats.

## Concepts that must be covered
1. "Continue learning" card (last course + last position + progress %, from `08-learning-progress`)
2. Courses overview list/grid (title, content status badge, learning status badge, progress bar)
3. Recommendations (simple rule-based v1: e.g. "not started, READY status, no prerequisites unmet" — no AI/ML ranking)
4. Learning stats (e.g. courses in progress, courses completed, total time spent if tracked — decide if time-tracking is in scope for v1)
5. Layout composition (this is mostly an aggregation view over other systems' APIs, not new domain logic)

## Questions to answer before implementation
- Is time-spent tracking in scope for v1 (requires tracking session/page view durations, a nontrivial addition), or deferred? → Recommend **deferred** — the master context doesn't explicitly require it and it adds tracking complexity (page visibility, idle detection) not otherwise needed. Keep dashboard stats to counts/percentages derivable from existing data.
- Recommendation rule specifics (what exactly makes a course "recommended next")? → Recommend a simple rule: courses with content_status READY or PUBLISHED and learning_status NOT_STARTED, sorted by creation order; refine later if it feels arbitrary in practice.

## Dependencies
- 05-course-system, 08-learning-progress

## Implementation prompts that will eventually be required
1. Dashboard aggregation endpoint (continue-learning + course list + stats + recommendations in one call, or composed client-side from existing endpoints — decide based on actual payload size)
2. Frontend: dashboard layout (continue card, course grid, recommendations section)
3. Recommendation rule implementation (backend service function, isolated and testable)

## Learning opportunities
- Building an aggregation/read-model view over multiple domain systems
- Deciding "one fat endpoint vs. several small ones" for a dashboard — a real, common API design tradeoff
