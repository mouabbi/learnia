import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutGrid, LogOut, Plus, X } from 'lucide-react'
import { cmsApi } from '../features/cms/cmsApi'
import { useAuth } from '../features/auth/AuthContext'
import '../features/cms/cms.css'

const STATUS_LABELS = {
  planned: 'Planned',
  draft: 'Draft',
  ready: 'Ready',
  published: 'Published',
  archived: 'Archived',
}

// Landing page for the CMS surface (see App.jsx's /cms route) — a course
// picker (every status, not just published — see cmsApi.listAllCourses),
// plus the "new course" flow that didn't exist anywhere before this.
// Deliberately outside AppLayout: the CMS is opened in its own tab from the
// Sidebar and gets its own shell, not the learning dashboard chrome.
export function CmsHomePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [courses, setCourses] = useState(null)
  const [showCreate, setShowCreate] = useState(false)

  function load() {
    cmsApi.listAllCourses().then(setCourses).catch(() => setCourses([]))
  }

  useEffect(load, [])

  return (
    <div className="cms-shell">
      <header className="cms-shell-header">
        <span className="cms-shell-brand">
          <LayoutGrid size={18} aria-hidden="true" /> Learnia CMS
        </span>
        <div className="cms-shell-header-spacer" />
        <span className="cms-shell-user">{user.email}</span>
        <button type="button" className="cms-btn-secondary" onClick={logout}>
          <LogOut size={14} aria-hidden="true" /> Log out
        </button>
      </header>

      <div className="cms-workspace-body">
        <div className="cms-content-header">
          <div>
            <h1>Courses</h1>
            <p className="cms-hint">Pick a course to edit its structure, content, and assessments.</p>
          </div>
          <button type="button" className="cms-btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={15} aria-hidden="true" /> New course
          </button>
        </div>

        <ul className="cms-course-picker-list">
          {courses === null && <li className="cms-hint">Loading…</li>}
          {courses?.length === 0 && <li className="cms-hint">No courses yet — create the first one.</li>}
          {courses?.map((course) => (
            <li key={course.id}>
              <button
                type="button"
                className="cms-course-picker-item"
                onClick={() => navigate(`/cms/${course.slug}`)}
              >
                <span>{course.title}</span>
                <span className={`cms-status-tag cms-status-${course.contentStatus}`}>
                  {STATUS_LABELS[course.contentStatus] ?? course.contentStatus}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {showCreate && (
        <CreateCourseModal
          onClose={() => setShowCreate(false)}
          onCreated={(course) => {
            setShowCreate(false)
            navigate(`/cms/${course.slug}`)
          }}
        />
      )}
    </div>
  )
}

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function CreateCourseModal({ onClose, onCreated }) {
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [description, setDescription] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const course = await cmsApi.createCourse({
        slug: slug || slugify(title),
        title,
        description: description || undefined,
      })
      onCreated(course)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="cms-modal-overlay" onClick={onClose}>
      <div className="cms-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cms-modal-header">
          <h3>New course</h3>
          <button type="button" className="cms-btn-icon" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="cms-field-list">
          <label className="cms-field">
            Title
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                if (!slugTouched) setSlug(slugify(e.target.value))
              }}
              required
              autoFocus
            />
          </label>

          <label className="cms-field">
            Slug (used in the URL)
            <input
              type="text"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value)
                setSlugTouched(true)
              }}
              placeholder="my-new-course"
              required
            />
          </label>

          <label className="cms-field">
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </label>

          {error && <p className="cms-hint" style={{ color: 'var(--danger)' }}>{error}</p>}

          <div className="cms-modal-actions">
            <button type="button" className="cms-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="cms-btn-primary" disabled={saving}>
              {saving ? 'Creating…' : 'Create course'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
