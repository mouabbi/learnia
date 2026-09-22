import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { authApi } from '../features/auth/authApi'
import { ResetPasswordPage } from './ResetPasswordPage'

vi.mock('../features/auth/authApi', () => ({
  authApi: { resetPassword: vi.fn() },
}))

function renderPage(path = '/reset-password?token=abc123') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/login" element={<p>login page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => vi.resetAllMocks())

describe('ResetPasswordPage', () => {
  it('submits the token from the URL with the new password', async () => {
    authApi.resetPassword.mockResolvedValue(null)
    renderPage()
    await userEvent.type(screen.getByLabelText('New password'), 'brandnewpass1')
    await userEvent.click(screen.getByRole('button', { name: 'Set new password' }))
    expect(authApi.resetPassword).toHaveBeenCalledWith('abc123', 'brandnewpass1')
    expect(await screen.findByText('login page')).toBeInTheDocument()
  })

  it('shows the backend error for an invalid or expired token', async () => {
    authApi.resetPassword.mockRejectedValue(
      new ApiError(422, 'VALIDATION_ERROR', 'This link is invalid or has expired'),
    )
    renderPage()
    await userEvent.type(screen.getByLabelText('New password'), 'brandnewpass1')
    await userEvent.click(screen.getByRole('button', { name: 'Set new password' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This link is invalid or has expired',
    )
  })

  it('shows a message when the URL has no token, without calling the API', () => {
    renderPage('/reset-password')
    expect(screen.getByText("This link is missing its token.")).toBeInTheDocument()
    expect(authApi.resetPassword).not.toHaveBeenCalled()
  })
})
