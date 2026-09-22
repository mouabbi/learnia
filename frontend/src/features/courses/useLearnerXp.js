import { useEffect, useState } from 'react'
import { coursesApi } from './coursesApi'
import { xpFromCourseProgress, levelFromXp } from './xp'

// Fetches every course's full progress and sums it into a single XP/level
// figure for the topbar. Cheap for the mock data volume here — a real
// backend would expose a single aggregate endpoint instead.
export function useLearnerXp() {
  const [xp, setXp] = useState(null)

  useEffect(() => {
    let cancelled = false
    coursesApi.listCourses().then(async (summaries) => {
      let total = 0
      for (const summary of summaries) {
        const [course, progress] = await Promise.all([
          coursesApi.getCourse(summary.slug),
          coursesApi.getProgress(summary.id),
        ])
        total += xpFromCourseProgress(course, progress)
      }
      if (!cancelled) setXp(total)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return xp === null ? null : { xp, ...levelFromXp(xp) }
}
