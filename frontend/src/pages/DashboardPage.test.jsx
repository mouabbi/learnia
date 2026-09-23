import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DashboardPage } from './DashboardPage'
import { dashboardApi } from '../features/dashboard/dashboardApi'

// Mock only dashboardApi: the page is tested alone, without a real backend.
vi.mock('../features/dashboard/dashboardApi', () => ({
  dashboardApi: { getDashboard: vi.fn() },
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  )
}

const course = {
  id: 'c1',
  slug: 'intro',
  title: 'Intro Course',
  description: 'Learn the basics',
  estimatedMinutes: 30,
  icon: 'BookOpen',
  progressPct: 40,
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('DashboardPage', () => {
  it('shows loading skeletons before data arrives', () => {
    dashboardApi.getDashboard.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    // Course grid renders skeleton placeholders while data is null.
    expect(document.querySelectorAll('.course-card-skeleton').length).toBeGreaterThan(0)
  })

  it('shows an empty state when there are no courses', async () => {
    dashboardApi.getDashboard.mockResolvedValue({
      continueLearning: null,
      courses: [],
      recommendations: [],
      stats: { inProgressCount: 0, completedCount: 0, totalCount: 0 },
    })
    renderPage()
    expect(await screen.findByText('No courses published yet.')).toBeInTheDocument()
  })

  it('shows an error message when the dashboard fails to load', async () => {
    dashboardApi.getDashboard.mockRejectedValue(new Error('network down'))
    renderPage()
    expect(await screen.findByText(/couldn't load your dashboard/i)).toBeInTheDocument()
  })

  it('shows the continue-learning card, courses, and recommendations sections when populated', async () => {
    dashboardApi.getDashboard.mockResolvedValue({
      continueLearning: {
        course,
        progressPct: 40,
        lastPageTitle: 'Chapter 2: Loops',
      },
      courses: [course],
      recommendations: [{ ...course, id: 'c2', title: 'Advanced Course' }],
      stats: { inProgressCount: 1, completedCount: 0, totalCount: 2 },
    })
    renderPage()

    expect(await screen.findByText('Continue learning')).toBeInTheDocument()
    expect(screen.getByText('Next up: Chapter 2: Loops')).toBeInTheDocument()

    expect(screen.getByText('Your courses')).toBeInTheDocument()
    expect(screen.getAllByText('Intro Course').length).toBeGreaterThan(0)

    expect(screen.getByText('Recommended for you')).toBeInTheDocument()
    expect(screen.getByText('Advanced Course')).toBeInTheDocument()

    expect(screen.getByText('In progress')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('Courses available')).toBeInTheDocument()
  })
})
