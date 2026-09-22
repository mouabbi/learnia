import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  GitBranch,
  Code2,
  Globe,
  FlaskConical,
  ArrowRight,
  Flame,
  Trophy,
  Target,
  BookOpen,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  MailWarning,
} from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'
import { authApi } from '../features/auth/authApi'
import { coursesApi } from '../features/courses/coursesApi'
import { CourseCard, CourseCardSkeleton } from '../features/courses/CourseCard'
import {
  learningProgress,
  scoreProgress,
  isQuizPassed,
  isModuleComplete,
  PASSING_PCT,
} from '../features/courses/progress'
import { useLearnerXp } from '../features/courses/useLearnerXp'
import { ApiError } from '../api/client'
import { Skeleton } from '../components/Skeleton'

const ICONS = { GitBranch, Code2, Globe, FlaskConical }

// "Continue learning" only has room for a handful of cards before it
// crowds out the recommendations below it.
const MAX_CONTINUE_CARDS = 3

// Rendered inside AppLayout (see App.jsx) — only reachable once /auth/me
// has confirmed a logged-in user. The main landing spot: a "continue where
// you left off" card, a couple of stats, then recommendations.
export function HomePage() {
  const { user } = useAuth()
  const displayName = user.email.split('@')[0]
  const [courses, setCourses] = useState(null)
  const [inProgress, setInProgress] = useState(null)
  const learnerXp = useLearnerXp()

  useEffect(() => {
    let cancelled = false
    coursesApi.listCourses().then(async (list) => {
      if (cancelled) return
      setCourses(list)

      // Find up to MAX_CONTINUE_CARDS courses with recorded progress to
      // feature as "Continue learning". In a real app this would come
      // from the learner's own attempt history, not a client-side scan.
      const found = []
      for (const course of list) {
        if (found.length >= MAX_CONTINUE_CARDS) break
        const progress = await coursesApi.getProgress(course.id)
        if (cancelled) return
        if (progress.completedPageIds.length > 0) {
          // listCourses() returns lightweight summaries without `modules`
          // (ContinueLearningCard needs the full module tree to resolve
          // the resume target), so fetch the full course here.
          const fullCourse = await coursesApi.getCourse(course.slug)
          if (cancelled) return
          found.push({ course: fullCourse, progress })
        }
      }
      setInProgress(found)
    }).catch((error) => {
      if (cancelled) return
      // Backend unreachable/erroring (e.g. no courses seeded yet) — fall
      // back to empty states rather than leaving the page stuck loading
      // and throwing an unhandled rejection into the console.
      console.error('Failed to load courses', error)
      setCourses([])
      setInProgress([])
    })
    return () => {
      cancelled = true
    }
  }, [])

  const inProgressIds = new Set(inProgress ? inProgress.map(({ course }) => course.id) : [])
  const recommended = courses?.filter((c) => !inProgressIds.has(c.id)) ?? []

  return (
    <div className="home">
      <section className="content-card home-hello">
        <h1>Hello, {displayName}</h1>
        <p>Welcome back to Learnia.</p>
      </section>

      {!user.email_verified && <VerifyEmailBanner />}

      {courses && <StatsStrip courses={courses} inProgress={inProgress} learnerXp={learnerXp} />}

      {inProgress === null && <ContinueCardSkeleton />}
      {inProgress &&
        inProgress.map(({ course, progress }) => (
          <ContinueLearningCard key={course.id} course={course} progress={progress} />
        ))}

      <section className="home-section">
        <div className="home-section-header">
          <h2>Recommended for you</h2>
          <Link to="/courses" className="home-see-all">
            See all <ArrowRight size={14} />
          </Link>
        </div>

        <div className="course-grid">
          {courses === null && (
            <>
              <CourseCardSkeleton />
              <CourseCardSkeleton />
            </>
          )}
          {courses !== null &&
            recommended.map((course, index) => (
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
    </div>
  )
}

function ContinueLearningCard({ course, progress }) {
  const Icon = ICONS[course.icon] ?? BookOpen
  const completed = progress.completedPageIds

  // Resume at the page the learner left off on, falling back to the first
  // not-yet-completed page, then the very first page.
  const allPages = course.modules.flatMap((m) => m.chapters.flatMap((c) => c.pages))
  const resumePage =
    allPages.find((p) => p.id === progress.lastPageId) ??
    allPages.find((p) => !completed.includes(p.id)) ??
    allPages[0]

  const learning = learningProgress(course, completed)
  const score = scoreProgress(course, progress.moduleQuizzes, progress.finalExam)

  const passed = score.pct >= PASSING_PCT
  const complete = learning.pct >= 100
  const resumeHref = resumePage
    ? `/courses/${course.slug}/learn?page=${resumePage.id}`
    : `/courses/${course.slug}/learn`

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
            <Icon size={26} />
          )}
        </div>
        <div className="continue-card-body">
          <span className="continue-card-eyebrow">{complete ? 'Course complete' : 'Continue learning'}</span>
          <h2>{course.title}</h2>
          {complete ? <p>Every module and QCM done.</p> : resumePage && <p>Next up: {resumePage.title}</p>}
        </div>
        <div className="continue-card-hero-actions">
          <span className={`score-chip ${passed ? 'score-chip-passed' : ''}`}>
            {passed ? <Trophy size={14} aria-hidden="true" /> : <Target size={14} aria-hidden="true" />}
            {score.pct}/100
          </span>
          {/* Opens the reader in its own tab, not client-side SPA nav —
              see CourseCard.jsx for why a plain <a> is used here. */}
          <a href={resumeHref} target="_blank" rel="noopener noreferrer" className="continue-card-cta">
            {complete ? 'Review' : 'Resume'} <ArrowRight size={16} />
          </a>
        </div>
      </div>

      <ModuleTrack course={course} progress={progress} learning={learning} />
    </motion.section>
  )
}

