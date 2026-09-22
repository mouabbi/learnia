import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'
import { ApiError } from '../api/client'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const result = await login(email, password)
      if (result.mfaRequired) {
        // Password was correct; still needs a TOTP/recovery code (see
        // MfaChallengePage). The ticket travels in route state, not the URL,
        // so it never ends up in browser history or a shared link.
        navigate('/mfa-challenge', { state: { mfaTicket: result.mfaTicket } })
      } else {
        navigate('/')
      }
    } catch (err) {
      // ApiError.message comes straight from the backend's {"error":
      // {message}} shape (see api/client.js) — already the deliberately
      // generic "Invalid email or password" text, safe to show as-is.
      setError(err instanceof ApiError ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="page">
      <h1>Log in</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Logging in...' : 'Log in'}
        </button>
      </form>
      <p>
        No account? <Link to="/register">Register</Link>
      </p>
      <p>
        <Link to="/forgot-password">Forgot password?</Link>
      </p>
    </section>
  )
}
