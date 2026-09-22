import { useEffect, useState } from 'react'
import { authApi } from './authApi'
import { ApiError } from '../../api/client'
import { Skeleton } from '../../components/Skeleton'
import { ButtonSpinner } from '../../components/ButtonSpinner'

// Used on AccountPage. Three states, in order: disabled -> enrolling
// (QR shown, unconfirmed) -> enabled. See backend services/mfa_service.py
// for why enrollment is two steps (generate, then confirm with one code).
//
// `onStatusChange(enabled)` is optional: AccountPage uses it to keep the
// On/Off badge in its settings nav in sync, since that badge is fetched
// once on mount and would otherwise go stale after enabling/disabling here
// without a page reload.
export function MfaSettings({ onStatusChange } = {}) {
  const [status, setStatus] = useState('loading') // loading | disabled | enrolling | enabled
  const [enrollment, setEnrollment] = useState(null) // { secret, otpauth_uri, qr_code_data_uri }
  const [recoveryCodes, setRecoveryCodes] = useState(null) // shown once, right after confirming
  const [error, setError] = useState(null)
  // Each async action gets its own pending flag so its button can disable
  // itself and show a spinner. This also guards against a double-click
  // firing startMfaEnrollment twice — each call REPLACES the stored secret
  // (see backend MfaService.start_enrollment), so a second click before the
  // first request lands would overwrite it and the QR you scanned would no
  // longer match what's saved, making every code look "invalid".
  const [isStartingEnrollment, setIsStartingEnrollment] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [isDisabling, setIsDisabling] = useState(false)
  const [confirmCode, setConfirmCode] = useState('')

  function handleConfirmCodeChange(event) {
    // Authenticator apps show digits only — strip anything else (spaces,
    // pasted dashes, ...) so what's submitted always matches what's typed,
    // and cap at 6 so a stray extra digit can't shift the whole code.
    setConfirmCode(event.target.value.replace(/\D/g, '').slice(0, 6))
  }

  useEffect(() => {
    authApi
      .getMfaStatus()
      .then((res) => {
        setStatus(res.enabled ? 'enabled' : 'disabled')
        onStatusChange?.(res.enabled)
      })
      .catch(() => {
        setStatus('disabled')
        onStatusChange?.(false)
      })
    // Only meant to run once, on mount — onStatusChange is a fresh function
    // identity on every AccountPage render and must not restart this fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleStartEnrollment() {
    if (isStartingEnrollment) return
    setError(null)
    setIsStartingEnrollment(true)
    try {
      const res = await authApi.startMfaEnrollment()
      setEnrollment(res)
      setStatus('enrolling')
      setConfirmCode('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong')
    } finally {
      setIsStartingEnrollment(false)
    }
  }

  async function submitConfirmCode(code) {
    if (isConfirming) return
    setError(null)
    setIsConfirming(true)
    try {
      const res = await authApi.confirmMfaEnrollment(code)
      setRecoveryCodes(res.recovery_codes)
      setStatus('enabled')
      setConfirmCode('')
      onStatusChange?.(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong')
    } finally {
      setIsConfirming(false)
    }
  }

  // Submits the moment the 6th digit is typed — no separate "Confirm" click.
  // The button stays as a manual fallback (Enter key, retrying after an
  // error without retyping the whole code).
  useEffect(() => {
    if (status !== 'enrolling' || confirmCode.length !== 6) return
    // Deferred a tick so this isn't a setState call directly in the effect
    // body (see react-hooks/no-set-state-in-effect) — still fires before
    // the next paint, so it reads as instant.
    queueMicrotask(() => submitConfirmCode(confirmCode))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmCode, status])

  function handleConfirm(event) {
    event.preventDefault()
    submitConfirmCode(confirmCode)
  }

  async function handleDisable(event) {
    event.preventDefault()
    if (isDisabling) return
    setError(null)
    setIsDisabling(true)
    const password = new FormData(event.target).get('current_password')
    try {
      await authApi.disableMfa(password)
      setStatus('disabled')
      setEnrollment(null)
      setRecoveryCodes(null)
      onStatusChange?.(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong')
    } finally {
      setIsDisabling(false)
    }
  }

  // Placeholder shapes standing in for the real title/status/button while
  // getMfaStatus() is in flight, instead of a blank gap on the page.
  if (status === 'loading') {
    return (
      <div className="mfa-skeleton" aria-busy="true" aria-label="Loading two-factor authentication settings">
        <Skeleton width="60%" height="1.5em" />
        <Skeleton width="40%" height="1em" />
        <Skeleton width="10rem" height="2.4rem" />
      </div>
    )
  }

  return (
    <div>
      <h2>Two-factor authentication</h2>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      {status === 'disabled' && (
        <>
          <p>Not enabled.</p>
          <button type="button" onClick={handleStartEnrollment} disabled={isStartingEnrollment}>
            {isStartingEnrollment && <ButtonSpinner />}
            {isStartingEnrollment ? 'Starting...' : 'Enable two-factor authentication'}
          </button>
        </>
      )}

      {status === 'enrolling' && enrollment && (
        <form onSubmit={handleConfirm}>
          <p>Scan this QR code with your authenticator app (e.g. Google Authenticator):</p>
          <img src={enrollment.qr_code_data_uri} alt="MFA enrollment QR code" width={200} />
          <p className="hint">
            Can't scan it? Enter this code manually: <code>{enrollment.secret}</code>
          </p>
          <div>
            <label htmlFor="mfa-confirm-code">Enter the 6-digit code to confirm</label>
            <input
              id="mfa-confirm-code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={confirmCode}
              onChange={handleConfirmCodeChange}
              required
            />
          </div>
          <button type="submit" disabled={isConfirming || confirmCode.length !== 6}>
            {isConfirming && <ButtonSpinner />}
            {isConfirming ? 'Confirming...' : 'Confirm'}
          </button>
        </form>
      )}

      {status === 'enabled' && recoveryCodes && (
        <div role="status">
          <p>
            Two-factor authentication is on. Save these recovery codes somewhere safe — each
            works once, and this is the only time they're shown:
          </p>
          <ul>
            {recoveryCodes.map((code) => (
              <li key={code}>
                <code>{code}</code>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setRecoveryCodes(null)}>
            I've saved them
          </button>
        </div>
      )}

      {status === 'enabled' && !recoveryCodes && (
        <>
          <p>Two-factor authentication is on.</p>
          <form onSubmit={handleDisable}>
            <div>
              <label htmlFor="mfa-disable-password">Current password</label>
              <input id="mfa-disable-password" name="current_password" type="password" required />
            </div>
            <button type="submit" disabled={isDisabling}>
              {isDisabling && <ButtonSpinner />}
              {isDisabling ? 'Disabling...' : 'Disable two-factor authentication'}
            </button>
          </form>
        </>
      )}
    </div>
  )
}
