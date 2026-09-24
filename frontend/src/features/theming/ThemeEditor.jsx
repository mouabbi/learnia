import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, Loader2, ImagePlus, ImageOff, X } from 'lucide-react'
import { themeApi } from './themeApi'
import { assetsApi } from '../assets/assetsApi'
import { AssetPicker } from '../assets/AssetPicker'
import { ImageCropModal } from './ImageCropModal'
import './theme-editor.css'

// Rules for a course thumbnail upload — checked client-side before the file
// ever reaches the crop step, so a bad pick fails fast with a clear reason
// instead of an opaque server error later.
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_IMAGE_MB = 8

/**
 * ThemeEditor — CMS color-picker UI for a course's per-course theme
 * (16-theming). Never exposes raw JSON: every field is a native
 * `<input type="color">` swatch, with a live preview panel and inline
 * WCAG contrast warnings sourced from the backend (routers/theme.py's
 * `warnings` array, computed by utils/contrast.py).
 *
 * Props:
 *   - courseId (string|number, required): which course's theme to load
 *     and save. Used as `/courses/{courseId}/theme`.
 *   - onSave (function(theme), optional): called after a successful save
 *     with the saved CourseTheme object — e.g. so a hosting CMS page can
 *     refresh a course list's swatch. The component always saves via its
 *     own themeApi call regardless of whether this is provided; it's a
 *     notification hook, not a substitute for the API call.
 *
 * Self-contained: fetches the current theme on mount, edits are local
 * until "Save theme" is clicked. Not yet wired into a route/page — the
 * CMS workspace hosting it is being built separately.
 */
