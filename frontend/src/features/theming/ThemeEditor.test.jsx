// Accessibility checks for ThemeEditor's color-picker form
// (19-performance-accessibility: "labels associated with inputs").
//
// ASSUMED DEPENDENCY: `vitest-axe`, not yet in frontend/package.json (see
// BlockRenderer.test.jsx for the same note). Until installed, the
// axe-driven test below fails to resolve its import.
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { toHaveNoViolations } from 'vitest-axe/matchers'
import { ThemeEditor } from './ThemeEditor'
import { themeApi } from './themeApi'

expect.extend({ toHaveNoViolations })

vi.mock('./themeApi', () => ({
  themeApi: { getTheme: vi.fn(), updateTheme: vi.fn() },
}))

const THEME = {
  accent: '#3366ff',
  secondary: '#334455',
  headingColor: '#111111',
  modulePalette: ['#aabbcc', '#ccbbaa'],
  light: { background: '#ffffff', surface: '#f5f5f5', text: '#111111' },
  dark: { background: '#111111', surface: '#222222', text: '#ffffff' },
}

async function renderLoaded() {
  themeApi.getTheme.mockResolvedValue({ theme: THEME, warnings: [] })
  render(<ThemeEditor courseId="1" />)
  await waitFor(() => expect(screen.queryByText('Loading theme…')).not.toBeInTheDocument())
}

describe('ThemeEditor form accessibility', () => {
  it('associates every color input with a visible label via aria-label', async () => {
    await renderLoaded()
    expect(screen.getByLabelText('Accent')).toBeInTheDocument()
    expect(screen.getByLabelText('Secondary')).toBeInTheDocument()
    expect(screen.getByLabelText('Heading color')).toBeInTheDocument()
    // Multiple "Background"/"Surface"/"Text" fields exist (light + dark) —
    // getAllByLabelText confirms each occurrence still resolves to a real
    // labelled input rather than colliding/silently losing its label.
    expect(screen.getAllByLabelText('Background').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByLabelText('Surface').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByLabelText('Text').length).toBeGreaterThanOrEqual(2)
  })

  it('labels each module palette swatch distinctly (Module 1, Module 2, ...)', async () => {
    await renderLoaded()
    expect(screen.getByLabelText('Module 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Module 2')).toBeInTheDocument()
  })

  it('renders WCAG contrast warnings so they are announced (role/alert-adjacent text), not just visual', async () => {
    themeApi.getTheme.mockResolvedValue({
      theme: THEME,
      warnings: ['accent on light background: 2.1:1, fails AA (needs 4.5:1)'],
    })
    render(<ThemeEditor courseId="1" />)
    expect(await screen.findByText(/fails AA/)).toBeInTheDocument()
  })

  it('has no detectable axe violations on the loaded form', async () => {
    const { container } = await renderLoadedContainer()
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})

async function renderLoadedContainer() {
  themeApi.getTheme.mockResolvedValue({ theme: THEME, warnings: [] })
  const utils = render(<ThemeEditor courseId="1" />)
  await waitFor(() => expect(screen.queryByText('Loading theme…')).not.toBeInTheDocument())
  return utils
}
