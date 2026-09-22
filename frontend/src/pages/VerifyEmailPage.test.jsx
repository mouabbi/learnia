import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { authApi } from '../features/auth/authApi'
import { VerifyEmailPage } from './VerifyEmailPage'

vi.mock('../features/auth/authApi', () => ({
  authApi: { verifyEmail: vi.fn() },
}))

function renderPage(path = '/verify-email?token=abc123') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <VerifyEmailPage />
    </MemoryRouter>,
  )
}

beforeEach(() => vi.resetAllMocks())

describe('VerifyEmailPage', () => {
  it('verifies automatically using the token from the URL', async () => {
    authApi.verifyEmail.mockResolvedValue(null)
    renderPage()
    expect(screen.getByText('Verifying...')).toBeInTheDocument()
    expect(await screen.findByText('Your email is now verified.')).toBeInTheDocument()
    expect(authApi.verifyEmail).toHaveBeenCalledWith('abc123')
  })

  it('shows the backend error for an invalid or expired token', async () => {
    authApi.verifyEmail.mockRejectedValue(
      new ApiError(422, 'VALIDATION_ERROR', 'This link is invalid or has expired'),
    )
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This link is invalid or has expired',
    )
  })

  it('shows a message when the URL has no token, without calling the API', () => {
    renderPage('/verify-email')
    expect(screen.getByText('This link is missing its token.')).toBeInTheDocument()
    expect(authApi.verifyEmail).not.toHaveBeenCalled()
  })
})
