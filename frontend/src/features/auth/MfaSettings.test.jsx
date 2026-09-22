import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import { MfaSettings } from './MfaSettings'
import { authApi } from './authApi'

vi.mock('./authApi', () => ({
  authApi: {
    getMfaStatus: vi.fn(),
    startMfaEnrollment: vi.fn(),
    confirmMfaEnrollment: vi.fn(),
    disableMfa: vi.fn(),
  },
}))

beforeEach(() => vi.resetAllMocks())

describe('MfaSettings', () => {
  it('shows loading placeholder shapes while the status is being fetched', () => {
    authApi.getMfaStatus.mockReturnValue(new Promise(() => {})) // never resolves
    render(<MfaSettings />)
    expect(screen.getByLabelText('Loading two-factor authentication settings')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Enable two-factor authentication' })).not.toBeInTheDocument()
  })

  it('reports the fetched status to onStatusChange', async () => {
    authApi.getMfaStatus.mockResolvedValue({ enabled: true })
    const onStatusChange = vi.fn()
    render(<MfaSettings onStatusChange={onStatusChange} />)
    await screen.findByText('Two-factor authentication is on.')
    expect(onStatusChange).toHaveBeenCalledWith(true)
  })

  it('reports false to onStatusChange if the status fetch fails', async () => {
    authApi.getMfaStatus.mockRejectedValue(new Error('network error'))
    const onStatusChange = vi.fn()
    render(<MfaSettings onStatusChange={onStatusChange} />)
    await screen.findByRole('button', { name: 'Enable two-factor authentication' })
    expect(onStatusChange).toHaveBeenCalledWith(false)
  })

  it('shows an enable button when disabled', async () => {
    authApi.getMfaStatus.mockResolvedValue({ enabled: false })
    render(<MfaSettings />)
    expect(
      await screen.findByRole('button', { name: 'Enable two-factor authentication' }),
    ).toBeInTheDocument()
  })

  it('shows the disable form when already enabled', async () => {
    authApi.getMfaStatus.mockResolvedValue({ enabled: true })
    render(<MfaSettings />)
    expect(await screen.findByText('Two-factor authentication is on.')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Disable two-factor authentication' }),
    ).toBeInTheDocument()
  })

  it('disables the enable button and shows a pending label while enrollment starts', async () => {
    authApi.getMfaStatus.mockResolvedValue({ enabled: false })
    authApi.startMfaEnrollment.mockReturnValue(new Promise(() => {})) // never resolves
    render(<MfaSettings />)
    await userEvent.click(
      await screen.findByRole('button', { name: 'Enable two-factor authentication' }),
    )
    const button = screen.getByRole('button', { name: 'Starting...' })
    expect(button).toBeDisabled()
  })

  it('never calls startMfaEnrollment twice for a double-click (would desync the shown QR from the saved secret)', async () => {
    authApi.getMfaStatus.mockResolvedValue({ enabled: false })
    let resolveEnrollment
    authApi.startMfaEnrollment.mockReturnValue(
      new Promise((resolve) => {
        resolveEnrollment = resolve
      }),
    )
    render(<MfaSettings />)
    const button = await screen.findByRole('button', { name: 'Enable two-factor authentication' })
    await userEvent.click(button)
    // The button is now disabled ("Starting..."), so a second click must be a no-op.
    await userEvent.click(button)
    expect(authApi.startMfaEnrollment).toHaveBeenCalledTimes(1)

    resolveEnrollment({
      secret: 'JBSWY3DPEHPK3PXP',
      otpauth_uri: 'otpauth://totp/x',
      qr_code_data_uri: 'data:image/png;base64,abc',
    })
    expect(await screen.findByAltText('MFA enrollment QR code')).toBeInTheDocument()
  })

  it('auto-submits and shows a pending label as soon as the 6th digit is typed', async () => {
    authApi.getMfaStatus.mockResolvedValue({ enabled: false })
    authApi.startMfaEnrollment.mockResolvedValue({
      secret: 'JBSWY3DPEHPK3PXP',
      otpauth_uri: 'otpauth://totp/x',
      qr_code_data_uri: 'data:image/png;base64,abc',
    })
    authApi.confirmMfaEnrollment.mockReturnValue(new Promise(() => {})) // never resolves
    render(<MfaSettings />)
    await userEvent.click(
      await screen.findByRole('button', { name: 'Enable two-factor authentication' }),
    )
    // No click on Confirm — typing the 6th digit alone must trigger the submit.
    await userEvent.type(screen.getByLabelText('Enter the 6-digit code to confirm'), '123456')
    expect(await screen.findByRole('button', { name: 'Confirming...' })).toBeDisabled()
    expect(authApi.confirmMfaEnrollment).toHaveBeenCalledWith('123456')
  })

  it('disables the disable button and shows a pending label while disabling', async () => {
    authApi.getMfaStatus.mockResolvedValue({ enabled: true })
    authApi.disableMfa.mockReturnValue(new Promise(() => {})) // never resolves
    render(<MfaSettings />)
    await userEvent.type(await screen.findByLabelText('Current password'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: 'Disable two-factor authentication' }))
    expect(screen.getByRole('button', { name: 'Disabling...' })).toBeDisabled()
  })

  it('starts enrollment: shows the QR code and secret', async () => {
    authApi.getMfaStatus.mockResolvedValue({ enabled: false })
    authApi.startMfaEnrollment.mockResolvedValue({
      secret: 'JBSWY3DPEHPK3PXP',
      otpauth_uri: 'otpauth://totp/Learnia:a@b.com?secret=JBSWY3DPEHPK3PXP&issuer=Learnia',
      qr_code_data_uri: 'data:image/png;base64,abc',
    })
    render(<MfaSettings />)
    await userEvent.click(
      await screen.findByRole('button', { name: 'Enable two-factor authentication' }),
    )
    expect(screen.getByAltText('MFA enrollment QR code')).toHaveAttribute(
      'src',
      'data:image/png;base64,abc',
    )
    expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument()
  })

  it('strips non-digit characters, caps the code at 6 digits, and auto-submits exactly once', async () => {
    authApi.getMfaStatus.mockResolvedValue({ enabled: false })
    authApi.startMfaEnrollment.mockResolvedValue({
      secret: 'JBSWY3DPEHPK3PXP',
      otpauth_uri: 'otpauth://totp/x',
      qr_code_data_uri: 'data:image/png;base64,abc',
    })
    authApi.confirmMfaEnrollment.mockResolvedValue({ recovery_codes: ['aaaa-1111'] })
    render(<MfaSettings />)
    await userEvent.click(
      await screen.findByRole('button', { name: 'Enable two-factor authentication' }),
    )
    // Non-digits interspersed throughout; the 6th digit is the LAST character
    // typed, so auto-submit fires once typing is done, not mid-way through.
    await userEvent.type(screen.getByLabelText('Enter the 6-digit code to confirm'), '1 2-3 4-5 6')
    expect(await screen.findByText('aaaa-1111')).toBeInTheDocument()
    expect(authApi.confirmMfaEnrollment).toHaveBeenCalledWith('123456')
    expect(authApi.confirmMfaEnrollment).toHaveBeenCalledTimes(1)
  })

  it('keeps the confirm button disabled and does not submit before 6 digits are entered', async () => {
    authApi.getMfaStatus.mockResolvedValue({ enabled: false })
    authApi.startMfaEnrollment.mockResolvedValue({
      secret: 'JBSWY3DPEHPK3PXP',
      otpauth_uri: 'otpauth://totp/x',
      qr_code_data_uri: 'data:image/png;base64,abc',
    })
    authApi.confirmMfaEnrollment.mockReturnValue(new Promise(() => {})) // never resolves
    render(<MfaSettings />)
    await userEvent.click(
      await screen.findByRole('button', { name: 'Enable two-factor authentication' }),
    )
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Enter the 6-digit code to confirm'), '12345')
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled()
    expect(authApi.confirmMfaEnrollment).not.toHaveBeenCalled()

    // The 6th digit both auto-submits and flips the button to its pending state.
    await userEvent.type(screen.getByLabelText('Enter the 6-digit code to confirm'), '6')
    expect(await screen.findByRole('button', { name: 'Confirming...' })).toBeDisabled()
    expect(authApi.confirmMfaEnrollment).toHaveBeenCalledWith('123456')
  })

  it('confirms enrollment and shows the recovery codes once', async () => {
    authApi.getMfaStatus.mockResolvedValue({ enabled: false })
    authApi.startMfaEnrollment.mockResolvedValue({
      secret: 'JBSWY3DPEHPK3PXP',
      otpauth_uri: 'otpauth://totp/x',
      qr_code_data_uri: 'data:image/png;base64,abc',
    })
    authApi.confirmMfaEnrollment.mockResolvedValue({ recovery_codes: ['aaaa-1111', 'bbbb-2222'] })
    render(<MfaSettings />)
    await userEvent.click(
      await screen.findByRole('button', { name: 'Enable two-factor authentication' }),
    )
    // No click on Confirm — typing the 6th digit submits on its own.
    await userEvent.type(screen.getByLabelText('Enter the 6-digit code to confirm'), '123456')

    expect(authApi.confirmMfaEnrollment).toHaveBeenCalledWith('123456')
    expect(await screen.findByText('aaaa-1111')).toBeInTheDocument()
    expect(screen.getByText('bbbb-2222')).toBeInTheDocument()

    // Acknowledging hides the codes but MFA stays enabled.
    await userEvent.click(screen.getByRole('button', { name: "I've saved them" }))
    expect(screen.queryByText('aaaa-1111')).not.toBeInTheDocument()
    expect(screen.getByText('Two-factor authentication is on.')).toBeInTheDocument()
  })

  it('reports onStatusChange(true) once confirmed', async () => {
    authApi.getMfaStatus.mockResolvedValue({ enabled: false })
    authApi.startMfaEnrollment.mockResolvedValue({
      secret: 'JBSWY3DPEHPK3PXP',
      otpauth_uri: 'otpauth://totp/x',
      qr_code_data_uri: 'data:image/png;base64,abc',
    })
    authApi.confirmMfaEnrollment.mockResolvedValue({ recovery_codes: ['aaaa-1111'] })
    const onStatusChange = vi.fn()
    render(<MfaSettings onStatusChange={onStatusChange} />)
    await userEvent.click(
      await screen.findByRole('button', { name: 'Enable two-factor authentication' }),
    )
    expect(onStatusChange).toHaveBeenCalledWith(false) // the initial fetch
    onStatusChange.mockClear()

    await userEvent.type(screen.getByLabelText('Enter the 6-digit code to confirm'), '123456')
    await screen.findByText('aaaa-1111')
    expect(onStatusChange).toHaveBeenCalledWith(true)
  })

  it('reports onStatusChange(false) once disabled', async () => {
    authApi.getMfaStatus.mockResolvedValue({ enabled: true })
    authApi.disableMfa.mockResolvedValue(null)
    const onStatusChange = vi.fn()
    render(<MfaSettings onStatusChange={onStatusChange} />)
    await userEvent.type(await screen.findByLabelText('Current password'), 'password123')
    onStatusChange.mockClear() // drop the initial fetch's call, isolate the disable call
    await userEvent.click(screen.getByRole('button', { name: 'Disable two-factor authentication' }))
    await screen.findByRole('button', { name: 'Enable two-factor authentication' })
    expect(onStatusChange).toHaveBeenCalledWith(false)
  })

  it('shows an error when confirming with a wrong code', async () => {
    authApi.getMfaStatus.mockResolvedValue({ enabled: false })
    authApi.startMfaEnrollment.mockResolvedValue({
      secret: 'JBSWY3DPEHPK3PXP',
      otpauth_uri: 'otpauth://totp/x',
      qr_code_data_uri: 'data:image/png;base64,abc',
    })
    authApi.confirmMfaEnrollment.mockRejectedValue(
      new ApiError(422, 'VALIDATION_ERROR', 'Invalid code'),
    )
    render(<MfaSettings />)
    await userEvent.click(
      await screen.findByRole('button', { name: 'Enable two-factor authentication' }),
    )
    await userEvent.type(screen.getByLabelText('Enter the 6-digit code to confirm'), '000000')
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid code')
  })

  it('disables MFA with the current password', async () => {
    authApi.getMfaStatus.mockResolvedValue({ enabled: true })
    authApi.disableMfa.mockResolvedValue(null)
    render(<MfaSettings />)
    await userEvent.type(await screen.findByLabelText('Current password'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: 'Disable two-factor authentication' }))
    expect(authApi.disableMfa).toHaveBeenCalledWith('password123')
    expect(
      await screen.findByRole('button', { name: 'Enable two-factor authentication' }),
    ).toBeInTheDocument()
  })

  it('shows an error when disabling with the wrong password', async () => {
    authApi.getMfaStatus.mockResolvedValue({ enabled: true })
    authApi.disableMfa.mockRejectedValue(
      new ApiError(401, 'UNAUTHORIZED', 'Current password is incorrect'),
    )
    render(<MfaSettings />)
    await userEvent.type(await screen.findByLabelText('Current password'), 'wrong-password')
    await userEvent.click(screen.getByRole('button', { name: 'Disable two-factor authentication' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Current password is incorrect')
  })
})
