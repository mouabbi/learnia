import { Clock, BookOpen, CheckCircle2, Sparkles } from 'lucide-react'
import { Skeleton } from '../../components/Skeleton'
import { COURSE_ICON_COMPONENTS } from './courseIcons'

// A gradient "thumbnail" per course icon, so the icon reads as a cover
// image rather than a small inline glyph. Cycled by a stable hash of the
// course id so the same course always gets the same color.
const THUMB_VARIANTS = ['thumb-indigo', 'thumb-amber', 'thumb-teal', 'thumb-rose']

function thumbVariant(id) {
  const hash = [...String(id)].reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
  return THUMB_VARIANTS[hash % THUMB_VARIANTS.length]
}

// Shared course card used by both the catalog (CoursesPage) and the home
// page's "Recommended for you" section — one layout to keep in sync.
// `progressPct` is optional: when passed (parent has already fetched the
// learner's progress for this course), a slim progress bar renders on the
// card instead of leaving it flat for started courses.
// `hasUnseenUpdate` is also optional: true when the admin changed this
// course's content/assessments since this learner last opened it (see
// backend schemas/courses.py's ProgressResponse.hasUnseenUpdate and
// schemas/dashboard.py's DashboardCourse.hasUnseenUpdate) — renders an
// "Updated" badge alongside/in place of the "Completed" one.
export function CourseCard({ course, progressPct, hasUnseenUpdate }) {
  const Icon = COURSE_ICON_COMPONENTS[course.icon] ?? BookOpen
  const started = typeof progressPct === 'number' && progressPct > 0
  const completed = started && progressPct >= 100
  return (
    // Opens the docs-style reader in its own browser tab rather than
    // navigating the current one — a plain <a target="_blank"> gets real
    // new-tab semantics; React Router's <Link> doesn't apply here since
    // we want a genuinely separate tab, not client-side SPA navigation.
    <a
      href={`/courses/${course.slug}/learn`}
      target="_blank"
      rel="noopener noreferrer"
      className={`course-card${completed ? ' course-card-complete' : ''}`}
    >
      <div
        className={`course-card-thumb ${course.image ? 'course-card-thumb-image' : thumbVariant(course.id)}`}
      >
        {course.image ? (
          <img src={course.image} alt="" className="course-card-thumb-img" />
        ) : (
          <Icon size={40} strokeWidth={1.6} aria-hidden="true" />
        )}
        {completed ? (
          <span className="course-card-badge course-card-badge-done">
            <CheckCircle2 size={13} /> Completed
          </span>
        ) : (
          course.difficulty && <span className="course-card-badge">{course.difficulty}</span>
        )}
        {hasUnseenUpdate && (
          <span className="course-card-badge course-card-badge-updated course-card-badge-left">
            <Sparkles size={13} /> Updated
          </span>
        )}
      </div>
      <div className="course-card-body">
        <h2>{course.title}</h2>
        {hasUnseenUpdate && (
          <p className="course-card-updated-note">
            This course changed since you last opened it — review what's new or retake the quiz/exam.
          </p>
        )}
        <p>{course.description}</p>
        <span className="course-card-meta">
          <Clock size={14} /> {course.estimatedMinutes} min
        </span>
        {started && (
          <div className="course-card-progress" aria-label={`${progressPct}% complete`}>
            <div className="course-card-progress-track">
              <div
                className={`course-card-progress-fill${completed ? ' course-card-progress-fill-done' : ''}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="course-card-progress-label">
              {completed ? (
                <>
                  <CheckCircle2 size={13} /> Completed
                </>
              ) : (
                `${progressPct}% complete`
              )}
            </span>
          </div>
        )}
      </div>
    </a>
  )
}

export function CourseCardSkeleton() {
  return (
    <div className="course-card course-card-skeleton">
      <Skeleton className="course-card-thumb-skeleton" height="6.5rem" />
      <div className="course-card-body">
        <Skeleton width="60%" height="1.1rem" />
        <Skeleton width="90%" height="0.85rem" />
        <Skeleton width="40%" height="0.85rem" />
      </div>
    </div>
  )
}
