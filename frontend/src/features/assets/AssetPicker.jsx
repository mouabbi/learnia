/**
 * AssetPicker — grid of a course's uploaded assets (images/video/PDFs),
 * click a thumbnail to select it. Self-contained: fetches its own list via
 * assetsApi.listAssets on mount / when `courseId` changes, no store wiring
 * required from the caller.
 *
 * Meant to be dropped into a future CMS content-block editor to pick the
 * asset an ImageBlock/VideoBlock should reference (see
 * backend/src/learnia_backend/schemas/content.py — blocks store an asset's
 * resolved `url` in `src` today; the caller decides what to do with the
 * selected asset).
 *
 * Props:
 *   - courseId (string|number, required): which course's assets to list.
 *   - onSelect (asset) => void, required: called with the full asset object
 *     ({ id, courseId, filename, mimeType, sizeBytes, url, uploadedAt })
 *     when the user clicks a thumbnail.
 *   - selectedAssetId (string|number, optional): id of the currently
 *     selected asset, if any — highlights that tile.
 *   - accept (string, optional): mime-type prefix filter, e.g. "image/" or
 *     "video/" — only assets whose mimeType starts with this are shown.
 *     Defaults to showing everything.
 *
 * Renders nothing fancy for non-image types — a filename + mime badge tile
 * — since this app doesn't need video/PDF thumbnails yet.
 */

import { useEffect, useState } from 'react'
import { FileText, Film, Image as ImageIcon } from 'lucide-react'
import { assetsApi } from './assetsApi'

function iconFor(mimeType) {
  if (mimeType.startsWith('video/')) return Film
  if (mimeType === 'application/pdf') return FileText
  return ImageIcon
}

export function AssetPicker({ courseId, onSelect, selectedAssetId, accept }) {
  const [assets, setAssets] = useState([])
  const [status, setStatus] = useState('idle') // idle | loading | error | ready
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!courseId) return
    let cancelled = false
    setStatus('loading')
    assetsApi
      .listAssets(courseId)
      .then((data) => {
        if (cancelled) return
        setAssets(data ?? [])
        setStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setError(err)
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [courseId])

  if (status === 'loading' || status === 'idle') {
    return <p className="asset-picker-status">Loading assets…</p>
  }
  if (status === 'error') {
    return <p className="asset-picker-status asset-picker-error">Couldn't load assets{error?.message ? `: ${error.message}` : ''}.</p>
  }

  const visible = accept ? assets.filter((a) => a.mimeType.startsWith(accept)) : assets

  if (visible.length === 0) {
    return <p className="asset-picker-status">No assets uploaded yet.</p>
  }

  return (
    <div className="asset-picker-grid" role="listbox" aria-label="Course assets">
      {visible.map((asset) => {
        const Icon = iconFor(asset.mimeType)
        const isImage = asset.mimeType.startsWith('image/')
        const isSelected = String(asset.id) === String(selectedAssetId)
        return (
          <button
            key={asset.id}
            type="button"
            role="option"
            aria-selected={isSelected}
            className={`asset-picker-tile${isSelected ? ' asset-picker-tile-selected' : ''}`}
            onClick={() => onSelect(asset)}
            title={asset.filename}
          >
            {isImage ? (
              <img src={asset.url} alt={asset.filename} className="asset-picker-thumb" />
            ) : (
              <Icon aria-hidden="true" size={28} />
            )}
            <span className="asset-picker-filename">{asset.filename}</span>
          </button>
        )
      })}
    </div>
  )
}
