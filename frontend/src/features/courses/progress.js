// Pure scoring/progress math — no I/O. Given a course (Module → Chapter →
// Page, see mockCourses.js) and stored progress, compute the numbers the
// UI cares about:
//
//   1. Learning progress — how much of the course content has been read,
//      weighted by each chapter's `points` (its share of the course), with
//      partial credit inside a chapter proportional to pages read.
//   2. Score — globalScore = 0.2 × moduleQcmScore + 0.8 × finalExamScore.
//      Only *passed* attempts contribute points — an unpassed QCM counts
//      as 0, not a partial score, so gaming a low score doesn't inflate
//      the total.

export const PASSING_PCT = 80
export const RETAKE_COOLDOWN_MS = 10 * 60 * 1000

export function courseChapters(course) {
  return course.modules.flatMap((m) => m.chapters)
}

export function coursePoints(course) {
  return courseChapters(course).reduce((sum, c) => sum + (c.points ?? 0), 0)
}

export function modulePages(courseModule) {
  return courseModule.chapters.flatMap((c) => c.pages)
}

// Partial credit within a chapter (pages read / pages total) rather than
// all-or-nothing per chapter — smoother feedback while working through a
// long chapter, same total/earned/pct return shape as before.
export function learningProgress(course, completedPageIds) {
  const total = coursePoints(course)
  const completed = new Set(completedPageIds)
  const earned = courseChapters(course).reduce((sum, chapter) => {
    const pages = chapter.pages
    if (pages.length === 0) return sum
    const done = pages.filter((p) => completed.has(p.id)).length
    return sum + (chapter.points ?? 0) * (done / pages.length)
  }, 0)
  return { earned: Math.round(earned), total, pct: total > 0 ? Math.round((earned / total) * 100) : 0 }
}

export function attemptPct(attempt) {
  if (!attempt || !attempt.total) return 0
  return (attempt.score / attempt.total) * 100
}

export function isQuizPassed(attempt) {
  return attemptPct(attempt) >= PASSING_PCT
}

// moduleQuizzes: moduleId -> { score, total, lastAttemptAt }
export function moduleQcmProgress(course, moduleQuizzes = {}) {
  const quizModules = course.modules.filter((m) => m.quiz)
  const total = quizModules.reduce((sum, m) => sum + m.quiz.questions.length, 0)
  const earned = quizModules.reduce((sum, m) => {
    const attempt = moduleQuizzes[m.id]
    return sum + (isQuizPassed(attempt) ? attempt.score : 0)
  }, 0)
  return { earned, total, pct: total > 0 ? Math.round((earned / total) * 100) : 0 }
}

export function finalExamProgress(course, finalExamAttempt) {
  const total = course.finalExam?.questions.length ?? 0
  const passed = isQuizPassed(finalExamAttempt)
  const earned = passed ? finalExamAttempt.score : 0
  return { earned, total, pct: total > 0 ? Math.round((earned / total) * 100) : 0 }
}

// globalScore = moduleQcmAverage × 0.20 + finalExamScore × 0.80
export function scoreProgress(course, moduleQuizzes, finalExamAttempt) {
  const modules = moduleQcmProgress(course, moduleQuizzes)
  const final = finalExamProgress(course, finalExamAttempt)
  const pct = Math.round(modules.pct * 0.2 + final.pct * 0.8)
  return { modules, final, pct }
}

// A module is "complete" once every one of its pages has been read and
// (if it has a QCM) that QCM has been passed — the gate for unlocking the
// next module and for showing the module's QCM as available.
export function isModuleComplete(courseModule, completedPageIds, moduleQuizzes = {}) {
  const pages = modulePages(courseModule)
  const completed = new Set(completedPageIds)
  const allPagesRead = pages.length === 0 || pages.every((p) => completed.has(p.id))
  if (!allPagesRead) return false
  if (!courseModule.quiz) return true
  return isQuizPassed(moduleQuizzes[courseModule.id])
}

// A module is locked until the previous module is complete (all pages
// read, and its QCM — if any — passed).
export function isModuleLocked(course, index, completedPageIds, moduleQuizzes = {}) {
  if (index === 0) return false
  const prev = course.modules[index - 1]
  return !isModuleComplete(prev, completedPageIds, moduleQuizzes)
}

export function isCourseComplete(course, completedPageIds, moduleQuizzes = {}) {
  return course.modules.every((m) => isModuleComplete(m, completedPageIds, moduleQuizzes))
}

// Retakes are allowed any time, but throttled to one attempt per 10
// minutes — enough of a gap to go re-read the module instead of
// brute-forcing the answer key. Returns milliseconds remaining, or 0.
export function retakeCooldownMs(lastAttemptAt) {
  if (!lastAttemptAt) return 0
  const remaining = RETAKE_COOLDOWN_MS - (Date.now() - lastAttemptAt)
  return remaining > 0 ? remaining : 0
}

export function formatCooldown(ms) {
  const totalSeconds = Math.ceil(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
