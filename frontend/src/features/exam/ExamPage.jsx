import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import confetti from 'canvas-confetti'
import { formatMinutes } from '../../utils/duration'
import {
  Timer,
  GitCommitHorizontal,
  CircleCheck,
  CircleDashed,
  Truck,
  PartyPopper,
  RotateCcw,
  X,
  ArrowLeft,
  ArrowRight,
  ShieldAlert,
  Eye,
  Sun,
  Moon,
} from 'lucide-react'
import { coursesApi } from '../courses/coursesApi'
import { recordFinalExamAttempt } from '../courses/progressStore'
import { PASSING_PCT, isCourseComplete } from '../courses/progress'
import { playExamStartCue, playExamAlertCue, playExamGradingTick, playExamResultCue } from './examSound'
import { useTheme } from '../../hooks/useTheme'

// Reads the exam's own amber accent (--exam-accent, set on .exam-shell in
// index.css — deliberately distinct from the app's default --accent) so
// the calm mascot below matches the exam's own color, not the course
// theme.
function currentExamAccent() {
  if (typeof window === 'undefined') return '#f59e0b'
  // --exam-accent is scoped to .exam-shell (not :root), so read it off
  // that element specifically rather than <html>.
  const shellEl = document.querySelector('.exam-shell') || document.documentElement
  return getComputedStyle(shellEl).getPropertyValue('--exam-accent').trim() || '#f59e0b'
}

// A small, friendly creature that just... floats. Slowly. No bursts, no
// bounce, no sudden movement — replaces the old confetti-and-spring
// celebration, which some learners found overstimulating. It drifts up
// and down and tilts gently, like it's breathing, so passing feels calm
// rather than an assault of motion.
function CalmMascot() {
  const color = useMemo(() => currentExamAccent(), [])
  return (
    <motion.div
      className="exam-mascot"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: [0, -10, 0], rotate: [0, -3, 0, 3, 0] }}
      transition={{
        opacity: { duration: 0.8 },
        y: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
        rotate: { duration: 6, repeat: Infinity, ease: 'easeInOut' },
      }}
      aria-hidden="true"
    >
      <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
        <ellipse cx="36" cy="62" rx="20" ry="4" fill={color} opacity="0.15" />
        <circle cx="36" cy="34" r="26" fill={color} opacity="0.18" />
        <circle cx="36" cy="34" r="19" fill={color} />
        <circle cx="29" cy="31" r="2.6" fill="#1a1200" />
        <circle cx="43" cy="31" r="2.6" fill="#1a1200" />
        <path d="M28 41c2.5 3 13.5 3 16 0" stroke="#1a1200" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      </svg>
    </motion.div>
  )
}

// Small count-up used for the final score/percentage — ticks up from 0 to
// the target value over `duration` seconds instead of just appearing.
function CountUpNumber({ value, duration = 1.6 }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    let raf
    const start = performance.now()
    function tick(now) {
      const t = Math.min(1, (now - start) / (duration * 1000))
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(eased * value))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return display
}

// Mock "grading pipeline" steps shown during the processing stage — pure
// theatre, no backend call. Each has its own duration so the sequence feels
// alive instead of one flat progress bar. Sums to exactly 30s.
const PROCESSING_STEPS = [
  { label: 'Submitting your answers…', ms: 4000 },
  { label: 'Verifying against the answer key…', ms: 5500 },
  { label: 'Calculating your score…', ms: 5500 },
  { label: 'Checking the passing threshold…', ms: 5500 },
  { label: 'Finalizing your result…', ms: 5500 },
  { label: 'Preparing your certificate status…', ms: 4000 },
]

// Full-screen final exam runner. Rendered as its own route (see App.jsx),
// deliberately outside AppLayout — no topbar/sidebar chrome while an exam
// is active, closer to a real proctored-exam feel.
// Requests true browser fullscreen — a progressive enhancement over the
// existing fixed-overlay `.exam-shell`, which already provides a soft
// in-page fullscreen fallback if the browser blocks/rejects the API (e.g.
// no user-gesture context, or an iframe without the `allow` attribute).
async function tryEnterFullscreen(element) {
  try {
    if (element && !document.fullscreenElement) {
      await element.requestFullscreen?.()
    }
  } catch {
    // Ignored — the in-page exam-shell overlay already looks full-screen.
  }
}

