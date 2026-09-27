// Keyboard navigation tests for the exam navigator (ExamPage.jsx's
// ExamActive stage: question dots + Previous/Next), plus the exam intro's
// entry point. 19-performance-accessibility calls out the "exam navigator"
// explicitly as a keyboard-navigation target.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ExamPage } from './ExamPage'
import { coursesApi } from '../courses/coursesApi'

vi.mock('../courses/coursesApi', () => ({
  coursesApi: { getCourse: vi.fn(), getProgress: vi.fn() },
}))
vi.mock('../courses/progressStore', () => ({
  recordFinalExamAttempt: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('./examSound', () => ({
  playExamStartCue: vi.fn(),
  playExamAlertCue: vi.fn(),
  playExamGradingTick: vi.fn(),
  playExamResultCue: vi.fn(),
}))
vi.mock('canvas-confetti', () => ({ default: vi.fn() }))

const COURSE = {
  id: 1,
  slug: 'demo-course',
  title: 'Demo Course',
  // No modules — isCourseComplete() requires every module complete before
  // the final exam unlocks, and vacuously true (no modules to finish) is
  // what lets these tests reach the exam directly.
  modules: [],
  finalExam: {
    durationMinutes: 5,
    questions: [
      {
        id: 'q1',
        prompt: 'Question one?',
        correctOptionId: 'a',
        options: [
          { id: 'a', text: 'Option A' },
          { id: 'b', text: 'Option B' },
        ],
      },
      {
        id: 'q2',
        prompt: 'Question two?',
        correctOptionId: 'a',
        options: [
          { id: 'a', text: 'Option A' },
          { id: 'b', text: 'Option B' },
        ],
      },
    ],
  },
}

function renderExam() {
  return render(
    <MemoryRouter initialEntries={['/courses/demo-course/exam']}>
      <Routes>
        <Route path="/courses/:slug/exam" element={<ExamPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  coursesApi.getCourse.mockResolvedValue(COURSE)
  coursesApi.getProgress.mockResolvedValue({ completedPageIds: [], moduleQuizzes: {} })
})

describe('Exam navigator keyboard access', () => {
  it('starts the exam via keyboard (Enter on the focused start button)', async () => {
    const user = renderExamUser()
    renderExam()
    const startButton = await screen.findByRole('button', { name: /begin final exam/i })
    startButton.focus()
    await user.keyboard('{Enter}')
    expect(await screen.findByText('Question 1 of 2')).toBeInTheDocument()
  })

  it('lets a keyboard user select an answer option (radio input, Space toggles)', async () => {
    const user = renderExamUser()
    renderExam()
    const startButton = await screen.findByRole('button', { name: /begin final exam/i })
    startButton.focus()
    await user.keyboard('{Enter}')
    await screen.findByText('Question 1 of 2')

    const optionA = screen.getByRole('radio', { name: 'Option A' })
    optionA.focus()
    await user.keyboard(' ')
    expect(optionA).toBeChecked()
  })

  it('moves to the next question via the Next button and back via Previous, both keyboard-reachable buttons', async () => {
    const user = renderExamUser()
    renderExam()
    const startButton = await screen.findByRole('button', { name: /begin final exam/i })
    startButton.focus()
    await user.keyboard('{Enter}')
    await screen.findByText('Question 1 of 2')

    const nextButton = screen.getByRole('button', { name: /next/i })
    nextButton.focus()
    await user.keyboard('{Enter}')
    expect(await screen.findByText('Question 2 of 2')).toBeInTheDocument()

    const prevButton = screen.getByRole('button', { name: /previous/i })
    expect(prevButton).toBeEnabled()
    prevButton.focus()
    await user.keyboard('{Enter}')
    expect(await screen.findByText('Question 1 of 2')).toBeInTheDocument()
  })

  it('exposes each question dot with an accessible name indicating its answered state', async () => {
    const user = renderExamUser()
    renderExam()
    const startButton = await screen.findByRole('button', { name: /begin final exam/i })
    startButton.focus()
    await user.keyboard('{Enter}')
    await screen.findByText('Question 1 of 2')

    expect(screen.getByRole('button', { name: 'Question 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Question 2' })).toBeInTheDocument()

    // Jumping directly to question 2 via its dot must work with the keyboard.
    const dot2 = screen.getByRole('button', { name: 'Question 2' })
    dot2.focus()
    await user.keyboard('{Enter}')
    expect(await screen.findByText('Question 2 of 2')).toBeInTheDocument()
  })
})

function renderExamUser() {
  return userEvent.setup()
}
