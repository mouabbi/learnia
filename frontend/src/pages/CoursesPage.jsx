import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Search } from 'lucide-react'
import { coursesApi } from '../features/courses/coursesApi'
import { CourseCard, CourseCardSkeleton } from '../features/courses/CourseCard'
import { learningProgress } from '../features/courses/progress'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'in-progress', label: 'In progress' },
  { id: 'not-started', label: 'Not started' },
  { id: 'completed', label: 'Completed' },
]

// Course catalog — currently backed by mock data (see
// features/courses/mockCourses.js) standing in for the future course API.
export function CoursesPage() {
  const [courses, setCourses] = useState(null)
  // Map of courseId -> completion percentage, fetched alongside the course
  // list so cards can show progress and the filter chips can work.
  const [progressByCourse, setProgressByCourse] = useState({})
  // Map of courseId -> hasUnseenUpdate (see progress.hasUnseenUpdate),
  // fetched from the same per-course progress call as progressByCourse —
  // no extra round trip.
  const [updatedByCourse, setUpdatedByCourse] = useState({})
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    let cancelled = false
    coursesApi.listCourses().then(async (data) => {
      if (cancelled) return
      setCourses(data)

      const entries = await Promise.all(
        data.map(async (summary) => {
          const [course, progress] = await Promise.all([
            coursesApi.getCourse(summary.slug),
            coursesApi.getProgress(summary.id),
          ])
          const pct = learningProgress(course, progress.completedPageIds).pct
          return [summary.id, pct, progress.hasUnseenUpdate]
        }),
      )
      if (!cancelled) {
        setProgressByCourse(Object.fromEntries(entries.map(([id, pct]) => [id, pct])))
        setUpdatedByCourse(Object.fromEntries(entries.map(([id, , updated]) => [id, updated])))
      }
    }).catch((error) => {
      if (cancelled) return
      console.error('Failed to load courses', error)
      setCourses([])
    })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    if (!courses) return []
    const q = query.trim().toLowerCase()
    return courses.filter((course) => {
      const matchesQuery =
        !q || course.title.toLowerCase().includes(q) || course.description.toLowerCase().includes(q)
      if (!matchesQuery) return false

      const pct = progressByCourse[course.id] ?? 0
      if (filter === 'in-progress') return pct > 0 && pct < 100
      if (filter === 'not-started') return pct === 0
      if (filter === 'completed') return pct >= 100
      return true
    })
  }, [courses, query, filter, progressByCourse])

  return (
    <section>
      <h1>Courses</h1>
      <p className="hint">Pick a course to start learning.</p>

      <div className="courses-toolbar">
        <div className="courses-search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            placeholder="Search courses…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search courses"
          />
        </div>
        <div className="courses-filters" role="group" aria-label="Filter by progress">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`filter-chip ${filter === f.id ? 'filter-chip-active' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="course-grid">
        {courses === null && (
          <>
            <CourseCardSkeleton />
            <CourseCardSkeleton />
          </>
        )}

        {courses !== null && filtered.length === 0 && (
          <p className="hint courses-empty">No courses match your search.</p>
        )}

        {filtered.map((course, index) => (
          <motion.div
            key={course.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <CourseCard
              course={course}
              progressPct={progressByCourse[course.id]}
              hasUnseenUpdate={updatedByCourse[course.id]}
            />
          </motion.div>
        ))}
      </div>
    </section>
  )
}