async function tryExitFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen?.()
    }
  } catch {
    // Nothing to do — already out of fullscreen, or the browser refused.
  }
}

export function ExamPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const shellRef = useRef(null)
  const [course, setCourse] = useState(null)
  const [allModulesDone, setAllModulesDone] = useState(false)
  const [stage, setStage] = useState('intro') // intro | active | review | processing | result
  const [answers, setAnswers] = useState({})
  const [activeIndex, setActiveIndex] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [tabSwitchCount, setTabSwitchCount] = useState(0)

  useEffect(() => {
    coursesApi.getCourse(slug).then(async (data) => {
      setCourse(data)
      setSecondsLeft((data.finalExam?.durationMinutes ?? 5) * 60)
      const progress = await coursesApi.getProgress(data.id)
      setAllModulesDone(isCourseComplete(data, progress.completedPageIds, progress.moduleQuizzes))
    })
  }, [slug])

  // Leave fullscreen automatically once we're off the "active" stage
  // (finished, exited, or the whole page unmounts) — never leave the
  // learner stuck in fullscreen after the exam ends.
  useEffect(() => {
    if (stage !== 'active') tryExitFullscreen()
    return () => {
      if (stage === 'active') tryExitFullscreen()
    }
  }, [stage])

  // Tab-switch / minimize detection during the timed stage. This can't
  // enforce anything (no backend to report to) — it just warns the
  // learner that leaving was noticed.
  useEffect(() => {
    if (stage !== 'active') return undefined
    function handleVisibility() {
      if (document.hidden) {
        playExamAlertCue()
        setTabSwitchCount((n) => n + 1)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [stage])

  if (!course) return <div className="exam-shell exam-loading" aria-busy="true" />
  if (!course.finalExam) {
    return (
      <div className="exam-shell exam-loading">
        <p>This course doesn't have a final exam yet.</p>
        <button type="button" onClick={() => navigate(`/courses/${slug}/learn`)}>
          Back to course
        </button>
      </div>
    )
  }
  if (!allModulesDone) {
    return (
      <div className="exam-shell exam-loading">
        <p>Finish every module (and pass its QCM) before the final exam unlocks.</p>
        <button type="button" onClick={() => navigate(`/courses/${slug}/learn`)}>
          Back to course
        </button>
      </div>
    )
  }

  const exam = course.finalExam

  return (
    <div className="exam-shell exam-shell-serious" ref={shellRef}>
      <ExamThemeToggle />
      <AnimatePresence mode="wait">
        {stage === 'intro' && (
          <ExamIntro
            key="intro"
            course={course}
            exam={exam}
            onStart={() => {
              setTabSwitchCount(0)
              tryEnterFullscreen(shellRef.current)
              playExamStartCue()
              setStage('active')
            }}
          />
        )}
        {stage === 'active' && (
          <ExamActive
            key="active"
            course={course}
            exam={exam}
            answers={answers}
            setAnswers={setAnswers}
            activeIndex={activeIndex}
            setActiveIndex={setActiveIndex}
            secondsLeft={secondsLeft}
            setSecondsLeft={setSecondsLeft}
            tabSwitchCount={tabSwitchCount}
            onFinish={() => setStage('review')}
          />
        )}
        {stage === 'review' && (
          <ExamReview
            key="review"
            course={course}
            exam={exam}
            answers={answers}
            onBackToExam={() => setStage('active')}
            onCommit={() => setStage('processing')}
          />
        )}
        {stage === 'processing' && (
          <ExamProcessing
            key="processing"
            onDone={() => {
              const score = exam.questions.reduce(
                (total, q) => (answers[q.id] === q.correctOptionId ? total + 1 : total),
                0,
              )
              const pct = Math.round((score / exam.questions.length) * 100)
              recordFinalExamAttempt(course.id, { score, total: exam.questions.length }).catch(() => {})
              playExamResultCue(pct, PASSING_PCT)
              setStage('result')
            }}
          />
        )}
        {stage === 'result' && (
          <ExamResult
            key="result"
            course={course}
            exam={exam}
            answers={answers}
            onRetry={() => {
              setAnswers({})
              setActiveIndex(0)
              setSecondsLeft(exam.durationMinutes * 60)
              setStage('intro')
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// Persistent dark/light toggle, rendered once at the top of .exam-shell so
// it's reachable from every stage (intro, active, review, processing,
// result) instead of only the final result screen.
function ExamThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches)
  return (
    <button
      type="button"
      className="reader-theme-toggle exam-theme-toggle"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggleTheme}
    >
      {isDark ? <Sun aria-hidden="true" size={17} /> : <Moon aria-hidden="true" size={17} />}
    </button>
  )
}

function ExamIntro({ course, exam, onStart }) {
  const navigate = useNavigate()
  return (
    <motion.div
      className="exam-panel exam-intro"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button type="button" className="exam-close" onClick={() => navigate(`/courses/${course.slug}/learn`)}>
        <X size={20} />
      </button>
      <ShieldAlert size={40} className="exam-intro-icon" />
      <span className="exam-intro-eyebrow">Final exam · certification attempt</span>
      <h1>{course.title}</h1>
      <p className="exam-intro-tagline">
        This is the proctored assessment for this course — separate from the module QCMs. One
        timed, single attempt: read carefully, answer deliberately.
      </p>

      <div className="exam-intro-stats">
        <div>
          <Timer size={16} /> {formatMinutes(exam.durationMinutes)}
        </div>
        <div>
          <GitCommitHorizontal size={16} /> {exam.questions.length} questions
        </div>
        <div>
          <CircleCheck size={16} /> pass at {PASSING_PCT}%+
        </div>
      </div>

      <ul className="exam-intro-rules">
        <li>The timer starts the moment you begin — it cannot be paused.</li>
        <li>You can move between questions freely before submitting.</li>
        <li>Once submitted, your answers are final and immediately graded.</li>
        <li>Switching tabs or leaving the window during the exam will be flagged.</li>
      </ul>

      <button type="button" className="exam-start-button" onClick={onStart}>
        <ShieldAlert size={16} /> Begin final exam
      </button>
    </motion.div>
  )
}

function ExamActive({
  course,
  exam,
  answers,
  setAnswers,
  activeIndex,
  setActiveIndex,
  secondsLeft,
  setSecondsLeft,
  tabSwitchCount,
  onFinish,
}) {
  const intervalRef = useRef(null)

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current)
          onFinish()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(intervalRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const question = exam.questions[activeIndex]
  const answeredCount = Object.keys(answers).length
  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const seconds = String(secondsLeft % 60).padStart(2, '0')
  const low = secondsLeft <= 30
  const totalSeconds = exam.durationMinutes * 60
  const timeLeftPct = totalSeconds > 0 ? (secondsLeft / totalSeconds) * 100 : 0

  function select(optionId) {
    setAnswers((prev) => ({ ...prev, [question.id]: optionId }))
  }

  return (
    <motion.div
      className="exam-panel exam-active"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="exam-topbar">
        <span className="exam-topbar-title">{course.title} — Final Exam</span>
        <span className={`exam-timer ${low ? 'exam-timer-low' : ''}`}>
          <Timer size={16} /> {minutes}:{seconds}
        </span>
      </div>
      <div className="exam-timer-track">
        <motion.div
          className={`exam-timer-fill ${low ? 'exam-timer-fill-low' : ''}`}
          animate={{ width: `${timeLeftPct}%` }}
          transition={{ duration: 1, ease: 'linear' }}
        />
      </div>

      {tabSwitchCount > 0 && (
        <div className="exam-tab-warning" role="alert">
          <Eye size={16} />
          Tab-switch detected ({tabSwitchCount}). Stay on this window until you submit.
        </div>
      )}

      <div className="exam-progress-dots">
        {exam.questions.map((q, i) => (
          <button
            key={q.id}
            type="button"
            className={[
              'exam-dot',
              i === activeIndex ? 'exam-dot-active' : '',
              answers[q.id] ? 'exam-dot-answered' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => setActiveIndex(i)}
            aria-label={`Question ${i + 1}${answers[q.id] ? ' (answered)' : ''}`}
          />
        ))}
      </div>

      <div className="exam-question-card">
        <span className="exam-question-index">
          Question {activeIndex + 1} of {exam.questions.length}
        </span>
        <h2>{question.prompt}</h2>
        <div className="exam-options">
          {question.options.map((option) => (
            <label
              key={option.id}
              className={`exam-option ${answers[question.id] === option.id ? 'exam-option-selected' : ''}`}
            >
              <input
                type="radio"
                name={question.id}
                checked={answers[question.id] === option.id}
                onChange={() => select(option.id)}
              />
              <span>{option.text}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="exam-nav">
        <button
          type="button"
          disabled={activeIndex === 0}
          onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
        >
          <ArrowLeft size={16} /> Previous
        </button>
        <span className="exam-answered-count">
          {answeredCount}/{exam.questions.length} answered
        </span>
        {activeIndex < exam.questions.length - 1 ? (
          <button type="button" onClick={() => setActiveIndex((i) => i + 1)}>
            Next <ArrowRight size={16} />
          </button>
        ) : (
          <button type="button" className="exam-review-button" onClick={onFinish}>
            Review &amp; commit
          </button>
        )}
      </div>
    </motion.div>
  )
}

function ExamReview({ course, exam, answers, onBackToExam, onCommit }) {
  const [message, setMessage] = useState(`Complete final exam for ${course.title}`)
  const unanswered = exam.questions.filter((q) => !answers[q.id])

  return (
    <motion.div
      className="exam-panel exam-review"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <span className="exam-intro-eyebrow">Final review — before you submit</span>
      <h1>Review your answers</h1>

      <div className="exam-terminal">
        <p className="exam-terminal-line exam-terminal-muted">Answer summary</p>
        {exam.questions.map((q, i) => (
          <p key={q.id} className="exam-terminal-line">
            {answers[q.id] ? (
              <CircleCheck size={14} className="exam-terminal-check" />
            ) : (
              <CircleDashed size={14} className="exam-terminal-dash" />
            )}{' '}
            Question {i + 1}{' '}
            {answers[q.id] ? '(answered)' : <em>(unanswered — will count as wrong)</em>}
          </p>
        ))}
      </div>

      {unanswered.length > 0 && (
        <p className="exam-review-warning">
          {unanswered.length} question{unanswered.length === 1 ? '' : 's'} still unanswered. You can
          go back, or submit anyway.
        </p>
      )}

      <label className="exam-commit-label" htmlFor="commit-message">
        Final note (optional)
      </label>
      <input
        id="commit-message"
        className="exam-commit-input"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />

      <div className="exam-review-actions">
        <button type="button" className="exam-back-button" onClick={onBackToExam}>
          <ArrowLeft size={16} /> Back to exam
        </button>
        <button type="button" className="exam-commit-button" onClick={onCommit}>
          <GitCommitHorizontal size={16} /> Submit final answers
        </button>
      </div>
    </motion.div>
  )
}

function ExamProcessing({ onDone }) {
  const [stepIndex, setStepIndex] = useState(0)
  const totalMs = useMemo(() => PROCESSING_STEPS.reduce((sum, s) => sum + s.ms, 0), [])

  useEffect(() => {
    const timeouts = []
    let elapsed = 0
    PROCESSING_STEPS.forEach((step, i) => {
      elapsed += step.ms
      timeouts.push(
        setTimeout(() => {
          playExamGradingTick()
          if (i === PROCESSING_STEPS.length - 1) {
            setTimeout(onDone, 400)
          } else {
            setStepIndex(i + 1)
          }
        }, elapsed),
      )
    })
    return () => timeouts.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <motion.div
      className="exam-panel exam-processing"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <span className="exam-intro-eyebrow">Hang tight</span>
      <h1>Grading in progress…</h1>
      <p className="exam-processing-caption">Your submission is being scored automatically.</p>

      <div className="exam-road">
        <motion.div
          className="exam-truck"
          animate={{ left: `${(stepIndex / (PROCESSING_STEPS.length - 1)) * 100}%` }}
          transition={{ duration: totalMs === 0 ? 0 : PROCESSING_STEPS[stepIndex]?.ms / 1000, ease: 'linear' }}
        >
          <Truck size={28} />
        </motion.div>
        <div className="exam-road-track" />
      </div>

      <ul className="exam-processing-steps">
        {PROCESSING_STEPS.map((step, i) => (
          <li
            key={step.label}
            className={[
              'exam-processing-step',
              i < stepIndex ? 'exam-processing-step-done' : '',
              i === stepIndex ? 'exam-processing-step-active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {i < stepIndex ? <CircleCheck size={16} /> : <CircleDashed size={16} />}
            {step.label}
          </li>
        ))}
      </ul>
    </motion.div>
  )
}

function ExamResult({ course, exam, answers, onRetry }) {
  const navigate = useNavigate()

  const score = exam.questions.reduce(
    (total, q) => (answers[q.id] === q.correctOptionId ? total + 1 : total),
    0,
  )
  const total = exam.questions.length
  const pct = Math.round((score / total) * 100)
  const passed = pct >= PASSING_PCT
  const perfect = pct === 100
  const great = passed && !perfect && pct >= 90

  // One short, restrained confetti burst on a pass — same idea as the
  // module-quiz congrats (features/courses/Quiz.jsx), not the old
  // multi-angle fireworks: a single quick burst in the exam's own amber,
  // sized a little bigger for a perfect/great score.
  useEffect(() => {
    if (!passed) return
    confetti({
      colors: [currentExamAccent()],
      origin: { y: 0.3 },
      particleCount: perfect ? 90 : great ? 70 : 55,
      spread: 70,
      startVelocity: 30,
      ticks: 150,
      gravity: 1,
      scalar: 0.9,
    })
  }, [passed, perfect, great])

  return (
    <motion.div
      className="exam-panel exam-result"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {passed && <CalmMascot />}

      <motion.div
        className={`exam-result-badge ${passed ? 'exam-result-badge-pass' : 'exam-result-badge-fail'}`}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 240, damping: 20 }}
      >
        {passed ? <PartyPopper size={32} /> : <ShieldAlert size={32} />}
      </motion.div>

      <h1>{perfect ? 'Perfect score!' : great ? 'Great score!' : passed ? 'Exam passed' : 'Not a passing score'}</h1>
      <p className="exam-result-caption">
        {passed
          ? `You passed the ${course.title} final exam.`
          : `You didn't reach the passing score for ${course.title} this time. Review the material and try again when you're ready.`}
      </p>

      <div className="exam-result-score">
        <span className="exam-result-score-value">
          <CountUpNumber value={score} />
        </span>
        <span className="exam-result-score-total">/ {total}</span>
        <span className="exam-result-score-pct">
          (<CountUpNumber value={pct} />%)
        </span>
      </div>
      <div className="exam-result-pct-track">
        <motion.div
          className={`exam-result-pct-fill ${passed ? '' : 'exam-result-pct-fill-fail'}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.6, ease: 'easeInOut' }}
        />
      </div>
      <p className="hint">
        Passing score: {PASSING_PCT}%+
      </p>

      <div className="exam-result-actions">
        <button type="button" className="exam-back-button" onClick={onRetry}>
          <RotateCcw size={16} /> Retry exam
        </button>
        <button type="button" onClick={() => navigate(`/courses/${course.slug}/learn`)}>
          Back to course
        </button>
      </div>
    </motion.div>
  )
}
