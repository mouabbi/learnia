import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '../features/auth/authApi'
import { ApiError } from '../api/client'

// Reached via the link emailed by ForgotPasswordPage: /reset-password?token=...
export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await authApi.resetPassword(token, password)
      navigate('/login')
    } catch (err) {
      // Covers both a bad request and an invalid/expired/already-used token
      // (backend returns the same 422 shape for both — see account_service.py).
      setError(err instanceof ApiError ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!token) {
    return (
      <section className="page">
        <h1>Reset password</h1>
        <p role="alert" className="error">
          This link is missing its token.
        </p>
        <p>
          <Link to="/forgot-password">Request a new link</Link>
        </p>
      </section>
    )
  }

  return (
    <section className="page">
      <h1>Reset password</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="password">New password</label>
          <input
            id="password"
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <p className="hint">At least 8 characters.</p>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Set new password'}
        </button>
      </form>
    </section>
  )
}