export function ThemeEditor({ courseId, onSave }) {
  const [theme, setTheme] = useState(null)
  const [warnings, setWarnings] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [showAssetPicker, setShowAssetPicker] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [pendingFile, setPendingFile] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    themeApi
      .getTheme(courseId)
      .then((res) => {
        if (cancelled) return
        setTheme(res.theme)
        setWarnings(res.warnings ?? [])
      })
      .catch((err) => !cancelled && setError(err.message ?? 'Failed to load theme'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [courseId])

  const setField = useCallback((path, value) => {
    setTheme((prev) => {
      if (!prev) return prev
      if (path.length === 1) return { ...prev, [path[0]]: value }
      const [group, key] = path
      return { ...prev, [group]: { ...prev[group], [key]: value } }
    })
  }, [])

  const handleUpload = useCallback(
    async (file) => {
      setUploading(true)
      setUploadError(null)
      try {
        const asset = await assetsApi.uploadAsset(courseId, file)
        setField(['image'], asset.url)
      } catch (err) {
        setUploadError(err.message ?? 'Upload failed')
      } finally {
        setUploading(false)
      }
    },
    [courseId, setField],
  )

  // Step 1 of the "profile-picture style" flow: validate the raw file pick,
  // then hand it to the crop modal instead of uploading it as-is — the crop
  // step is what fixes badly-composed source images (see ImageCropModal.jsx).
  const handleFilePicked = useCallback((file) => {
    setUploadError(null)
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setUploadError('Please choose a JPEG, PNG, WebP, or GIF image.')
      return
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      setUploadError(`Image is too large — please choose one under ${MAX_IMAGE_MB} MB.`)
      return
    }
    setPendingFile(file)
  }, [])

  const handleCropSave = useCallback(
    (blob) => {
      setPendingFile(null)
      handleUpload(new File([blob], 'thumbnail.png', { type: 'image/png' }))
    },
    [handleUpload],
  )

  const setModulePaletteColor = useCallback((index, value) => {
    setTheme((prev) => {
      if (!prev) return prev
      const next = [...prev.modulePalette]
      next[index] = value
      return { ...prev, modulePalette: next }
    })
  }, [])

  const handleSave = useCallback(async () => {
    if (!theme) return
    setSaving(true)
    setError(null)
    try {
      const res = await themeApi.updateTheme(courseId, theme)
      setTheme(res.theme)
      setWarnings(res.warnings ?? [])
      onSave?.(res.theme)
    } catch (err) {
      setError(err.message ?? 'Failed to save theme')
    } finally {
      setSaving(false)
    }
  }, [courseId, theme, onSave])

  if (loading) {
    return (
      <div className="theme-editor theme-editor-loading">
        <Loader2 size={18} className="theme-editor-spinner" aria-hidden="true" />
        Loading theme…
      </div>
    )
  }

  if (!theme) {
    return <div className="theme-editor theme-editor-error">{error ?? 'No theme data'}</div>
  }

  return (
    <div className="theme-editor">
      <section className="theme-editor-section theme-editor-thumbnail-section">
        <h3>Course thumbnail</h3>
        <p className="theme-editor-hint">
          Shown as the cover image on the learner catalog card — falls back to the course icon
          (see the Icon picker above) when no thumbnail is set.
        </p>
        <div className="theme-editor-thumbnail-row">
          <div className="theme-editor-thumbnail-preview">
            {theme.image ? (
              <img src={theme.image} alt="Course thumbnail" />
            ) : (
              <span className="theme-editor-thumbnail-empty">No image</span>
            )}
          </div>
          <div className="theme-editor-thumbnail-actions">
            <label className="cms-btn-secondary theme-editor-upload-btn">
              {uploading ? <Loader2 size={14} className="theme-editor-spinner" /> : <ImagePlus size={14} />}
              {uploading ? 'Uploading…' : 'Upload image'}
              <input
                type="file"
                accept="image/*"
                hidden
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) handleFilePicked(file)
                }}
              />
            </label>
            <button
              type="button"
              className="cms-btn-secondary"
              onClick={() => setShowAssetPicker((v) => !v)}
            >
              Choose from assets
            </button>
            {theme.image && (
              <button
                type="button"
                className="cms-btn-secondary theme-editor-remove-thumb"
                onClick={() => setField(['image'], null)}
                title="Remove thumbnail"
              >
                <ImageOff size={14} /> Remove
              </button>
            )}
          </div>
        </div>
        {uploadError && <p className="theme-editor-error-text">{uploadError}</p>}
        {showAssetPicker && (
          <div className="theme-editor-asset-picker">
            <div className="theme-editor-asset-picker-header">
              <span className="cms-hint">Pick an already-uploaded image:</span>
              <button type="button" className="cms-btn-icon" onClick={() => setShowAssetPicker(false)} aria-label="Close">
                <X size={14} />
              </button>
            </div>
            <AssetPicker
              courseId={courseId}
              accept="image/"
              onSelect={(asset) => {
                setField(['image'], asset.url)
                setShowAssetPicker(false)
              }}
            />
          </div>
        )}
        {pendingFile && (
          <ImageCropModal
            file={pendingFile}
            onCancel={() => setPendingFile(null)}
            onSave={handleCropSave}
          />
        )}
      </section>

      <section className="theme-editor-section">
        <h3>Brand colors</h3>
        <ColorField label="Accent" value={theme.accent} onChange={(v) => setField(['accent'], v)} />
        <ColorField
          label="Secondary"
          value={theme.secondary}
          onChange={(v) => setField(['secondary'], v)}
        />
        <ColorField
          label="Heading color"
          value={theme.headingColor}
          onChange={(v) => setField(['headingColor'], v)}
        />
      </section>

      <section className="theme-editor-section">
        <h3>Module palette</h3>
        <p className="theme-editor-hint">
          Cycles across modules in order; assign extra modules re-use these colors.
        </p>
        <div className="theme-editor-swatch-row">
          {theme.modulePalette.map((hex, i) => (
            <ColorField
              key={i}
              label={`Module ${i + 1}`}
              value={hex}
              onChange={(v) => setModulePaletteColor(i, v)}
              compact
            />
          ))}
        </div>
      </section>

      <section className="theme-editor-section">
        <h3>Light mode palette</h3>
        <ColorField
          label="Background"
          value={theme.light.background}
          onChange={(v) => setField(['light', 'background'], v)}
        />
        <ColorField
          label="Surface"
          value={theme.light.surface}
          onChange={(v) => setField(['light', 'surface'], v)}
        />
        <ColorField
          label="Text"
          value={theme.light.text}
          onChange={(v) => setField(['light', 'text'], v)}
        />
      </section>

      <section className="theme-editor-section">
        <h3>Dark mode palette</h3>
        <ColorField
          label="Background"
          value={theme.dark.background}
          onChange={(v) => setField(['dark', 'background'], v)}
        />
        <ColorField
          label="Surface"
          value={theme.dark.surface}
          onChange={(v) => setField(['dark', 'surface'], v)}
        />
        <ColorField
          label="Text"
          value={theme.dark.text}
          onChange={(v) => setField(['dark', 'text'], v)}
        />
      </section>

      <section className="theme-editor-section theme-editor-preview">
        <h3>Live preview</h3>
        <div className="theme-editor-preview-grid">
          <PreviewCard title="Light mode" palette={theme.light} theme={theme} />
          <PreviewCard title="Dark mode" palette={theme.dark} theme={theme} />
        </div>
      </section>

      <AnimatePresence>
        {warnings.length > 0 && (
          <motion.ul
            className="theme-editor-warnings"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {warnings.map((w) => (
              <li key={w} className="theme-editor-warning">
                <AlertTriangle size={14} aria-hidden="true" /> {w}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      {error && <p className="theme-editor-error-text">{error}</p>}

      <motion.button
        type="button"
        className="theme-editor-save"
        onClick={handleSave}
        disabled={saving}
        whileTap={{ scale: 0.97 }}
      >
        {saving ? 'Saving…' : 'Save theme'}
      </motion.button>
    </div>
  )
}

function ColorField({ label, value, onChange, compact = false }) {
  return (
    <label className={`theme-editor-field ${compact ? 'theme-editor-field-compact' : ''}`}>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
      />
      <span>{label}</span>
    </label>
  )
}

function PreviewCard({ title, palette, theme }) {
  return (
    <div
      className="theme-editor-preview-card"
      style={{ background: palette.background, color: palette.text }}
    >
      <p className="theme-editor-preview-label">{title}</p>
      <h4 style={{ color: theme.headingColor }}>Sample heading</h4>
      <div className="theme-editor-preview-surface" style={{ background: palette.surface }}>
        Sample body text on a surface block.
      </div>
      <button
        type="button"
        className="theme-editor-preview-button"
        style={{ background: theme.accent, color: '#fff' }}
      >
        Sample button
      </button>
    </div>
  )
}
