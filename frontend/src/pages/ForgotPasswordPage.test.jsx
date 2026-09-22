import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { authApi } from '../features/auth/authApi'
import { ForgotPasswordPage } from './ForgotPasswordPage'

vi.mock('../features/auth/authApi', () => ({
  authApi: { forgotPassword: vi.fn() },
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/forgot-password']}>
      <Routes>
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/login" element={<p>login page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => vi.resetAllMocks())

describe('ForgotPasswordPage', () => {
  it('shows the same confirmation whether or not the email exists', async () => {
    authApi.forgotPassword.mockResolvedValue({ message: 'ok' })
    renderPage()
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }))
    expect(authApi.forgotPassword).toHaveBeenCalledWith('a@b.com')
    expect(
      await screen.findByText('If that email is registered, a reset link has been sent.'),
    ).toBeInTheDocument()
  })

  it('shows an error on request failure', async () => {
    authApi.forgotPassword.mockRejectedValue(new ApiError(500, 'X', 'Server error'))
    renderPage()
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Server error')
  })

  it('links back to login', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('link', { name: 'Back to log in' }))
    expect(screen.getByText('login page')).toBeInTheDocument()
  })
})
