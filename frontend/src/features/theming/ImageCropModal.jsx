import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { X, ZoomIn, ZoomOut, Check } from 'lucide-react'

// Fixed output aspect ratio for every course thumbnail (catalog card +
// CMS picker card) — object-fit:cover already tolerates a card being a
// slightly different ratio, but the SOURCE image needs one consistent crop
// so "what you see in this modal" matches "what renders on the card".
const ASPECT = 2.4
const FRAME_WIDTH = 420
const FRAME_HEIGHT = Math.round(FRAME_WIDTH / ASPECT)
const OUTPUT_WIDTH = 960
const OUTPUT_HEIGHT = Math.round(OUTPUT_WIDTH / ASPECT)

/**
 * A minimal "profile-picture style" crop/zoom modal — pick a photo, drag to
 * reposition it, zoom with a slider, confirm, get back a cropped Blob at a
 * fixed output size. No cropping library: a translate+scale <img> inside a
 * fixed-size clipped frame, exported to a canvas at save time. Same idea as
 * cropping a cover photo on any social app, just built from scratch to
 * avoid pulling in a dependency for one modal.
 *
 * Props:
 *  - file (File, required): the image the user just picked.
 *  - onCancel(): close without saving.
 *  - onSave(blob): called with the cropped image as a PNG Blob (PNG, not
 *    JPEG, so a transparent-background source — e.g. a logo — keeps its
 *    transparency instead of getting flattened to black).
 */
export function ImageCropModal({ file, onCancel, onSave }) {
  const imgRef = useRef(null)
  const frameRef = useRef(null)
  const [imageUrl, setImageUrl] = useState(null)
  const [naturalSize, setNaturalSize] = useState(null)
  const [scale, setScale] = useState(1)
  const [minScale, setMinScale] = useState(1)
  const [maxScale, setMaxScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragState = useRef(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setImageUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const handleImageLoad = () => {
    const img = imgRef.current
    if (!img) return
    const { naturalWidth, naturalHeight } = img
    setNaturalSize({ w: naturalWidth, h: naturalHeight })
    const coverScale = Math.max(FRAME_WIDTH / naturalWidth, FRAME_HEIGHT / naturalHeight)
    // "Contain" the frame: scale so the WHOLE image fits, letterboxed —
    // the real lower bound for zoom, not "cover". A transparent-background
    // logo needs to be able to zoom OUT past "fills the frame" to show its
    // full extent (padding and all), not just zoom further in from there.
    const containScale = Math.min(FRAME_WIDTH / naturalWidth, FRAME_HEIGHT / naturalHeight)
    // Allow zooming out well past "fits exactly" too — useful for a small
    // logo you want to sit with a lot of breathing room in the frame,
    // rather than the frame being the hard floor on how small it can go.
    setMinScale(containScale * 0.4)
    setMaxScale(coverScale * 3)
    setScale(coverScale)
    setOffset({ x: 0, y: 0 })
  }

  const clampOffset = (next, currentScale) => {
    if (!naturalSize) return next
    const w = naturalSize.w * currentScale
    const h = naturalSize.h * currentScale
    const maxX = Math.max(0, (w - FRAME_WIDTH) / 2)
    const maxY = Math.max(0, (h - FRAME_HEIGHT) / 2)
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    }
  }

  const onPointerDown = (e) => {
    dragState.current = { startX: e.clientX, startY: e.clientY, offset }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e) => {
    if (!dragState.current) return
    const dx = e.clientX - dragState.current.startX
    const dy = e.clientY - dragState.current.startY
    setOffset(clampOffset({ x: dragState.current.offset.x + dx, y: dragState.current.offset.y + dy }, scale))
  }

  const onPointerUp = () => {
    dragState.current = null
  }

  const handleScaleChange = (nextScale) => {
    const clamped = Math.min(maxScale, Math.max(minScale, nextScale))
    setScale(clamped)
    setOffset((prev) => clampOffset(prev, clamped))
  }

  const step = (maxScale - minScale) / 20 || 0.05
  const zoomOut = () => handleScaleChange(scale - step)
  const zoomIn = () => handleScaleChange(scale + step)

  const previewStyle = useMemo(
    () => ({
      width: naturalSize ? naturalSize.w * scale : 'auto',
      height: naturalSize ? naturalSize.h * scale : 'auto',
      transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
    }),
    [naturalSize, scale, offset],
  )

  const handleSave = () => {
    if (!naturalSize) return
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT_WIDTH
    canvas.height = OUTPUT_HEIGHT
    const ctx = canvas.getContext('2d')
    const outputScale = OUTPUT_WIDTH / FRAME_WIDTH

    // The frame shows a FRAME_WIDTH x FRAME_HEIGHT window onto the scaled
    // image, centered, then panned by `offset`. Reproduce that same window
    // at OUTPUT resolution.
    const drawWidth = naturalSize.w * scale * outputScale
    const drawHeight = naturalSize.h * scale * outputScale
    const drawX = (OUTPUT_WIDTH - drawWidth) / 2 + offset.x * outputScale
    const drawY = (OUTPUT_HEIGHT - drawHeight) / 2 + offset.y * outputScale

    ctx.drawImage(imgRef.current, drawX, drawY, drawWidth, drawHeight)
    // PNG, not JPEG: JPEG has no alpha channel, so a transparent-background
    // logo would get its transparency flattened to opaque black — PNG
    // keeps it transparent so the thumbnail composites correctly onto
    // whatever gradient/background the course card renders behind it.
    canvas.toBlob((blob) => blob && onSave(blob), 'image/png')
  }

  return (
    <AnimatePresence>
      <motion.div
        className="cms-modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
      >
        <motion.div
          className="cms-modal"
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="cms-modal-header">
            <h3>Position your thumbnail</h3>
            <button type="button" className="cms-btn-icon" onClick={onCancel} aria-label="Close">
              <X size={16} />
            </button>
          </div>

          <p className="cms-hint">
            Drag to reposition, zoom out to see the whole image or zoom in to fill the frame —
            this is exactly what learners will see.
          </p>

          <div
            ref={frameRef}
            className="crop-frame"
            style={{ width: FRAME_WIDTH, height: FRAME_HEIGHT }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            {imageUrl && (
              <img
                ref={imgRef}
                src={imageUrl}
                alt=""
                onLoad={handleImageLoad}
                className="crop-frame-image"
                style={previewStyle}
                draggable={false}
              />
            )}
          </div>

          <div className="crop-zoom-row">
            <button
              type="button"
              className="cms-btn-icon"
              onClick={zoomOut}
              disabled={!naturalSize || scale <= minScale}
              aria-label="Zoom out"
              title="Zoom out"
            >
              <ZoomOut size={16} />
            </button>
            <input
              type="range"
              min={minScale}
              max={maxScale}
              step={(maxScale - minScale) / 200 || 0.01}
              value={scale}
              onChange={(e) => handleScaleChange(Number(e.target.value))}
              disabled={!naturalSize}
            />
            <button
              type="button"
              className="cms-btn-icon"
              onClick={zoomIn}
              disabled={!naturalSize || scale >= maxScale}
              aria-label="Zoom in"
              title="Zoom in"
            >
              <ZoomIn size={16} />
            </button>
          </div>

          <div className="cms-modal-actions">
            <button type="button" className="cms-btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className="cms-btn-primary" onClick={handleSave} disabled={!naturalSize}>
              <Check size={15} aria-hidden="true" /> Use this thumbnail
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
