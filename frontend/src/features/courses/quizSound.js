import { PASSING_PCT } from './progress'

// Tiny WebAudio chime played right before a module QCM starts — no audio
// asset needed, just a soft ascending sine arpeggio (C-E-G major triad)
// with a gentle bell-like decay. Best-effort: browsers that block audio
// without a prior user gesture (rare here, always fires from a click)
// just stay silent.
let sharedCtx = null

function getContext() {
  if (typeof window === 'undefined') return null
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  if (!sharedCtx) sharedCtx = new Ctx()
  return sharedCtx
}

function chimeNote(ctx, when, freq, duration, peakGain) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0, when)
  gain.gain.linearRampToValueAtTime(peakGain, when + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0008, when + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(when)
  osc.stop(when + duration + 0.05)
}

export function playQuizStartCue() {
  try {
    const ctx = getContext()
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume()
    const now = ctx.currentTime
    // C5, E5, G5, C6 — a bright, quick major arpeggio.
    chimeNote(ctx, now, 523.25, 0.5, 0.1)
    chimeNote(ctx, now + 0.09, 659.25, 0.5, 0.1)
    chimeNote(ctx, now + 0.18, 783.99, 0.55, 0.1)
    chimeNote(ctx, now + 0.3, 1046.5, 0.7, 0.11)
  } catch {
    // ignore — cue is a nice-to-have, never block the quiz on it
  }
}

// Soft, neutral "processing" tick — one per grading step, so the ~10s
// grading sequence feels alive instead of silent.
export function playQuizGradingTick() {
  try {
    const ctx = getContext()
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = 720
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.05, now + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.12)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.14)
  } catch {
    // ignore
  }
}

// Result cue, shaped by how well the learner actually did — a perfect
// score gets a full triumphant fanfare, a plain pass gets a shorter happy
// riff, and a fail gets a gentle (not punishing) descending minor cue.
export function playQuizResultCue(pct) {
  try {
    const ctx = getContext()
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume()
    const now = ctx.currentTime

    if (pct === 100) {
      // C5 E5 G5 C6 E6 — full major run, bright and long.
      ;[523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((freq, i) =>
        chimeNote(ctx, now + i * 0.1, freq, 0.6, 0.12),
      )
    } else if (pct >= PASSING_PCT) {
      // E5 G5 C6 — short, happy confirmation.
      ;[659.25, 783.99, 1046.5].forEach((freq, i) => chimeNote(ctx, now + i * 0.1, freq, 0.5, 0.11))
    } else {
      // A4 F4 D4 — soft descending minor, encouraging rather than harsh.
      ;[440, 349.23, 293.66].forEach((freq, i) => chimeNote(ctx, now + i * 0.14, freq, 0.55, 0.08))
    }
  } catch {
    // ignore
  }
}
