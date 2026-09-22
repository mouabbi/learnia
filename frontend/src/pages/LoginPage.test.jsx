import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { useAuth } from '../features/auth/AuthContext'
import { LoginPage } from './LoginPage'

// Mock only useAuth: the page is tested alone, without any provider or backend.
vi.mock('../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))

const login = vi.fn()

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<p>home page</p>} />
        <Route path="/register" element={<p>register page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function fillAndSubmit() {
  await userEvent.type(screen.getByLabelText('Email'), 'a@b.com')
  await userEvent.type(screen.getByLabelText('Password'), 'password123')
  await userEvent.click(screen.getByRole('button', { name: 'Log in' }))
}

beforeEach(() => {
  vi.resetAllMocks()
  useAuth.mockReturnValue({ login })
})

describe('LoginPage', () => {
  it('submits the typed credentials and goes home', async () => {
    login.mockResolvedValue({ id: 1 })
    renderPage()
    await fillAndSubmit()
    expect(login).toHaveBeenCalledWith('a@b.com', 'password123')
    expect(await screen.findByText('home page')).toBeInTheDocument()
  })

  it('shows the backend error message on failure and stays on the page', async () => {
    login.mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Invalid email or password'))
    renderPage()
    await fillAndSubmit()
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password')
    expect(screen.queryByText('home page')).not.toBeInTheDocument()
  })

  it('shows a generic message for non-API errors', async () => {
    login.mockRejectedValue(new Error('network down'))
    renderPage()
    await fillAndSubmit()
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong')
  })

  it('links to the register page', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('link', { name: 'Register' }))
    expect(screen.getByText('register page')).toBeInTheDocument()
  })
})
