import { useState } from 'react'
import { useAuth } from '../features/auth/AuthContext'
import { ChangePasswordForm } from '../features/auth/ChangePasswordForm'
import { authApi } from '../features/auth/authApi'
import { ApiError } from '../api/client'

// Protected (see App.jsx's <ProtectedRoute> wrapping this route) — only
// reachable once /auth/me has confirmed a logged-in user.
export function HomePage() {
  const { user, logout } = useAuth()

  return (
    <section className="page">
      <h1>Learnia</h1>
      <p>Logged in as {user.email}</p>
      {!user.email_verified && <VerifyEmailBanner />}
      <button type="button" onClick={logout}>
        Log out
      </button>
      <ChangePasswordForm />
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
