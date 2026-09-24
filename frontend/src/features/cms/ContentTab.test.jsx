// Accessibility checks for the CMS's ContentTab block editor forms
// (19-performance-accessibility: CMS forms).
//
// ASSUMED DEPENDENCY: `vitest-axe`, not yet in frontend/package.json (see
// BlockRenderer.test.jsx for the same note).
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { toHaveNoViolations } from 'vitest-axe/matchers'
import { ContentTab } from './ContentTab'
import { cmsApi } from './cmsApi'

expect.extend({ toHaveNoViolations })

vi.mock('./cmsApi', () => ({
  cmsApi: { getPageContent: vi.fn(), putPageContent: vi.fn() },
}))

const PAGE = { id: '1', title: 'Intro', chapterId: '10' }

async function renderLoaded(blocks = []) {
  cmsApi.getPageContent.mockResolvedValue({ blocks })
  render(<ContentTab page={PAGE} onGenerateWithAi={vi.fn()} />)
  await waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument())
}

describe('ContentTab block editor forms', () => {
  it('gives every block editor field a text label wrapping its input (BlockEditors.jsx Field)', async () => {
    await renderLoaded([{ type: 'heading', text: 'Hello', level: 2, numbered: false }])
    expect(screen.getByLabelText('Text')).toHaveValue('Hello')
    expect(screen.getByLabelText('Level')).toBeInTheDocument()
  })

  it('lets a keyboard user add a block, tab to its fields, and type into them', async () => {
    const user = userEvent.setup()
    await renderLoaded([])
    await user.click(screen.getByRole('button', { name: /paragraph/i }))
    const textField = await screen.findByLabelText('Text')
    await user.click(textField)
    await user.keyboard('Some paragraph text')
    expect(textField).toHaveValue('Some paragraph text')
  })

  it('exposes Preview/Edit and Save as reachable, labelled buttons', async () => {
    await renderLoaded([])
    expect(screen.getByRole('button', { name: /preview/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument()
  })

  it('has no detectable axe violations on the block editor form', async () => {
    cmsApi.getPageContent.mockResolvedValue({
      blocks: [{ type: 'paragraph', text: 'Hello world' }],
    })
    const { container } = render(<ContentTab page={PAGE} onGenerateWithAi={vi.fn()} />)
    await waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument())
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  // Regression: "Generate with AI" on this tab used to omit `pageId`, only
  // passing `chapterId` — commit_page on the backend requires page_id, so
  // committing page-scope AI content silently had nowhere to save to.
  it('calls onGenerateWithAi with both chapterId and pageId when "Generate with AI" is clicked', async () => {
    const user = userEvent.setup()
    const onGenerateWithAi = vi.fn()
    cmsApi.getPageContent.mockResolvedValue({ blocks: [] })
    render(<ContentTab page={PAGE} onGenerateWithAi={onGenerateWithAi} />)
    await waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /generate with ai/i }))
    expect(onGenerateWithAi).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'page', chapterId: PAGE.chapterId, pageId: PAGE.id })
    )
  })
})
