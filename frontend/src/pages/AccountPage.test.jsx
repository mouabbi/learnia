import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountPage } from './AccountPage'
import { authApi } from '../features/auth/authApi'

vi.mock('../features/auth/authApi', () => ({
  authApi: {
    changePassword: vi.fn(),
    getMfaStatus: vi.fn(),
    startMfaEnrollment: vi.fn(),
    confirmMfaEnrollment: vi.fn(),
  },
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/account']}>
      <Routes>
        <Route path="/account" element={<AccountPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  authApi.getMfaStatus.mockResolvedValue({ enabled: false })
})

describe('AccountPage', () => {
  it('lists every setting in the menu', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /Password/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Two-factor authentication/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Accent color' })).toBeInTheDocument()
  })

  it('shows the password setting by default', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: 'Password' })).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Two-factor authentication' }),
    ).not.toBeInTheDocument()
  })

  it('swaps the detail pane when a different setting is selected', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /Two-factor authentication/ }))
    expect(
      await screen.findByRole('heading', { name: 'Two-factor authentication' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Password' })).not.toBeInTheDocument()
  })

  it('swaps to the accent color setting when selected', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Accent color' }))
    expect(await screen.findByRole('heading', { name: 'Accent color' })).toBeInTheDocument()
  })

  it('shows no MFA status badge while the status is still loading', () => {
    authApi.getMfaStatus.mockReturnValue(new Promise(() => {})) // never resolves
    renderPage()
    const mfaItem = screen.getByRole('button', { name: /Two-factor authentication/ })
    expect(within(mfaItem).queryByText(/^(On|Off)$/)).not.toBeInTheDocument()
  })

  it('shows an "Off" badge next to Two-factor authentication when disabled', async () => {
    authApi.getMfaStatus.mockResolvedValue({ enabled: false })
    renderPage()
    const mfaItem = screen.getByRole('button', { name: /Two-factor authentication/ })
    expect(await within(mfaItem).findByText('Off')).toBeInTheDocument()
  })

  it('shows an "On" badge next to Two-factor authentication when enabled', async () => {
    authApi.getMfaStatus.mockResolvedValue({ enabled: true })
    renderPage()
    const mfaItem = screen.getByRole('button', { name: /Two-factor authentication/ })
    expect(await within(mfaItem).findByText('On')).toBeInTheDocument()
  })

  it('falls back to an "Off" badge if the MFA status request fails', async () => {
    authApi.getMfaStatus.mockRejectedValue(new Error('network error'))
    renderPage()
    const mfaItem = screen.getByRole('button', { name: /Two-factor authentication/ })
    expect(await within(mfaItem).findByText('Off')).toBeInTheDocument()
  })

  it('flips the badge to "On" right after enabling MFA, with no reload needed', async () => {
    authApi.getMfaStatus.mockResolvedValue({ enabled: false })
    authApi.startMfaEnrollment.mockResolvedValue({
      secret: 'JBSWY3DPEHPK3PXP',
      otpauth_uri: 'otpauth://totp/x',
      qr_code_data_uri: 'data:image/png;base64,abc',
    })
    authApi.confirmMfaEnrollment.mockResolvedValue({ recovery_codes: ['aaaa-1111'] })
    renderPage()

    const mfaItem = screen.getByRole('button', { name: /Two-factor authentication/ })
    expect(await within(mfaItem).findByText('Off')).toBeInTheDocument()

    await userEvent.click(mfaItem)
    await userEvent.click(
      await screen.findByRole('button', { name: 'Enable two-factor authentication' }),
    )
    await userEvent.type(screen.getByLabelText('Enter the 6-digit code to confirm'), '123456')
    await screen.findByText('aaaa-1111')

    expect(await within(mfaItem).findByText('On')).toBeInTheDocument()
    expect(within(mfaItem).queryByText('Off')).not.toBeInTheDocument()
  })
})
