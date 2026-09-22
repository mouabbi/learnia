import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import confetti from 'canvas-confetti'
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Lock,
  Timer,
  ArrowRight,
  ArrowLeft,
  CircleDashed,
  ScanSearch,
  Sparkles,
  Trophy,
  HeartHandshake,
} from 'lucide-react'
import { recordModuleQuizAttempt } from './progressStore'
import { PASSING_PCT, retakeCooldownMs, formatCooldown } from './progress'
import { playQuizStartCue, playQuizGradingTick, playQuizResultCue } from './quizSound'

// Mock "grading" sequence shown between submit and result — pure theatre,
// no backend call, but it makes hitting "submit" feel like something is
// actually happening rather than an instant verdict. ~10s total.
const GRADING_STEPS = [
  { label: 'Collecting your answers…', ms: 1600 },
  { label: 'Checking against the answer key…', ms: 2200 },
  { label: 'Scoring each question…', ms: 2200 },
  { label: 'Comparing to the passing bar…', ms: 2000 },
  { label: 'Wrapping up your result…', ms: 2000 },
]

// Self-contained module QCM: owns its own answer/submitted state so a
// module can mount/unmount it freely (e.g. navigating away and back resets
// the attempt). Records each attempt to progressStore (best score kept)
// and throttles retakes to one per 10 minutes, per
// features/courses/progress.js rules.
//
// The cooldown gate has to hold even across a remount (navigating away and
// back, or a page reload) — it's keyed off the *stored* lastAttemptAt, not
// local "did I just submit in this session" state, otherwise a reload
// would trivially bypass it.
//
// Stage machine: intro -> active (one question at a time) -> grading (~10s
// mock scoring) -> submitted. Entering "active" plays a short chime and
// swaps in a dedicated quiz-mode backdrop (see .quiz-mode in index.css) so
// it's unmistakable the learner has left reading mode and is now being
// tested; entering "submitted" plays a score-shaped sound cue and, on a
// pass, a canvas-confetti burst — bigger for a perfect score.
// `previousAttempt` ({ score, total, lastAttemptAt } | undefined) is the
// learner's best attempt so far, if any — owned by the parent (which
// already fetched the whole course's progress) rather than fetched again
// here, since progress now lives on the backend, not synchronous
// localStorage.
export function Quiz({ quiz, courseId, moduleId, previousAttempt, onAttempt }) {
  const [stage, setStage] = useState('intro') // intro | active | grading | submitted
  const [answers, setAnswers] = useState({})
  const [index, setIndex] = useState(0)
  const [cooldownMs, setCooldownMs] = useState(() => retakeCooldownMs(previousAttempt?.lastAttemptAt))

  // Tick the cooldown countdown once a second while it's active.
  useEffect(() => {
    if (cooldownMs <= 0) return undefined
    const id = setInterval(() => {
      setCooldownMs((prev) => Math.max(0, prev - 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [cooldownMs > 0]) // eslint-disable-line react-hooks/exhaustive-deps

  const questions = quiz.questions
  const total = questions.length
  const allAnswered = questions.every((q) => answers[q.id])
  const score = questions.reduce(
    (sum, q) => (answers[q.id] === q.correctOptionId ? sum + 1 : sum),
    0,
  )
  const pct = Math.round((score / total) * 100)
  const passed = pct >= PASSING_PCT
  const perfect = score === total

  function startQuiz() {
    playQuizStartCue()
    setStage('active')
    setIndex(0)
  }

  function selectOption(questionId, optionId) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }))
  }

  function submit() {
    setStage('grading')
  }

  async function finishGrading() {
    const attempt = await recordModuleQuizAttempt(courseId, moduleId, { score, total })
    setCooldownMs(retakeCooldownMs(attempt.lastAttemptAt))
    onAttempt?.({ score, total, passed })
    playQuizResultCue(pct)
    if (passed) {
      const burst = perfect
        ? { particleCount: 160, spread: 100, startVelocity: 42, ticks: 220 }
        : { particleCount: 90, spread: 75, startVelocity: 32, ticks: 180 }
      confetti({ ...burst, origin: { y: 0.4 } })
    }
    setStage('submitted')
  }

  // Gated view: an attempt was made recently and the cooldown hasn't
  // elapsed yet — the learner can still re-read the chapter, just not
  // start a new attempt. Once cooldownMs reaches 0 this falls through to
  // the normal intro screen below.
  if (cooldownMs > 0 && stage !== 'submitted') {
    const prevPassed = previousAttempt && (previousAttempt.score / previousAttempt.total) * 100 >= PASSING_PCT
    return (
      <div className="quiz">
        <div className="quiz-header">
          <h3>Check your understanding</h3>
          <p className="quiz-subtitle">
            {total} question{total === 1 ? '' : 's'} · pass with {PASSING_PCT}%+
          </p>
        </div>
        <div className="quiz-cooldown-gate">
          <Lock size={20} />
          <p>
            {previousAttempt && (
              <>
                Last attempt: <strong>{previousAttempt.score}</strong>/{previousAttempt.total} —{' '}
                {prevPassed ? 'passed.' : "didn't pass."}{' '}
              </>
            )}
            You can retake this quiz in <strong>{formatCooldown(cooldownMs)}</strong>. Good time to
            re-read the module above.
          </p>
        </div>
      </div>
    )
  }

  if (stage === 'intro') {
    return (
      <div className="quiz">
        <motion.div
          className="quiz-intro-card"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className="quiz-intro-eyebrow">
            <Timer size={14} /> Quiz mode
          </span>
          <h3>Check your understanding</h3>
          <p className="quiz-subtitle">
            {total} question{total === 1 ? '' : 's'} · one at a time · pass with {PASSING_PCT}%+
          </p>
          <button type="button" className="quiz-start-button" onClick={startQuiz}>
            Start quiz
          </button>
        </motion.div>
      </div>
    )
  }

  if (stage === 'grading') {
    return <QuizGrading onDone={finishGrading} />
  }

  if (stage === 'submitted') {
    const ResultIcon = perfect ? Trophy : passed ? Sparkles : HeartHandshake
    return (
      <div className="quiz">
        <div className="quiz-header">
          <h3>Check your understanding</h3>
          <p className="quiz-subtitle">
            {total} question{total === 1 ? '' : 's'} · pass with {PASSING_PCT}%+
          </p>
        </div>

        <motion.div
          className={`quiz-result-hero ${passed ? 'quiz-result-hero-pass' : 'quiz-result-hero-fail'}`}
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 280, damping: 18 }}
        >
          <motion.div
            className="quiz-result-badge"
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 12, delay: 0.1 }}
          >
            <ResultIcon size={30} />
          </motion.div>
          <motion.p
            className="quiz-result-headline"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {perfect ? 'Perfect score!' : passed ? 'Nice work — you passed!' : "Not quite — try again"}
          </motion.p>
          <motion.div
            className="quiz-result-score"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <span className="quiz-result-score-value">{score}</span>
            <span className="quiz-result-score-total">/{total}</span>
            <span className="quiz-result-score-pct">({pct}%)</span>
          </motion.div>
          <div className="quiz-result-pct-track">
            <motion.div
              className={`quiz-result-pct-fill ${passed ? '' : 'quiz-result-pct-fill-fail'}`}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.7, ease: 'easeOut', delay: 0.15 }}
            />
          </div>
        </motion.div>

        <div className="quiz-summary">
          {questions.map((question, i) => {
            const correct = answers[question.id] === question.correctOptionId
            return (
              <motion.div
                key={question.id}
                className="quiz-summary-row"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.05 }}
              >
                <span className={`quiz-summary-badge ${correct ? 'quiz-summary-badge-correct' : 'quiz-summary-badge-incorrect'}`}>
                  {correct ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                </span>
                <span className="quiz-summary-prompt">
                  {i + 1}. {question.prompt}
                </span>
              </motion.div>
            )
          })}
        </div>

        {cooldownMs > 0 ? (
          <p className="quiz-cooldown">
            <Lock size={14} /> Retry available in {formatCooldown(cooldownMs)}
          </p>
        ) : (
          <button
            type="button"
            onClick={() => {
              setAnswers({})
              setStage('intro')
            }}
            className="quiz-retry"
          >
            <RotateCcw size={14} /> Retry
          </button>
        )}
      </div>
    )
  }

  // stage === 'active' — one question at a time, quiz-mode backdrop.
  const question = questions[index]
  const isLast = index === total - 1
  const answeredCount = Object.keys(answers).length

  return (
    <div className="quiz quiz-mode">
      <div className="quiz-header">
        <span className="quiz-intro-eyebrow">
          <Timer size={14} /> Quiz mode
        </span>
        <p className="quiz-subtitle">
          Question {index + 1} of {total} · {answeredCount}/{total} answered
        </p>
      </div>

      <div className="quiz-progress-dots">
        {questions.map((q, i) => (
          <button
            key={q.id}
            type="button"
            className={[
              'quiz-dot',
              i === index ? 'quiz-dot-active' : '',
              answers[q.id] ? 'quiz-dot-answered' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => setIndex(i)}
            aria-label={`Question ${i + 1}${answers[q.id] ? ' (answered)' : ''}`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={question.id}
          className="quiz-question-card"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          <h3 className="quiz-question-prompt">{question.prompt}</h3>
          <div className="quiz-options">
            {question.options.map((option) => {
              const isSelected = answers[question.id] === option.id
              return (
                <label
                  key={option.id}
                  className={`quiz-option ${isSelected ? 'quiz-option-selected' : ''}`}
                >
                  <input
                    type="radio"
                    name={question.id}
                    value={option.id}
                    checked={isSelected}
                    onChange={() => selectOption(question.id, option.id)}
                  />
                  <span>{option.text}</span>
                </label>
              )
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="quiz-nav">
        <button
          type="button"
          className="quiz-nav-button"
          disabled={index === 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
        >
          <ArrowLeft size={16} /> Previous
        </button>
        {isLast ? (
          <button type="button" disabled={!allAnswered} onClick={submit}>
            Submit answers
          </button>
        ) : (
          <button
            type="button"
            className="quiz-nav-button quiz-nav-button-primary"
            onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
          >
            Next <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  )
}

// ~10s mock grading sequence between "submit" and the result screen — a
// spinning scanner icon plus a step checklist, each step landing with a
// soft tick sound so the wait reads as "actively working" not "stalled".
function QuizGrading({ onDone }) {
  const [stepIndex, setStepIndex] = useState(0)
  const totalMs = useMemo(() => GRADING_STEPS.reduce((sum, s) => sum + s.ms, 0), [])

  useEffect(() => {
    const timeouts = []
    let elapsed = 0
    GRADING_STEPS.forEach((step, i) => {
      elapsed += step.ms
      timeouts.push(
        setTimeout(() => {
          playQuizGradingTick()
          if (i === GRADING_STEPS.length - 1) {
            setTimeout(onDone, 300)
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
    <div className="quiz quiz-mode">
      <motion.div className="quiz-grading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <motion.div
          className="quiz-grading-icon"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
        >
          <ScanSearch size={30} />
        </motion.div>
        <h3>Grading your answers…</h3>
        <div className="quiz-grading-track">
          <motion.div
            className="quiz-grading-fill"
            animate={{ width: `${((stepIndex + 1) / GRADING_STEPS.length) * 100}%` }}
            transition={{ duration: (totalMs === 0 ? 0 : GRADING_STEPS[stepIndex]?.ms ?? 0) / 1000, ease: 'linear' }}
          />
        </div>
        <ul className="quiz-grading-steps">
          {GRADING_STEPS.map((step, i) => (
            <li
              key={step.label}
              className={[
                'quiz-grading-step',
                i < stepIndex ? 'quiz-grading-step-done' : '',
                i === stepIndex ? 'quiz-grading-step-active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {i < stepIndex ? <CheckCircle2 size={15} /> : <CircleDashed size={15} />}
              {step.label}
            </li>
          ))}
        </ul>
      </motion.div>
    </div>
  )
}
