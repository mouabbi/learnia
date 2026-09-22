import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../features/auth/AuthContext'
import { authApi } from '../features/auth/authApi'
import { HomePage } from './HomePage'

vi.mock('../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../features/auth/authApi', () => ({
  authApi: { sendVerificationEmail: vi.fn() },
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<HomePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => vi.resetAllMocks())

describe('HomePage', () => {
  it('greets the user by the local part of their email, no banner when verified', () => {
    useAuth.mockReturnValue({
      user: { id: 1, email: 'a@b.com', email_verified: true },
    })
    renderPage()
    expect(screen.getByRole('heading', { name: 'Hello, a' })).toBeInTheDocument()
    expect(screen.queryByText("Your email isn't verified yet.")).not.toBeInTheDocument()
  })

  it('shows a resend banner when the email is unverified', async () => {
    useAuth.mockReturnValue({
      user: { id: 1, email: 'a@b.com', email_verified: false },
    })
    authApi.sendVerificationEmail.mockResolvedValue(null)
    renderPage()
    expect(screen.getByText("Your email isn't verified yet.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Resend verification email' }))
    expect(authApi.sendVerificationEmail).toHaveBeenCalled()
    expect(await screen.findByText('Sent — check your inbox.')).toBeInTheDocument()
  })
})
