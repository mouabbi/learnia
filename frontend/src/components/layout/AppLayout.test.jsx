import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppLayout } from './AppLayout'
import { useAuth } from '../../features/auth/AuthContext'
import { coursesApi } from '../../features/courses/coursesApi'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
// AppLayout renders useLearnerXp(), which calls coursesApi.listCourses() on
// mount — mocked here so it never hits a real (relative, unmockable in
// jsdom) fetch URL; the topbar XP figure itself isn't under test here.
vi.mock('../../features/courses/coursesApi', () => ({
  coursesApi: { listCourses: vi.fn(), getCourse: vi.fn(), getProgress: vi.fn() },
}))

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<p>home content</p>} />
          <Route path="/account" element={<p>settings content</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  coursesApi.listCourses.mockResolvedValue([])
  // AppLayout pins the sidebar open by default (isDesktopSidebarOpen starts
  // true) and only the desktop breakpoint's menu button collapses it — jsdom
  // has no real viewport, so window.matchMedia is stubbed to report a
  // desktop width, matching the '(min-width: 1024px)' check in
  // AppLayout.jsx's toggleSidebar. Without this, the click falls through to
  // the mobile/off-canvas branch instead and never changes anything.
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query) => ({
      matches: query.includes('1024'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
})

describe('AppLayout', () => {
  it('renders the routed page content', () => {
    useAuth.mockReturnValue({ user: { id: 1, email: 'a@b.com' }, logout: vi.fn() })
    renderLayout()
    expect(screen.getByText('home content')).toBeInTheDocument()
  })

  it('pins the sidebar open by default, and the menu button collapses/expands it', async () => {
    useAuth.mockReturnValue({ user: { id: 1, email: 'a@b.com' }, logout: vi.fn() })
    renderLayout()
    // Pinned sidebar (see AppLayout.jsx's .sidebar-pinned) is always in the
    // DOM regardless of the menu button — no click needed to see it.
    expect(screen.getByText('a@b.com')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument()

    const menuButton = screen.getByRole('button', { name: 'Close menu' })
    expect(menuButton).toHaveAttribute('aria-expanded', 'true')

    await userEvent.click(menuButton)
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false')
    // Collapsed: labels (including the email) drop out, only icons remain.
    expect(screen.queryByText('a@b.com')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('a@b.com')).toBeInTheDocument()
  })

  it('logs out from the sidebar', async () => {
    const logout = vi.fn().mockResolvedValue(undefined)
    useAuth.mockReturnValue({ user: { id: 1, email: 'a@b.com' }, logout })
    renderLayout()
    // The pinned sidebar's "Log out" is visible without opening any menu.
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }))
    expect(logout).toHaveBeenCalled()
  })
})
