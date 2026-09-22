import { useState } from 'react'
import { useAuth } from '../features/auth/AuthContext'
import { authApi } from '../features/auth/authApi'
import { ApiError } from '../api/client'

// Rendered inside AppLayout (see App.jsx) — only reachable once /auth/me
// has confirmed a logged-in user. Navigation (settings, logout) lives in
// the sidebar now, so this stays a plain landing spot.
export function HomePage() {
  const { user } = useAuth()
  const displayName = user.email.split('@')[0]

  return (
    <section className="content-card">
      <h1>Hello, {displayName}</h1>
      <p>Welcome back to Learnia.</p>
      {!user.email_verified && <VerifyEmailBanner />}
    </section>
  )
}

// Shown only while the account's email is unverified (see users.email_verified_at).
function VerifyEmailBanner() {
  const [status, setStatus] = useState('idle') // idle | sent | error

  async function handleResend() {
    setStatus('idle')
    try {
      await authApi.sendVerificationEmail()
      setStatus('sent')
    } catch (err) {
      setStatus(err instanceof ApiError ? err.message : 'Something went wrong')
    }
  }

  return (
    <div role="status" className="banner">
      <p>Your email isn't verified yet.</p>
      <button type="button" onClick={handleResend}>
        Resend verification email
      </button>
      {status === 'sent' && <p>Sent — check your inbox.</p>}
      {status !== 'idle' && status !== 'sent' && (
        <p role="alert" className="error">
          {status}
        </p>
      )}
    </div>
  )
}
