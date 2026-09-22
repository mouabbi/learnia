import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './AuthContext'
import { authApi } from './authApi'

// Replace the whole API module: tests decide what the "backend" answers.
vi.mock('./authApi', () => ({
  authApi: { getMe: vi.fn(), loginPassword: vi.fn(), register: vi.fn(), logout: vi.fn() },
}))

// Tiny component that just displays what useAuth() exposes.
function Probe() {
  const { user, isLoading, isAuthenticated, login, logout } = useAuth()
  if (isLoading) return <p>loading</p>
  return (
    <div>
      <p>{isAuthenticated ? `in:${user.email}` : 'out'}</p>
      <button onClick={() => login('a@b.com', 'password123')}>login</button>
      <button onClick={logout}>logout</button>
    </div>
  )
}

const renderProbe = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  )

beforeEach(() => vi.resetAllMocks())

describe('AuthProvider', () => {
  it('starts loading, then logged in when /me succeeds', async () => {
    authApi.getMe.mockResolvedValue({ id: 1, email: 'a@b.com' })
    renderProbe()
    expect(screen.getByText('loading')).toBeInTheDocument()
    expect(await screen.findByText('in:a@b.com')).toBeInTheDocument()
  })

  it('is logged out when /me fails', async () => {
    authApi.getMe.mockRejectedValue(new Error('401'))
    renderProbe()
    expect(await screen.findByText('out')).toBeInTheDocument()
  })

  it('login() updates the user', async () => {
    authApi.getMe.mockRejectedValue(new Error('401'))
    authApi.loginPassword.mockResolvedValue({ id: 1, email: 'a@b.com' })
    renderProbe()
    await userEvent.click(await screen.findByText('login'))
    expect(await screen.findByText('in:a@b.com')).toBeInTheDocument()
    expect(authApi.loginPassword).toHaveBeenCalledWith('a@b.com', 'password123')
  })

  it('logout() clears the user', async () => {
    authApi.getMe.mockResolvedValue({ id: 1, email: 'a@b.com' })
    authApi.logout.mockResolvedValue(null)
    renderProbe()
    await userEvent.click(await screen.findByText('logout'))
    await waitFor(() => expect(screen.getByText('out')).toBeInTheDocument())
  })

  it('useAuth throws outside a provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Probe />)).toThrow(/AuthProvider/)
  })
})
