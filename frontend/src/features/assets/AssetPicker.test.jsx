import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AssetPicker } from './AssetPicker'
import { assetsApi } from './assetsApi'

// Mock only assetsApi: the picker is tested alone, without a real backend.
vi.mock('./assetsApi', () => ({
  assetsApi: { listAssets: vi.fn() },
}))

const onSelect = vi.fn()

beforeEach(() => {
  vi.resetAllMocks()
})

describe('AssetPicker', () => {
  it('shows a loading state, then lists assets for the course', async () => {
    assetsApi.listAssets.mockResolvedValue([
      { id: 1, filename: 'photo.png', mimeType: 'image/png', url: '/a/photo.png' },
    ])
    render(<AssetPicker courseId="course-1" onSelect={onSelect} />)
    expect(screen.getByText(/loading assets/i)).toBeInTheDocument()
    expect(await screen.findByText('photo.png')).toBeInTheDocument()
    expect(assetsApi.listAssets).toHaveBeenCalledWith('course-1')
  })

  it('shows an empty state when there are no assets', async () => {
    assetsApi.listAssets.mockResolvedValue([])
    render(<AssetPicker courseId="course-1" onSelect={onSelect} />)
    expect(await screen.findByText('No assets uploaded yet.')).toBeInTheDocument()
  })

  it('shows an error state when loading fails', async () => {
    assetsApi.listAssets.mockRejectedValue(new Error('network down'))
    render(<AssetPicker courseId="course-1" onSelect={onSelect} />)
    expect(await screen.findByText(/couldn't load assets: network down/i)).toBeInTheDocument()
  })

  it('calls onSelect with the full asset when a tile is clicked', async () => {
    const asset = { id: 1, filename: 'photo.png', mimeType: 'image/png', url: '/a/photo.png' }
    assetsApi.listAssets.mockResolvedValue([asset])
    render(<AssetPicker courseId="course-1" onSelect={onSelect} />)
    await userEvent.click(await screen.findByRole('option', { name: /photo\.png/i }))
    expect(onSelect).toHaveBeenCalledWith(asset)
  })

  it('filters assets by the accept mime-type prefix', async () => {
    assetsApi.listAssets.mockResolvedValue([
      { id: 1, filename: 'photo.png', mimeType: 'image/png', url: '/a/photo.png' },
      { id: 2, filename: 'clip.mp4', mimeType: 'video/mp4', url: '/a/clip.mp4' },
    ])
    render(<AssetPicker courseId="course-1" onSelect={onSelect} accept="image/" />)
    expect(await screen.findByText('photo.png')).toBeInTheDocument()
    expect(screen.queryByText('clip.mp4')).not.toBeInTheDocument()
  })
})
