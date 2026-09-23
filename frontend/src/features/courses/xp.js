// Client-side XP/level derivation — no backend concept of "XP" exists yet,
// so this is computed from the same progress data the rest of the app
// already reads: earned learning points (per fully-read chapter) plus
// points for every *passed* quiz attempt (module QCMs + the final exam).
// Kept intentionally simple: 1 progress point = 1 XP, level = XP / 100.

import { isQuizPassed } from './progress'

const XP_PER_LEVEL = 100

export function xpFromCourseProgress(course, progress) {
  if (!progress) return 0
  const completed = new Set(progress.completedPageIds ?? [])

  let xp = 0
  for (const courseModule of course.modules) {
    for (const chapter of courseModule.chapters) {
      const allRead = chapter.pages.length > 0 && chapter.pages.every((p) => completed.has(p.id))
      if (allRead) xp += chapter.points ?? 0
    }

    const attempt = progress.moduleQuizzes?.[courseModule.id]
    if (courseModule.quiz && isQuizPassed(attempt)) {
      xp += attempt.score * 10
    }
  }

  if (course.finalExam && isQuizPassed(progress.finalExam)) {
    xp += progress.finalExam.score * 20
  }

  return xp
}

export function levelFromXp(xp) {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1
  const intoLevel = xp % XP_PER_LEVEL
  return { level, intoLevel, xpForNextLevel: XP_PER_LEVEL, pct: Math.round((intoLevel / XP_PER_LEVEL) * 100) }
}
