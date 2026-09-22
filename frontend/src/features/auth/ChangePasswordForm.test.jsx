import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import { ChangePasswordForm } from './ChangePasswordForm'
import { authApi } from './authApi'

vi.mock('./authApi', () => ({ authApi: { changePassword: vi.fn() } }))

async function fillAndSubmit() {
  await userEvent.type(screen.getByLabelText('Current password'), 'password123')
  await userEvent.type(screen.getByLabelText('New password'), 'newpassword456')
  await userEvent.click(screen.getByRole('button', { name: 'Change password' }))
}

beforeEach(() => vi.resetAllMocks())

describe('ChangePasswordForm', () => {
  it('submits current and new password, then confirms and clears the form', async () => {
    authApi.changePassword.mockResolvedValue(null)
    render(<ChangePasswordForm />)
    await fillAndSubmit()
    expect(authApi.changePassword).toHaveBeenCalledWith('password123', 'newpassword456')
    expect(await screen.findByRole('status')).toHaveTextContent('Other logged-in devices')
    expect(screen.getByLabelText('Current password')).toHaveValue('')
    expect(screen.getByLabelText('New password')).toHaveValue('')
  })

  it('shows the backend error when the current password is wrong', async () => {
    authApi.changePassword.mockRejectedValue(
      new ApiError(401, 'UNAUTHORIZED', 'Current password is incorrect'),
    )
    render(<ChangePasswordForm />)
    await fillAndSubmit()
    expect(await screen.findByRole('alert')).toHaveTextContent('Current password is incorrect')
  })
})
