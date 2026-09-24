import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ArrowRight, CheckSquare, GraduationCap, PartyPopper, Sparkles, X } from 'lucide-react'
import { coursesApi } from '../features/courses/coursesApi'
import { Quiz } from '../features/courses/Quiz'
import { Skeleton } from '../components/Skeleton'
import { ReaderShell } from '../components/reader/ReaderShell'
import { BlockRenderer } from '../features/cms/BlockRenderer'
import '../features/cms/cms.css'
import { markPageComplete, setLastPage, markContentSeen } from '../features/courses/progressStore'
import {
  learningProgress,
  isModuleLocked as computeModuleLocked,
  isModuleComplete,
  isQuizPassed,
  isCourseComplete,
} from '../features/courses/progress'
import { shade, contrastText } from '../utils/color'

// Flattens Module > Chapter > Page into an ordered list with back-refs, so
// "next"/"end of module" can be computed by array position instead of
// re-walking the tree on every click.
function flattenPages(course) {
  const list = []
  course.modules.forEach((courseModule, moduleIndex) => {
    courseModule.chapters.forEach((chapter) => {
      chapter.pages.forEach((coursePage) => {
        list.push({ moduleIndex, module: courseModule, chapter, page: coursePage })
      })
    })
  })
  return list
}

// Docs-style reader for a single course — opened in its own browser tab
// (see CourseCard/ContinueLearningCard), outside the main AppLayout shell.
// Route: /courses/:slug/learn (see App.jsx). Owns all progress state for
// the session and persists every change via progressStore.js.
export function CourseReaderPage() {
  const { slug } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [course, setCourse] = useState(null)
  const [completedPageIds, setCompletedPageIds] = useState(() => new Set())
  const [moduleQuizzes, setModuleQuizzes] = useState({})
  const [expandedModuleIds, setExpandedModuleIds] = useState(() => new Set())
  const [view, setView] = useState(null) // { kind: 'page', pageId } | { kind: 'quiz', moduleId } | { kind: 'done' }
  // Last non-quiz page shown — kept so the quiz can render as a modal on
  // top of it instead of replacing the whole content pane.
  const [backdropPageId, setBackdropPageId] = useState(null)
  const [loadError, setLoadError] = useState(null)
  // True for the rest of THIS visit if the course had unseen changes when
  // the reader opened — kept even after markContentSeen() dismisses it
  // server-side, so the banner doesn't vanish mid-read; it just won't
  // reappear on the next visit.
  const [showUpdateBanner, setShowUpdateBanner] = useState(false)

  useEffect(() => {
    let cancelled = false
    setCourse(null)
    setLoadError(null)
    coursesApi.getCourse(slug).then(async (data) => {
      if (cancelled) return
      setCourse(data)

      const progress = await coursesApi.getProgress(data.id)
      if (cancelled) return
      const completed = new Set(progress.completedPageIds)
      setCompletedPageIds(completed)
      setModuleQuizzes(progress.moduleQuizzes)
      if (progress.hasUnseenUpdate) {
        setShowUpdateBanner(true)
        // Fire-and-forget: dismiss the badge/banner for next time now that
        // they've opened the reader — a failed request just means it'll
        // show again next visit, which is harmless.
        markContentSeen(data.id).catch(() => {})
      }

      const flat = flattenPages(data)
      const pageExists = (id) => flat.some((f) => f.page.id === id)
      const moduleLockedAt = (moduleIndex) => computeModuleLocked(data, moduleIndex, [...completed], progress.moduleQuizzes)

      const quizParam = searchParams.get('quiz')
      const pageParam = searchParams.get('page')

      let initialView = null
      if (quizParam && data.modules.some((m) => m.id === quizParam)) {
        initialView = { kind: 'quiz', moduleId: quizParam }
      } else if (pageParam && pageExists(pageParam)) {
        const entry = flat.find((f) => f.page.id === pageParam)
        if (!moduleLockedAt(entry.moduleIndex)) initialView = { kind: 'page', pageId: pageParam }
      }
      if (!initialView && pageExists(progress.lastPageId)) {
        const entry = flat.find((f) => f.page.id === progress.lastPageId)
        if (!moduleLockedAt(entry.moduleIndex)) initialView = { kind: 'page', pageId: progress.lastPageId }
      }
      if (!initialView) {
        const first = flat[0]
        initialView = first ? { kind: 'page', pageId: first.page.id } : { kind: 'done' }
      }

      setView(initialView)
      if (initialView.kind === 'page') setBackdropPageId(initialView.pageId)
      const activeModuleIndex = flat.find(
        (f) => (initialView.kind === 'page' && f.page.id === initialView.pageId) ||
          (initialView.kind === 'quiz' && f.module.id === initialView.moduleId),
      )?.moduleIndex ?? 0
      setExpandedModuleIds(new Set([data.modules[activeModuleIndex]?.id].filter(Boolean)))
    }).catch((error) => {
      if (cancelled) return
      // Course doesn't exist, or the backend errored — surface a plain
      // error state instead of leaving the reader stuck on its skeleton
      // forever and throwing an unhandled rejection into the console.
      console.error(`Failed to load course "${slug}"`, error)
      setLoadError(error)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  const flat = useMemo(() => (course ? flattenPages(course) : []), [course])

  if (loadError) {
    return (
      <div className="reader-shell reader-load-error">
        <p>Couldn't load this course. It may not exist, or the server is unavailable.</p>
        <Link to="/courses">Back to courses</Link>
      </div>
    )
  }

  if (course === null || view === null) return <ReaderSkeleton />

  const learning = learningProgress(course, [...completedPageIds])
  const allModulesDone = isCourseComplete(course, [...completedPageIds], moduleQuizzes)

  function moduleLocked(moduleIndex) {
    return computeModuleLocked(course, moduleIndex, [...completedPageIds], moduleQuizzes)
  }

  function modulePagesComplete(courseModule) {
    return isModuleComplete({ ...courseModule, quiz: null }, [...completedPageIds], moduleQuizzes)
  }

  function moduleQuizPassed(moduleId) {
    return isQuizPassed(moduleQuizzes[moduleId])
  }

  function goToPage(pageId) {
    setView({ kind: 'page', pageId })
    setBackdropPageId(pageId)
    setSearchParams({ page: pageId }, { replace: true })
    // Fire-and-forget: local state above already reflects the move, this
    // just persists it — a failed request shouldn't block navigation.
    setLastPage(course.id, pageId).catch(() => {})
    const entry = flat.find((f) => f.page.id === pageId)
    if (entry) setExpandedModuleIds((prev) => new Set(prev).add(entry.module.id))
  }

  function closeQuizModal() {
    if (backdropPageId) goToPage(backdropPageId)
  }

  function goToQuiz(moduleId) {
    setView({ kind: 'quiz', moduleId })
    setSearchParams({ quiz: moduleId }, { replace: true })
  }

  function toggleModule(moduleId) {
    setExpandedModuleIds((prev) => {
      const next = new Set(prev)
      if (next.has(moduleId)) next.delete(moduleId)
      else next.add(moduleId)
      return next
    })
  }

  function markComplete(pageId) {
    markPageComplete(course.id, pageId).catch(() => {})
    setCompletedPageIds((prev) => new Set(prev).add(pageId))
  }

  // "Next" advances through pages in reading order; at the end of a module
  // it routes into that module's QCM (if any and not yet passed) instead
  // of a page, and at the very end of the course it shows a completion
  // panel pointing at the final exam.
  function goNext(currentPageId) {
    markComplete(currentPageId)
    const index = flat.findIndex((f) => f.page.id === currentPageId)
    const current = flat[index]
    const next = flat[index + 1]
    const leavingModule = !next || next.moduleIndex !== current.moduleIndex

    if (leavingModule && current.module.quiz && !isQuizPassed(moduleQuizzes[current.module.id])) {
      goToQuiz(current.module.id)
      return
    }
    if (next) {
      goToPage(next.page.id)
      return
    }
    setView({ kind: 'done' })
  }

  // "Previous" just steps back in reading order — no quiz-gate to worry
  // about since anything earlier was already unlocked to get here.
  function goPrev(currentPageId) {
    const index = flat.findIndex((f) => f.page.id === currentPageId)
    const prev = flat[index - 1]
    if (prev) goToPage(prev.page.id)
  }

  function handleQuizAttempt(moduleId, attempt) {
    setModuleQuizzes((prev) => ({ ...prev, [moduleId]: { ...attempt } }))
  }

  function continueAfterQuiz(moduleId) {
    const moduleIndex = course.modules.findIndex((m) => m.id === moduleId)
    const nextModule = course.modules[moduleIndex + 1]
    if (nextModule) {
      const firstPage = flat.find((f) => f.moduleIndex === moduleIndex + 1)
      setExpandedModuleIds((prev) => new Set(prev).add(nextModule.id))
      if (firstPage) goToPage(firstPage.page.id)
    } else {
      setView({ kind: 'done' })
    }
  }

  const accentStyle = course.color
    ? {
        '--course-accent': course.color,
        '--course-accent-hover': shade(course.color, -12),
        '--course-accent-text': contrastText(course.color),
      }
    : undefined

  return (
    <div className="reader-theme" style={accentStyle}>
      <ReaderShell
        course={course}
        learningPct={learning.pct}
        expandedModuleIds={expandedModuleIds}
        onToggleModule={toggleModule}
        isModuleLocked={moduleLocked}
        isPageComplete={(id) => completedPageIds.has(id)}
        isModulePagesComplete={modulePagesComplete}
        isModuleQuizPassed={moduleQuizPassed}
        activeKind={view.kind}
        activePageId={view.kind === 'page' ? view.pageId : null}
        activeModuleId={view.kind === 'quiz' ? view.moduleId : null}
        onSelectPage={goToPage}
        onSelectQuiz={goToQuiz}
        allModulesDone={allModulesDone}
        banner={
          showUpdateBanner && (
            <UpdateBanner
              course={course}
              onDismiss={() => setShowUpdateBanner(false)}
            />
          )
        }
      >
        {view.kind === 'page' && (
          <PageView
            key={view.pageId}
            course={course}
            entry={flat.find((f) => f.page.id === view.pageId)}
            pageNumber={flat.findIndex((f) => f.page.id === view.pageId) + 1}
            totalPages={flat.length}
            completed={completedPageIds.has(view.pageId)}
            hasPrev={flat.findIndex((f) => f.page.id === view.pageId) > 0}
            onMarkComplete={() => markComplete(view.pageId)}
            onNext={() => goNext(view.pageId)}
            onPrev={() => goPrev(view.pageId)}
          />
        )}

        {view.kind === 'quiz' && backdropPageId && (
          <PageView
            key={backdropPageId}
            course={course}
            entry={flat.find((f) => f.page.id === backdropPageId)}
            pageNumber={flat.findIndex((f) => f.page.id === backdropPageId) + 1}
            totalPages={flat.length}
            completed={completedPageIds.has(backdropPageId)}
            interactive={false}
          />
        )}

        {view.kind === 'done' && backdropPageId && (
          <PageView
            key={backdropPageId}
            course={course}
            entry={flat.find((f) => f.page.id === backdropPageId)}
            pageNumber={flat.findIndex((f) => f.page.id === backdropPageId) + 1}
            totalPages={flat.length}
            completed={completedPageIds.has(backdropPageId)}
            interactive={false}
          />
        )}
      </ReaderShell>

      {view.kind === 'quiz' && (
        <QuizModal
          key={view.moduleId}
          course={course}
          courseModule={course.modules.find((m) => m.id === view.moduleId)}
          previousAttempt={moduleQuizzes[view.moduleId]}
          onAttempt={(attempt) => handleQuizAttempt(view.moduleId, attempt)}
          passed={isQuizPassed(moduleQuizzes[view.moduleId])}
          onContinue={() => continueAfterQuiz(view.moduleId)}
          onClose={closeQuizModal}
        />
      )}

      {view.kind === 'done' && (
        <CourseDoneModal
          course={course}
          allModulesDone={allModulesDone}
          onClose={closeQuizModal}
        />
      )}
    </div>
  )
}

// Inline notice shown once per visit when the admin changed this course's
// content or assessments since the learner last opened it (see
// backend routers/courses.py's progress endpoint hasUnseenUpdate). Points
// at the final exam when the course has one, since that's the most likely
// thing worth retaking; module quizzes are already reachable inline from
// the sidebar/reader flow.
function UpdateBanner({ course, onDismiss }) {
  return (
    <div className="reader-update-banner" role="status">
      <Sparkles size={15} aria-hidden="true" />
      <span>
        This course was updated since you last opened it — you may want to review the new content
        {course.finalExam ? ' or retake the final exam.' : '.'}
      </span>
      {course.finalExam && (
        <Link to={`/courses/${course.slug}/exam`} className="reader-update-banner-cta">
          <GraduationCap size={14} aria-hidden="true" /> Retake exam
        </Link>
      )}
      <button
        type="button"
        className="reader-update-banner-close"
        aria-label="Dismiss update notice"
        onClick={onDismiss}
      >
        <X size={14} />
      </button>
    </div>
  )
}

function PageView({
  entry,
  pageNumber,
  totalPages,
  completed,
  hasPrev,
  onMarkComplete,
  onNext,
  onPrev,
  interactive = true,
}) {
  if (!entry) return null
  const { page: coursePage, chapter, module: courseModule } = entry
  const pagePct = totalPages ? Math.round((pageNumber / totalPages) * 100) : 0

  return (
    <motion.article
      className="reader-page content-card"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div className="reader-page-toolbar">
        <div className="reader-page-toolbar-top">
          <span className="reader-page-toolbar-position">
            Page {pageNumber} of {totalPages}
          </span>
          {interactive && (
            <div className="reader-page-toolbar-actions">
              <button
                type="button"
                className="reader-toolbar-button"
                disabled={!hasPrev}
                onClick={onPrev}
              >
                <ArrowLeft size={15} /> Previous
              </button>
              {!completed && (
                <button type="button" className="reader-toolbar-button" onClick={onMarkComplete}>
                  <CheckSquare size={15} /> Mark as read
                </button>
              )}
              <button type="button" className="reader-toolbar-button reader-toolbar-button-primary" onClick={onNext}>
                {completed ? 'Continue' : 'Mark read & continue'} <ArrowRight size={15} />
              </button>
            </div>
          )}
        </div>
        <div className="reader-page-toolbar-track">
          <motion.div
            className="reader-page-toolbar-fill"
            initial={false}
            animate={{ width: `${pagePct}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        </div>
      </div>

      <span className="reader-page-eyebrow">
        {courseModule.title} · {chapter.title}
      </span>
      <h1>{coursePage.title}</h1>
      <div className="reader-page-body">
        {coursePage.blocks && coursePage.blocks.length > 0 ? (
          <BlockRenderer blocks={coursePage.blocks} />
        ) : (
          // Legacy fallback: a page authored before blocks existed (or
          // whose content file is missing/unreadable) only has the
          // flattened plain-text string — still show something rather
          // than nothing.
          coursePage.content.split('\n\n').map((paragraph, i) => <p key={i}>{paragraph}</p>)
        )}
      </div>
    </motion.article>
  )
}

function QuizModal({ course, courseModule, previousAttempt, onAttempt, passed, onContinue, onClose }) {
  if (!courseModule?.quiz) return null
  return (
    <AnimatePresence>
      <motion.div
        className="quiz-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="quiz-modal content-card module-quiz-panel"
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" className="quiz-modal-close" aria-label="Close quiz" onClick={onClose}>
            <X size={18} />
          </button>
          <span className="reader-page-eyebrow">{courseModule.title}</span>
          <h1>Module QCM</h1>
          <p className="reader-quiz-intro">Pass this to unlock the next module.</p>
          <Quiz
            quiz={courseModule.quiz}
            courseId={course.id}
            moduleId={courseModule.id}
            previousAttempt={previousAttempt}
            onAttempt={onAttempt}
          />
          {passed && (
            <button type="button" className="reader-next-button" onClick={onContinue}>
              Continue <ArrowRight size={16} />
            </button>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// Big, kid-friendly "you did it!" celebration — pops up as a modal (same
// pattern as QuizModal) the moment every module + QCM in the course is
// done, with a bouncy badge and a confetti burst so finishing a course
// feels like an event, not just a status line changing.
const CHEER_LINES = [
  "You crushed it! 🎉",
  "Look at you go! 🚀",
  "Superstar move! 🌟",
  "Boom — nailed it! 💥",
  "You're on fire! 🔥",
]

function CourseDoneModal({ course, allModulesDone, onClose }) {
  const [cheer] = useState(() => CHEER_LINES[Math.floor(Math.random() * CHEER_LINES.length)])
  return (
    <AnimatePresence>
      <motion.div
        className="quiz-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="quiz-modal content-card course-done-modal"
          initial={{ opacity: 0, y: 24, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" className="quiz-modal-close" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>

          <DoneConfetti />

          <motion.div
            className="course-done-badge"
            initial={{ scale: 0, rotate: -15 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 12, delay: 0.1 }}
          >
            <PartyPopper size={36} />
          </motion.div>

          <motion.h1
            className="course-done-title"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {cheer}
          </motion.h1>
          <motion.p
            className="course-done-caption"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            You finished every module and passed every quiz in <strong>{course.title}</strong>. That's
            real work — be proud of it!
          </motion.p>

          <motion.div
            className="course-done-actions"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            {allModulesDone && course.finalExam ? (
              <Link to={`/courses/${course.slug}/exam`} className="continue-card-cta">
                <GraduationCap size={16} /> Take the final exam
              </Link>
            ) : (
              <p className="hint">This course doesn't have a final exam.</p>
            )}
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// Cheap CSS-only confetti burst, same trick as ExamPage's Confetti — a
// handful of absolutely positioned dots animating outward + fading.
function DoneConfetti() {
  const [pieces] = useState(() =>
    Array.from({ length: 24 }, (_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 360,
      y: Math.random() * -280 - 40,
      rotate: Math.random() * 360,
      color: ['#4f46e5', '#f59e0b', '#22c55e', '#ec4899', '#06b6d4'][i % 5],
      delay: Math.random() * 0.25,
    })),
  )
  return (
    <div className="confetti course-done-confetti" aria-hidden="true">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="confetti-piece"
          style={{ background: p.color }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: p.x, y: p.y, opacity: 0, rotate: p.rotate }}
          transition={{ duration: 1.2, delay: p.delay, ease: 'easeOut' }}
        />
      ))}
    </div>
  )
}

function ReaderSkeleton() {
  return (
    <div className="reader-shell">
      <div className="reader-topbar">
        <Skeleton width="6rem" height="0.9rem" />
      </div>
      <div className="reader-body">
        <div className="reader-sidebar">
          <Skeleton height="1.5rem" />
          <Skeleton height="1.5rem" />
          <Skeleton height="1.5rem" />
        </div>
        <div className="reader-content">
          <div className="content-card skeleton-block">
            <Skeleton width="40%" height="1.2rem" />
            <Skeleton />
            <Skeleton />
            <Skeleton width="70%" />
          </div>
        </div>
      </div>
    </div>
  )
}
