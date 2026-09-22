import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../features/auth/AuthContext'
import { authApi } from '../features/auth/authApi'
import { HomePage } from './HomePage'

vi.mock('../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../features/auth/authApi', () => ({
  authApi: { changePassword: vi.fn(), sendVerificationEmail: vi.fn() },
}))

beforeEach(() => vi.resetAllMocks())

describe('HomePage', () => {
  it('shows the user email and no banner when verified', () => {
    useAuth.mockReturnValue({
      user: { id: 1, email: 'a@b.com', email_verified: true },
      logout: vi.fn(),
    })
    render(<HomePage />)
    expect(screen.getByText('Logged in as a@b.com')).toBeInTheDocument()
    expect(screen.queryByText("Your email isn't verified yet.")).not.toBeInTheDocument()
  })

  it('shows a resend banner when the email is unverified', async () => {
    useAuth.mockReturnValue({
      user: { id: 1, email: 'a@b.com', email_verified: false },
      logout: vi.fn(),
    })
    authApi.sendVerificationEmail.mockResolvedValue(null)
    render(<HomePage />)
    expect(screen.getByText("Your email isn't verified yet.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Resend verification email' }))
    expect(authApi.sendVerificationEmail).toHaveBeenCalled()
    expect(await screen.findByText('Sent — check your inbox.')).toBeInTheDocument()
  })
})
