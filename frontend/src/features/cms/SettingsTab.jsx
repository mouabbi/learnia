import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { ThemeEditor } from '../theming/ThemeEditor'
import { COURSE_ICON_COMPONENTS, COURSE_ICON_NAMES } from '../courses/courseIcons'
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
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const [savingIcon, setSavingIcon] = useState(false)

  if (!course) return null

  async function handleStatusChange(next) {
    setStatus(next)
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await cmsApi.updateCourse(course.id, { contentStatus: next })
      setSaved(true)
      setTimeout(() => setSaved(false), 1800)
      onChange?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleIconChange(icon) {
    setSavingIcon(true)
    setError(null)
    try {
      await cmsApi.updateCourse(course.id, { icon })
      onChange?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingIcon(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${course.title}" permanently? This can't be undone.`)) return
    await cmsApi.deleteCourse(course.id)
    navigate('/cms')
  }

  return (
    <div className="cms-settings">
      <section className="cms-settings-section">
        <div className="cms-settings-section-header">
          <h3>Overview</h3>
        </div>
        <dl className="cms-settings-meta">
          <div>
            <dt>Course</dt>
            <dd>{course.title}</dd>
          </div>
          <div>
            <dt>Slug</dt>
            <dd>
              <code>{course.slug}</code>
            </dd>
          </div>
        </dl>
      </section>

      <section className="cms-settings-section">
        <div className="cms-settings-section-header">
          <h3>Icon</h3>
        </div>
        <p className="cms-hint">
          Shown on the learner catalog card when no thumbnail image is set (see Theme below).
        </p>
        <div className="cms-icon-picker" role="group" aria-label="Course icon">
          {COURSE_ICON_NAMES.map((name) => {
            const Icon = COURSE_ICON_COMPONENTS[name]
            const active = (course.icon || 'BookOpen') === name
            return (
              <button
                key={name}
                type="button"
                className={`cms-icon-option${active ? ' cms-icon-option-active' : ''}`}
                disabled={savingIcon}
                onClick={() => handleIconChange(name)}
                title={name}
                aria-pressed={active}
              >
                <Icon size={20} aria-hidden="true" />
              </button>
            )
          })}
        </div>
      </section>

      <section className="cms-settings-section">
        <div className="cms-settings-section-header">
          <h3>Status</h3>
          {saved && (
            <span className="cms-settings-saved">
              <CheckCircle2 size={14} aria-hidden="true" /> Saved
            </span>
          )}
        </div>

        <div className="cms-status-picker" role="group" aria-label="Course status">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              className={`cms-status-option cms-status-${s}${status === s ? ' cms-status-option-active' : ''}`}
              disabled={saving}
              onClick={() => handleStatusChange(s)}
            >
              {s[0].toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {error && (
          <p className="cms-hint" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        )}
        <p className="cms-hint">
          Set to <strong>Published</strong> to make this course visible in the learner catalog. The
          final exam is managed from the Assessments tab's "Final exam" bank.
        </p>
      </section>

      <section className="cms-settings-section">
        <div className="cms-settings-section-header">
          <h3>Theme</h3>
        </div>
        <ThemeEditor courseId={course.id} />
      </section>

      <section className="cms-danger-zone">
        <div className="cms-danger-zone-header">
          <AlertTriangle size={18} aria-hidden="true" />
          <h3>Danger zone</h3>
        </div>
        <div className="cms-danger-zone-row">
          <div>
            <p className="cms-danger-zone-title">Delete this course</p>
            <p className="cms-hint">
              Permanently removes the course and everything in it — modules, chapters, pages, and
              question banks. This can't be undone.
            </p>
          </div>
          <button type="button" className="cms-btn-danger" onClick={handleDelete}>
            <Trash2 size={14} aria-hidden="true" /> Delete course
          </button>
        </div>
      </section>
    </div>
  )
}
