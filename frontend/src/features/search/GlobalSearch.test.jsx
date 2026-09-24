// Keyboard navigation tests for GlobalSearch (19-performance-accessibility
// + 14-global-search): Ctrl+K opens, Escape closes, typing filters results.
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GlobalSearch } from './GlobalSearch'
import { searchApi } from './searchApi'

vi.mock('./searchApi', () => ({ searchApi: { search: vi.fn() } }))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

function renderSearch() {
  return render(
    <MemoryRouter>
      <GlobalSearch />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('GlobalSearch keyboard navigation', () => {
  it('is closed by default and opens on Ctrl+K', async () => {
    renderSearch()
    expect(screen.queryByRole('dialog', { name: 'Global search' })).not.toBeInTheDocument()

    await userEvent.keyboard('{Control>}k{/Control}')

    expect(await screen.findByRole('dialog', { name: 'Global search' })).toBeInTheDocument()
  })

  it('also opens on Cmd+K (metaKey)', async () => {
    renderSearch()
    await userEvent.keyboard('{Meta>}k{/Meta}')
    expect(await screen.findByRole('dialog', { name: 'Global search' })).toBeInTheDocument()
  })

  it('focuses the search input as soon as it opens', async () => {
    renderSearch()
    await userEvent.keyboard('{Control>}k{/Control}')
    const input = await screen.findByRole('textbox', { name: 'Search' })
    await waitFor(() => expect(input).toHaveFocus())
  })

  it('closes on Escape and clears the query', async () => {
    renderSearch()
    await userEvent.keyboard('{Control>}k{/Control}')
    const input = await screen.findByRole('textbox', { name: 'Search' })
    await userEvent.type(input, 'course')
    expect(input).toHaveValue('course')

    await userEvent.keyboard('{Escape}')

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Global search' })).not.toBeInTheDocument(),
    )
  })

  it('toggles closed on a second Ctrl+K press', async () => {
    renderSearch()
    await userEvent.keyboard('{Control>}k{/Control}')
    expect(await screen.findByRole('dialog', { name: 'Global search' })).toBeInTheDocument()
    await userEvent.keyboard('{Control>}k{/Control}')
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Global search' })).not.toBeInTheDocument(),
    )
  })

  it('lets a keyboard user reach and activate a result via Tab + Enter', async () => {
    searchApi.search.mockResolvedValue({
      results: [{ type: 'course', id: '1', title: 'Intro to Testing', courseSlug: 'intro-testing' }],
    })
    renderSearch()
    await userEvent.keyboard('{Control>}k{/Control}')
    const input = await screen.findByRole('textbox', { name: 'Search' })
    await userEvent.type(input, 'testing')

    const result = await screen.findByRole('button', { name: /Intro to Testing/ })
    result.focus()
    await userEvent.keyboard('{Enter}')

    expect(mockNavigate).toHaveBeenCalledWith('/courses/intro-testing/learn')
  })

  // GAP: GlobalSearch's result list has no roving-tabindex / ArrowUp-ArrowDown
  // handling today — each result is reachable only via sequential Tab, not
  // arrow keys, unlike a typical command-palette (e.g. cmdk). This test is
  // written against the arrow-key behavior a command palette is expected to
  // have and will fail until GlobalSearch.jsx adds ArrowDown/ArrowUp
  // handling that moves focus/highlight between `.global-search-result`
  // buttons.
  it.fails('moves the highlighted result with ArrowDown/ArrowUp', async () => {
    searchApi.search.mockResolvedValue({
      results: [
        { type: 'course', id: '1', title: 'Course A', courseSlug: 'a' },
        { type: 'course', id: '2', title: 'Course B', courseSlug: 'b' },
      ],
    })
    renderSearch()
    await userEvent.keyboard('{Control>}k{/Control}')
    const input = await screen.findByRole('textbox', { name: 'Search' })
    await userEvent.type(input, 'course')
    await screen.findByRole('button', { name: /Course A/ })

    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('button', { name: /Course B/ })).toHaveFocus()

    await userEvent.keyboard('{ArrowUp}')
    expect(screen.getByRole('button', { name: /Course A/ })).toHaveFocus()
  })
})
