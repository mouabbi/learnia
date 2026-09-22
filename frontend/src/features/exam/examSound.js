// WebAudio cues for the final exam — deliberately more serious/tense than
// the module-quiz cues in features/courses/quizSound.js (lower, sparser
// tones; no playful major arpeggios) to match the "proctored assessment"
// framing. No audio assets needed. Best-effort: silently no-ops if
// WebAudio is unavailable or blocked.
let sharedCtx = null

function getContext() {
  if (typeof window === 'undefined') return null
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  if (!sharedCtx) sharedCtx = new Ctx()
  return sharedCtx
}

function tone(ctx, when, freq, duration, peakGain, type = 'sine') {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0, when)
  gain.gain.linearRampToValueAtTime(peakGain, when + 0.03)
  gain.gain.exponentialRampToValueAtTime(0.0006, when + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(when)
  osc.stop(when + duration + 0.05)
}

// Low two-note "attention" cue when the timed exam actually begins.
export function playExamStartCue() {
  try {
    const ctx = getContext()
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume()
    const now = ctx.currentTime
    tone(ctx, now, 220, 0.4, 0.09, 'triangle')
    tone(ctx, now + 0.18, 164.81, 0.55, 0.1, 'triangle')
  } catch {
    // ignore
  }
}

// Sharp, short alert blip — tab-switch detected.
export function playExamAlertCue() {
  try {
    const ctx = getContext()
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume()
    const now = ctx.currentTime
    tone(ctx, now, 880, 0.18, 0.08, 'square')
    tone(ctx, now + 0.12, 660, 0.18, 0.07, 'square')
  } catch {
    // ignore
  }
}

// Neutral, clinical tick — one per grading step during processing.
export function playExamGradingTick() {
  try {
    const ctx = getContext()
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume()
    const now = ctx.currentTime
    tone(ctx, now, 340, 0.12, 0.045, 'triangle')
  } catch {
    // ignore
  }
}

// Result cue shaped by score — a strong but composed fanfare for a pass
// (not the bright bouncy quiz chime), a grave, quiet cue for a fail.
export function playExamResultCue(pct, passingPct) {
  try {
    const ctx = getContext()
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume()
    const now = ctx.currentTime

    if (pct === 100) {
      ;[261.63, 329.63, 392.0, 523.25].forEach((freq, i) =>
        tone(ctx, now + i * 0.12, freq, 0.7, 0.1, 'triangle'),
      )
    } else if (pct >= passingPct) {
      ;[220, 277.18, 329.63].forEach((freq, i) => tone(ctx, now + i * 0.13, freq, 0.65, 0.1, 'triangle'))
    } else {
      ;[196, 174.61, 146.83].forEach((freq, i) => tone(ctx, now + i * 0.22, freq, 0.8, 0.07, 'sine'))
    }
  } catch {
    // ignore
  }
}