// A DataCamp-style skill-track bar: one segment per module (done / current
// / upcoming/locked) instead of a single filled bar, so the shape of the
// course — not just a percentage — is visible at a glance.
function ModuleTrack({ course, progress, learning }) {
  const completed = new Set(progress.completedPageIds)
  return (
    <div className="chapter-track">
      <div className="chapter-track-header">
        <span>
          {learning.earned}/{learning.total} pts
        </span>
        <span>{learning.pct}% complete</span>
      </div>
      <div className="chapter-track-bar">
        {course.modules.map((courseModule) => {
          const done = isModuleComplete(courseModule, [...completed], progress.moduleQuizzes)
          const pages = courseModule.chapters.flatMap((c) => c.pages)
          const started = pages.some((p) => completed.has(p.id))
          const state = done ? 'done' : started ? 'current' : 'upcoming'
          return (
            <span
              key={courseModule.id}
              className={`chapter-segment chapter-segment-${state}`}
              title={courseModule.title}
            />
          )
        })}
      </div>
    </div>
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

function StatsStrip({ courses, inProgress, learnerXp }) {
  const totalCourses = courses.length
  const completedPages = inProgress
    ? inProgress.reduce((sum, { progress }) => sum + progress.completedPageIds.length, 0)
    : 0
  const examsPassed = inProgress
    ? inProgress.filter(({ progress }) => isQuizPassed(progress.finalExam)).length
    : 0
  const stats = [
    { icon: BookOpen, label: 'Courses available', value: totalCourses },
    { icon: Flame, label: 'Pages completed', value: completedPages },
    { icon: Trophy, label: 'Exams passed', value: examsPassed },
    { icon: Sparkles, label: 'XP earned', value: learnerXp ? learnerXp.xp : '—' },
  ]
  return (
    <section className="stats-strip">
      {stats.map(({ icon: Icon, label, value }) => (
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

// Shown only while the account's email is unverified (see users.email_verified_at).
function VerifyEmailBanner() {
  const [status, setStatus] = useState('idle') // idle | sending | sent | error

  async function handleResend() {
    setStatus('sending')
    try {
      await authApi.sendVerificationEmail()
      setStatus('sent')
    } catch (err) {
      setStatus(err instanceof ApiError ? err.message : 'Something went wrong')
    }
  }

  return (
    <div role="status" className="banner banner-warning">
      <AlertTriangle size={20} className="banner-icon" aria-hidden="true" />
      <div className="banner-body">
        <p className="banner-title">Your email isn't verified yet</p>
        <p className="banner-caption">
          Verify it to make sure you can recover your account and receive important updates.
        </p>
        {status === 'sent' ? (
          <p className="banner-status banner-status-ok">
            <CheckCircle2 size={14} /> Sent — check your inbox.
          </p>
        ) : status !== 'idle' && status !== 'sending' ? (
          <p role="alert" className="banner-status banner-status-error">
            <MailWarning size={14} /> {status}
          </p>
        ) : (
          <button type="button" className="banner-action" disabled={status === 'sending'} onClick={handleResend}>
            {status === 'sending' ? 'Sending…' : 'Resend verification email'}
          </button>
        )}
      </div>
    </div>
  )
}
