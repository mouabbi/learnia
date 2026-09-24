import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AiImportModal } from './AiImportModal'
import { cmsApi } from './cmsApi'

// Mock only cmsApi: the modal is tested alone, without a real backend.
vi.mock('./cmsApi', () => ({
  cmsApi: {
    getPrompt: vi.fn(),
    validateImport: vi.fn(),
    commitImport: vi.fn(),
  },
}))

const onClose = vi.fn()
const onCommitted = vi.fn()

function renderModal(props = {}) {
  return render(
    <AiImportModal
      open
      onClose={onClose}
      courseId="course-1"
      scope="page"
      targetIds={{ chapterId: 'ch-1', pageId: 'page-1' }}
      onCommitted={onCommitted}
      {...props}
    />,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AiImportModal', () => {
  it('renders nothing when closed', () => {
    cmsApi.getPrompt.mockResolvedValue({ prompt: 'unused' })
    const { container } = render(
      <AiImportModal open={false} onClose={onClose} courseId="course-1" scope="page" />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('fetches and displays the prompt on open', async () => {
    cmsApi.getPrompt.mockResolvedValue({ prompt: 'Generate a page about X' })
    renderModal()
    expect(await screen.findByDisplayValue('Generate a page about X')).toBeInTheDocument()
    expect(cmsApi.getPrompt).toHaveBeenCalledWith('course-1', 'page', { chapterId: 'ch-1', pageId: 'page-1' })
  })

  it('shows an error when the prompt fails to load', async () => {
    cmsApi.getPrompt.mockRejectedValue(new Error('boom'))
    renderModal()
    expect(await screen.findByText('boom')).toBeInTheDocument()
  })

  it('copies the prompt to the clipboard and shows confirmation', async () => {
    cmsApi.getPrompt.mockResolvedValue({ prompt: 'Some prompt text' })
    renderModal()
    await screen.findByDisplayValue('Some prompt text')
    await userEvent.click(screen.getByRole('button', { name: /copy to clipboard/i }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Some prompt text')
    expect(await screen.findByText('Copied')).toBeInTheDocument()
  })

  it('moves to step 2 and validates pasted JSON', async () => {
    cmsApi.getPrompt.mockResolvedValue({ prompt: 'p' })
    cmsApi.validateImport.mockResolvedValue({
      valid: true,
      parsed: { blocks: [] },
    })
    renderModal()
    await screen.findByDisplayValue('p')
    await userEvent.click(screen.getByRole('button', { name: /next: paste json/i }))

    const textarea = await screen.findByPlaceholderText('{ ... }')
    await userEvent.click(textarea)
    await userEvent.paste('{"blocks":[]}')
    await userEvent.click(screen.getByRole('button', { name: 'Validate' }))

    expect(await screen.findByText('Looks valid. Preview:')).toBeInTheDocument()
    expect(cmsApi.validateImport).toHaveBeenCalledWith('course-1', 'page', '{"blocks":[]}')
  })

  it('shows validation errors when the pasted JSON is invalid', async () => {
    cmsApi.getPrompt.mockResolvedValue({ prompt: 'p' })
    cmsApi.validateImport.mockResolvedValue({
      valid: false,
      errors: [{ field: 'blocks', message: 'must be an array' }],
    })
    renderModal()
    await screen.findByDisplayValue('p')
    await userEvent.click(screen.getByRole('button', { name: /next: paste json/i }))
    await userEvent.click(await screen.findByPlaceholderText('{ ... }'))
    await userEvent.paste('{"bad":true}')
    await userEvent.click(screen.getByRole('button', { name: 'Validate' }))

    expect(await screen.findByText(/invalid json/i)).toBeInTheDocument()
    expect(screen.getByText(/must be an array/)).toBeInTheDocument()
    // Commit stays disabled until validation succeeds.
    expect(screen.getByRole('button', { name: 'Commit' })).toBeDisabled()
  })

  it('commits valid JSON and calls onCommitted then closes', async () => {
    cmsApi.getPrompt.mockResolvedValue({ prompt: 'p' })
    cmsApi.validateImport.mockResolvedValue({ valid: true, parsed: { blocks: [] } })
    cmsApi.commitImport.mockResolvedValue({ ok: true })
    renderModal()
    await screen.findByDisplayValue('p')
    await userEvent.click(screen.getByRole('button', { name: /next: paste json/i }))
    await userEvent.click(await screen.findByPlaceholderText('{ ... }'))
    await userEvent.paste('{"blocks":[]}')
    await userEvent.click(screen.getByRole('button', { name: 'Validate' }))
    await screen.findByText('Looks valid. Preview:')

    await userEvent.click(screen.getByRole('button', { name: 'Commit' }))

    expect(cmsApi.commitImport).toHaveBeenCalledWith('course-1', 'page', '{"blocks":[]}', {
      replace: false,
      chapterId: 'ch-1',
      pageId: 'page-1',
    })
    expect(onCommitted).toHaveBeenCalledWith({ ok: true })
    expect(onClose).toHaveBeenCalled()
  })

  it('shows a replace-confirmation flow when commit requires replace:true', async () => {
    cmsApi.getPrompt.mockResolvedValue({ prompt: 'p' })
    cmsApi.validateImport.mockResolvedValue({ valid: true, parsed: { blocks: [] } })
    const err = new Error('Target already has content; pass replace:true to overwrite')
    err.code = 'VALIDATION_ERROR'
    cmsApi.commitImport.mockRejectedValueOnce(err).mockResolvedValueOnce({ ok: true })

    renderModal()
    await screen.findByDisplayValue('p')
    await userEvent.click(screen.getByRole('button', { name: /next: paste json/i }))
    await userEvent.click(await screen.findByPlaceholderText('{ ... }'))
    await userEvent.paste('{"blocks":[]}')
    await userEvent.click(screen.getByRole('button', { name: 'Validate' }))
    await screen.findByText('Looks valid. Preview:')

    await userEvent.click(screen.getByRole('button', { name: 'Commit' }))

    const overwriteButton = await screen.findByRole('button', { name: /overwrite existing content/i })
    expect(screen.getByText(err.message)).toBeInTheDocument()

    await userEvent.click(overwriteButton)

    expect(cmsApi.commitImport).toHaveBeenLastCalledWith('course-1', 'page', '{"blocks":[]}', {
      replace: true,
      chapterId: 'ch-1',
      pageId: 'page-1',
    })
    expect(onCommitted).toHaveBeenCalledWith({ ok: true })
  })

  it('shows a generic commit error for non-replace failures', async () => {
    cmsApi.getPrompt.mockResolvedValue({ prompt: 'p' })
    cmsApi.validateImport.mockResolvedValue({ valid: true, parsed: { blocks: [] } })
    cmsApi.commitImport.mockRejectedValue(new Error('Server exploded'))

    renderModal()
    await screen.findByDisplayValue('p')
    await userEvent.click(screen.getByRole('button', { name: /next: paste json/i }))
    await userEvent.click(await screen.findByPlaceholderText('{ ... }'))
    await userEvent.paste('{"blocks":[]}')
    await userEvent.click(screen.getByRole('button', { name: 'Validate' }))
    await screen.findByText('Looks valid. Preview:')

    await userEvent.click(screen.getByRole('button', { name: 'Commit' }))

    expect(await screen.findByText('Server exploded')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /overwrite existing content/i })).not.toBeInTheDocument()
  })

  it('closes the modal when the close button is clicked', async () => {
    cmsApi.getPrompt.mockResolvedValue({ prompt: 'p' })
    renderModal()
    await screen.findByDisplayValue('p')
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
  })
})
