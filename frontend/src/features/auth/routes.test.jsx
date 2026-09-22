import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from './AuthContext'
import { ProtectedRoute } from './ProtectedRoute'
import { PublicOnlyRoute } from './PublicOnlyRoute'
import { authApi } from './authApi'

vi.mock('./authApi', () => ({ authApi: { getMe: vi.fn() } }))

// MemoryRouter = a router with no real browser URL; we choose the start page.
function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<PublicOnlyRoute>login page</PublicOnlyRoute>} />
          <Route path="/" element={<ProtectedRoute>home page</ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => vi.resetAllMocks())

describe('ProtectedRoute', () => {
  it('shows a loading skeleton instead of the page while checking auth', () => {
    authApi.getMe.mockReturnValue(new Promise(() => {})) // never resolves
    renderAt('/')
    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
    expect(screen.queryByText('home page')).not.toBeInTheDocument()
  })

  it('shows the page when logged in', async () => {
    authApi.getMe.mockResolvedValue({ id: 1, email: 'a@b.com' })
    renderAt('/')
    expect(await screen.findByText('home page')).toBeInTheDocument()
  })

  it('redirects to /login when logged out', async () => {
    authApi.getMe.mockRejectedValue(new Error('401'))
    renderAt('/')
    expect(await screen.findByText('login page')).toBeInTheDocument()
  })
})

describe('PublicOnlyRoute', () => {
  it('shows a loading skeleton instead of the page while checking auth', () => {
    authApi.getMe.mockReturnValue(new Promise(() => {})) // never resolves
    renderAt('/login')
    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
    expect(screen.queryByText('login page')).not.toBeInTheDocument()
  })

  it('shows the login page when logged out', async () => {
    authApi.getMe.mockRejectedValue(new Error('401'))
    renderAt('/login')
    expect(await screen.findByText('login page')).toBeInTheDocument()
  })

  it('redirects a logged-in user to home', async () => {
    authApi.getMe.mockResolvedValue({ id: 1, email: 'a@b.com' })
    renderAt('/login')
    expect(await screen.findByText('home page')).toBeInTheDocument()
  })
})
