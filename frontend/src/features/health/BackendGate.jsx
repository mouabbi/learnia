import { useCallback, useEffect, useState } from 'react'
import { fetchHealth } from './healthApi'
import { createLogger } from '../../utils/logger'

const log = createLogger('health')

/**
 * Wraps the whole app: nothing (login, routes, auth check) renders until
 * GET /health succeeds. Without this, a down backend shows up as a
 * confusing "invalid credentials"-style failure on the login page instead
 * of the real problem.
 */
export function BackendGate({ children }) {
  const [status, setStatus] = useState('checking') // checking | ok | down

  const check = useCallback(() => {
    fetchHealth()
      .then(() => {
        log.info('backend reachable')
        setStatus('ok')
      })
      .catch(() => {
        log.error('backend unreachable')
        setStatus('down')
      })
  }, [])

  // Initial state is already 'checking', so the first run needn't reset it
  // (setting state synchronously inside an effect is flagged by the linter).
  useEffect(() => {
    check()
  }, [check])

  function retry() {
    setStatus('checking')
    check()
  }

  if (status === 'checking') {
    return (
      <section className="page">
        <p>Connecting to server...</p>
      </section>
    )
  }

  if (status === 'down') {
    return (
      <section className="page">
        <h1>Server unreachable</h1>
        <p>Could not reach the backend. Make sure it is running, then retry.</p>
        <button type="button" onClick={retry}>
          Retry
        </button>
      </section>
    )
  }

  return children
}
