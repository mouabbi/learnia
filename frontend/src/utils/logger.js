/**
 * Tiny console logger with levels and a scope tag, so you can see exactly what
 * the app does (API calls, auth actions, redirects) in the browser console.
 *
 *   const log = createLogger('auth')
 *   log.info('login ok', { userId: 3 })
 *   // 14:02:11.532 INFO  [auth] login ok { userId: 3 }
 *
 * Level comes from VITE_LOG_LEVEL (debug | info | warn | error | silent).
 * If unset: 'debug' while developing (npm run dev), 'warn' in a production build.
 *
 * Never pass passwords, tokens, or request bodies to the logger: anything logged
 * is visible to whoever opens the console.
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 }

const configured = import.meta.env.VITE_LOG_LEVEL ?? (import.meta.env.DEV ? 'debug' : 'warn')
const threshold = LEVELS[configured] ?? LEVELS.info

function write(level, scope, message, data) {
  if (LEVELS[level] < threshold) return

  const time = new Date().toISOString().slice(11, 23) // HH:MM:SS.mmm
  const line = `${time} ${level.toUpperCase().padEnd(5)} [${scope}] ${message}`

  // console.debug/info/warn/error exist with the same names as our levels.
  if (data === undefined) console[level](line)
  else console[level](line, data)
}

export function createLogger(scope) {
  return {
    debug: (message, data) => write('debug', scope, message, data),
    info: (message, data) => write('info', scope, message, data),
    warn: (message, data) => write('warn', scope, message, data),
    error: (message, data) => write('error', scope, message, data),
  }
}
