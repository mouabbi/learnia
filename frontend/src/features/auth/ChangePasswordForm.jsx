import { useState } from 'react'
import { authApi } from './authApi'
import { ApiError } from '../../api/client'
import { ButtonSpinner } from '../../components/ButtonSpinner'

// Used on HomePage. Changing the password logs out every OTHER session
// (see backend account_service.change_password) — this tab stays logged in.
export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setMessage(null)
    setIsSubmitting(true)
    try {
      await authApi.changePassword(currentPassword, newPassword)
      setMessage('Password changed. Other logged-in devices were signed out.')
      setCurrentPassword('')
      setNewPassword('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Change password</h2>
      <div>
        <label htmlFor="current-password">Current password</label>
        <input
          id="current-password"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="new-password">New password</label>
        <input
          id="new-password"
          type="password"
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
      </div>
      {message && <p role="status">{message}</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting && <ButtonSpinner />}
        {isSubmitting ? 'Changing...' : 'Change password'}
      </button>
    </form>
  )
}
