import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { useAuth } from '../features/auth/AuthContext'
import { MfaChallengePage } from './MfaChallengePage'

vi.mock('../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))

const completeMfaLogin = vi.fn()

// A route we navigate to WITH state (mfaTicket), the way LoginPage does,
// since MemoryRouter's initialEntries can't carry route state directly.
function Redirector({ mfaTicket }) {
  return <Navigate to="/mfa-challenge" state={mfaTicket ? { mfaTicket } : undefined} replace />
}

function renderWithTicket(mfaTicket) {
  return render(
    <MemoryRouter initialEntries={['/go']}>
      <Routes>
        <Route path="/go" element={<Redirector mfaTicket={mfaTicket} />} />
        <Route path="/mfa-challenge" element={<MfaChallengePage />} />
        <Route path="/login" element={<p>login page</p>} />
        <Route path="/" element={<p>home page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  useAuth.mockReturnValue({ completeMfaLogin })
})

describe('MfaChallengePage', () => {
  it('redirects to /login when no ticket is present in route state', () => {
    renderWithTicket(null)
    expect(screen.getByText('login page')).toBeInTheDocument()
  })

  it('submits the ticket and typed code, then goes home', async () => {
    completeMfaLogin.mockResolvedValue({ id: 1 })
    renderWithTicket('abc123')
    await userEvent.type(screen.getByLabelText('Authenticator code'), '123456')
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }))
    expect(completeMfaLogin).toHaveBeenCalledWith('abc123', '123456')
    expect(await screen.findByText('home page')).toBeInTheDocument()
  })

  it('shows the backend error for a wrong code', async () => {
    completeMfaLogin.mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Invalid code'))
    renderWithTicket('abc123')
    await userEvent.type(screen.getByLabelText('Authenticator code'), '000000')
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid code')
  })
})
