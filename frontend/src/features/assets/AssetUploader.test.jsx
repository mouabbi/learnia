import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AssetUploader } from './AssetUploader'
import { assetsApi } from './assetsApi'

// Mock only assetsApi: the uploader is tested alone, without a real backend.
vi.mock('./assetsApi', () => ({
  assetsApi: { uploadAsset: vi.fn() },
}))

const onUploaded = vi.fn()
const onError = vi.fn()

function file(name = 'photo.png', type = 'image/png') {
  return new File(['content'], name, { type })
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('AssetUploader', () => {
  it('uploads a selected file and reports success', async () => {
    const asset = { id: 1, filename: 'photo.png', mimeType: 'image/png', url: '/a/photo.png' }
    assetsApi.uploadAsset.mockResolvedValue(asset)
    render(<AssetUploader courseId="course-1" onUploaded={onUploaded} onError={onError} />)

    const input = document.querySelector('.asset-uploader-input')
    await userEvent.upload(input, file())

    expect(assetsApi.uploadAsset).toHaveBeenCalledWith('course-1', expect.any(File))
    expect(await screen.findByText('photo.png')).toBeInTheDocument()
    expect(onUploaded).toHaveBeenCalledWith(asset)
  })

  it('surfaces a validation error from the API on upload failure', async () => {
    const err = new Error('Unsupported file type')
    err.code = 'VALIDATION_ERROR'
    assetsApi.uploadAsset.mockRejectedValue(err)
    render(<AssetUploader courseId="course-1" onUploaded={onUploaded} onError={onError} />)

    const input = document.querySelector('.asset-uploader-input')
    await userEvent.upload(input, file('bad.exe', 'application/octet-stream'))

    expect(await screen.findByText('bad.exe')).toBeInTheDocument()
    expect(onError).toHaveBeenCalledWith(err)
  })

  it('uploads multiple files independently', async () => {
    assetsApi.uploadAsset.mockResolvedValue({ id: 1, filename: 'a.png', mimeType: 'image/png', url: '/a.png' })
    render(<AssetUploader courseId="course-1" onUploaded={onUploaded} onError={onError} />)

    const input = document.querySelector('.asset-uploader-input')
    await userEvent.upload(input, [file('a.png'), file('b.png')])

    expect(assetsApi.uploadAsset).toHaveBeenCalledTimes(2)
  })
})
