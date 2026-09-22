import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authApi } from '../features/auth/authApi'
import { ApiError } from '../api/client'

// Reached via the link emailed on register / resend: /verify-email?token=...
// Verifies automatically on load — no form, nothing for the user to type.
export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  // No token at all -> nothing to verify, no API call, no effect needed.
  const [status, setStatus] = useState(token ? 'verifying' : 'error')
  const [error, setError] = useState(token ? null : 'This link is missing its token.')

  useEffect(() => {
    if (!token) return
    authApi
      .verifyEmail(token)
      .then(() => setStatus('success'))
      .catch((err) => {
        setStatus('error')
        setError(err instanceof ApiError ? err.message : 'Something went wrong')
      })
  }, [token])

  return (
    <section className="page">
      <h1>Verify email</h1>
      {status === 'verifying' && <p>Verifying...</p>}
      {status === 'success' && <p>Your email is now verified.</p>}
      {status === 'error' && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <p>
        <Link to="/">Go to Learnia</Link>
      </p>
    </section>
  )
}
