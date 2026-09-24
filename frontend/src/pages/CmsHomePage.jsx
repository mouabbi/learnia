import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { LayoutGrid, LogOut, Plus, X, BookOpen, ArrowRight } from 'lucide-react'
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

const THUMB_VARIANTS = ['cms-thumb-indigo', 'cms-thumb-amber', 'cms-thumb-teal', 'cms-thumb-rose']

function thumbVariant(id) {
  const hash = [...String(id)].reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
  return THUMB_VARIANTS[hash % THUMB_VARIANTS.length]
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

      <div className="cms-hero">
        <div className="cms-hero-inner">
          <h1>Courses</h1>
          <p className="cms-hint">Pick a course to edit its structure, content, and assessments.</p>
          <button type="button" className="cms-btn-primary cms-hero-cta" onClick={() => setShowCreate(true)}>
            <Plus size={16} aria-hidden="true" /> New course
          </button>
        </div>
      </div>

      <div className="cms-workspace-body">
        {courses === null && (
          <div className="cms-course-grid">
            {[0, 1, 2].map((i) => (
              <div key={i} className="cms-course-card cms-course-card-skeleton" />
            ))}
          </div>
        )}

        {courses?.length === 0 && (
          <div className="cms-empty-state">
            <BookOpen size={32} aria-hidden="true" />
            <h3>No courses yet</h3>
            <p className="cms-hint">Create the first one to start building a learning path.</p>
            <button type="button" className="cms-btn-primary" onClick={() => setShowCreate(true)}>
              <Plus size={15} aria-hidden="true" /> New course
            </button>
          </div>
        )}

        {courses && courses.length > 0 && (
          <div className="cms-course-grid">
            {courses.map((course, i) => (
              <motion.button
                key={course.id}
                type="button"
                className="cms-course-card"
                onClick={() => navigate(`/cms/${course.slug}`)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.2 }}
              >
                <div className={`cms-course-card-thumb ${thumbVariant(course.id)}`}>
                  <BookOpen size={28} strokeWidth={1.6} aria-hidden="true" />
                  <span className={`cms-status-tag cms-status-${course.contentStatus}`}>
                    {STATUS_LABELS[course.contentStatus] ?? course.contentStatus}
                  </span>
                </div>
                <div className="cms-course-card-body">
                  <h3>{course.title}</h3>
                  <p className="cms-hint">{course.description || 'No description yet.'}</p>
                  <span className="cms-course-card-cta">
                    Open workspace <ArrowRight size={14} aria-hidden="true" />
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        )}
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
    <motion.div
      className="cms-modal-overlay"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
    >
      <motion.div
        className="cms-modal"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
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
      </motion.div>
    </motion.div>
  )
}
