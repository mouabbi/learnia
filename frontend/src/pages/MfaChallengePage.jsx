import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'
import { ApiError } from '../api/client'

// Reached only from LoginPage, right after a correct password on an
// account with MFA enabled — see LoginPage's navigate('/mfa-challenge', ...)
// and AuthContext.completeMfaLogin(). The ticket lives in route state, not
// the URL, so refreshing this page loses it (by design: start over at /login).
export function MfaChallengePage() {
  const { completeMfaLogin } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const mfaTicket = location.state?.mfaTicket
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!mfaTicket) {
    return <Navigate to="/login" replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await completeMfaLogin(mfaTicket, code)
      navigate('/')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="page">
      <h1>Two-factor verification</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="code">Authenticator code</label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            autoFocus
          />
          <p className="hint">
            Enter the 6-digit code from your authenticator app, or one of your recovery codes.
          </p>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Verifying...' : 'Verify'}
        </button>
      </form>
    </section>
  )
}
