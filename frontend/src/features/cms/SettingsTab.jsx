import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { ThemeEditor } from '../theming/ThemeEditor'
import { cmsApi } from './cmsApi'

const STATUS_OPTIONS = ['planned', 'draft', 'ready', 'published', 'archived']

/**
 * Settings tab — course metadata, publish/archive lifecycle, delete, and
 * the theme panel (frontend/src/features/theming/ThemeEditor.jsx, 16-theming).
 * Final exam questions live under the Assessments tab's "Final exam" bank,
 * not here — this only surfaces the course-level lifecycle actions that
 * previously had no UI anywhere (routers/course_admin.py).
 */
export function SettingsTab({ course, onChange }) {
  const navigate = useNavigate()
  const [status, setStatus] = useState(course?.contentStatus ?? 'planned')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  if (!course) return null

  async function handleStatusChange(next) {
    setStatus(next)
    setSaving(true)
    setError(null)
    try {
      await cmsApi.updateCourse(course.id, { contentStatus: next })
      onChange?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${course.title}" permanently? This can't be undone.`)) return
    await cmsApi.deleteCourse(course.id)
    navigate('/cms')
  }

  return (
    <div className="cms-settings">
      <div className="cms-content-header">
        <h3>{course.title}</h3>
      </div>
      <p className="cms-hint">
        Slug: <code>{course.slug}</code>
      </p>

      <div className="cms-field" style={{ maxWidth: 260, margin: '1rem 0' }}>
        <span>Status</span>
        <select value={status} onChange={(e) => handleStatusChange(e.target.value)} disabled={saving}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="cms-hint" style={{ color: 'var(--danger)' }}>{error}</p>}
      <p className="cms-hint">
        Set to <strong>Published</strong> to make this course visible in the learner catalog.
        The final exam is managed from the Assessments tab's "Final exam" bank.
      </p>

      <ThemeEditor courseId={course.id} />

      <div className="cms-danger-zone">
        <h4>Danger zone</h4>
        <p className="cms-hint">Permanently deletes the course and everything in it.</p>
        <button type="button" className="cms-btn-danger" onClick={handleDelete}>
          <Trash2 size={14} aria-hidden="true" /> Delete course
        </button>
      </div>
    </div>
  )
}
