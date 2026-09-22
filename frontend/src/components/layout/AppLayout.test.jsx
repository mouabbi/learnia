import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppLayout } from './AppLayout'
import { useAuth } from '../../features/auth/AuthContext'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))

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

beforeEach(() => vi.resetAllMocks())

describe('AppLayout', () => {
  it('renders the routed page content', () => {
    useAuth.mockReturnValue({ user: { id: 1, email: 'a@b.com' }, logout: vi.fn() })
    renderLayout()
    expect(screen.getByText('home content')).toBeInTheDocument()
  })

  it('opens the sidebar from the menu button', async () => {
    useAuth.mockReturnValue({ user: { id: 1, email: 'a@b.com' }, logout: vi.fn() })
    renderLayout()
    const menuButton = screen.getByRole('button', { name: 'Open menu' })
    expect(menuButton).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(menuButton)
    expect(menuButton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('a@b.com')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument()
  })

  it('logs out from the sidebar', async () => {
    const logout = vi.fn().mockResolvedValue(undefined)
    useAuth.mockReturnValue({ user: { id: 1, email: 'a@b.com' }, logout })
    renderLayout()
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }))
    expect(logout).toHaveBeenCalled()
  })
})
