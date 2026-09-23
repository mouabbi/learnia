import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowRight, BookOpen, Flame, Trophy, CheckCircle2 } from 'lucide-react'
import { dashboardApi } from '../features/dashboard/dashboardApi'
import { CourseCard, CourseCardSkeleton } from '../features/courses/CourseCard'
import { Skeleton } from '../components/Skeleton'

// Landing view built from ONE aggregation call (GET /api/v1/dashboard — see
// backend/src/learnia_backend/routers/dashboard.py): a "continue learning"
// card, the full course grid (with this user's own progress on each),
// simple rule-based recommendations, and basic counts. No time-tracking in
// v1 — stats are counts/percentages only (see generated-prompts/
// 17-dashboard/prompts.md's resolved open questions).
//
// Self-contained: does not assume it's mounted at any particular route (see
// this file's own history/PR for the suggested route).
export function DashboardPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    dashboardApi.getDashboard().then((res) => {
      if (!cancelled) setData(res)
    }).catch((err) => {
      if (cancelled) return
      console.error('Failed to load dashboard', err)
      setError(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="home">
      <section className="content-card home-hello">
        <h1>Dashboard</h1>
        <p>Your courses, progress, and what to learn next.</p>
      </section>

      {error && (
        <p className="hint courses-empty">Couldn't load your dashboard. Try refreshing.</p>
      )}

      {data && <StatsRow stats={data.stats} />}

      {data === null && !error && <ContinueCardSkeleton />}
      {data?.continueLearning && <ContinueLearningCard entry={data.continueLearning} />}

      <section className="home-section">
        <div className="home-section-header">
          <h2>Your courses</h2>
        </div>
        <div className="course-grid">
          {data === null && (
            <>
              <CourseCardSkeleton />
              <CourseCardSkeleton />
            </>
          )}
          {data?.courses.map((course, index) => (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <CourseCard course={course} progressPct={course.progressPct} />
            </motion.div>
          ))}
          {data && data.courses.length === 0 && (
            <p className="hint courses-empty">No courses published yet.</p>
          )}
        </div>
      </section>

      {data && data.recommendations.length > 0 && (
        <section className="home-section">
          <div className="home-section-header">
            <h2>Recommended for you</h2>
            <Link to="/courses" className="home-see-all">
              See all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="course-grid">
            {data.recommendations.map((course, index) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <CourseCard course={course} />
              </motion.div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function ContinueLearningCard({ entry }) {
  const { course, progressPct, lastPageTitle } = entry
  const complete = progressPct >= 100
  const resumeHref = `/courses/${course.slug}/learn`

  return (
    <motion.section
      className={`continue-card continue-card-hero${complete ? ' continue-card-complete' : ''}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="continue-card-hero-top">
        <div className={`continue-card-icon${course.image ? ' continue-card-icon-image' : ''}`}>
          {course.image ? (
            <img src={course.image} alt="" className="continue-card-icon-img" />
          ) : complete ? (
            <CheckCircle2 size={26} />
          ) : (
            <BookOpen size={26} />
          )}
        </div>
        <div className="continue-card-body">
          <span className="continue-card-eyebrow">
            {complete ? 'Course complete' : 'Continue learning'}
          </span>
          <h2>{course.title}</h2>
          {complete ? (
            <p>Every page done.</p>
          ) : (
            lastPageTitle && <p>Next up: {lastPageTitle}</p>
          )}
        </div>
        <div className="continue-card-hero-actions">
          {/* Opens the reader in its own tab — see CourseCard.jsx for why a
              plain <a> is used instead of React Router's <Link>. */}
          <a href={resumeHref} target="_blank" rel="noopener noreferrer" className="continue-card-cta">
            {complete ? 'Review' : 'Resume'} <ArrowRight size={16} />
          </a>
        </div>
      </div>

      <div className="chapter-track">
        <div className="chapter-track-header">
          <span>{progressPct}% complete</span>
        </div>
        <div className="course-card-progress-track">
          <div
            className={`course-card-progress-fill${complete ? ' course-card-progress-fill-done' : ''}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </motion.section>
  )
}

function ContinueCardSkeleton() {
  return (
    <div className="continue-card continue-card-skeleton">
      <Skeleton circle width="3rem" height="3rem" />
      <div className="continue-card-body">
        <Skeleton width="30%" height="0.75rem" />
        <Skeleton width="55%" height="1.2rem" />
      </div>
    </div>
  )
}

function StatsRow({ stats }) {
  const items = [
    { icon: Flame, label: 'In progress', value: stats.inProgressCount },
    { icon: Trophy, label: 'Completed', value: stats.completedCount },
    { icon: BookOpen, label: 'Courses available', value: stats.totalCount },
  ]
  return (
    <section className="stats-strip">
      {items.map(({ icon: Icon, label, value }) => (
        <div key={label} className="stat-tile">
          <span className="stat-tile-icon">
            <Icon size={18} />
          </span>
          <div>
            <div className="stat-tile-value">{value}</div>
            <div className="stat-tile-label">{label}</div>
          </div>
        </div>
      ))}
    </section>
  )
}
