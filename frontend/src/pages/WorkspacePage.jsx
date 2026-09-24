import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  ChevronLeft,
  LayoutGrid,
  LogOut,
  ListTree,
  FileText,
  ClipboardCheck,
  Settings2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'
import { cmsApi } from '../features/cms/cmsApi'
import { StructureTree } from '../features/cms/StructureTree'
import { ContentTab } from '../features/cms/ContentTab'
import { AssessmentsTab } from '../features/cms/AssessmentsTab'
import { SettingsTab } from '../features/cms/SettingsTab'
import { AiImportModal } from '../features/cms/AiImportModal'
import { BatchGenerateModal } from '../features/cms/BatchGenerateModal'
import { computeReadiness, readinessTotal } from '../features/cms/courseReadiness'
import '../features/cms/cms.css'

const TABS = [
  { id: 'Structure', icon: ListTree, readinessKey: 'structure' },
  { id: 'Content', icon: FileText, readinessKey: 'content' },
  { id: 'Assessments', icon: ClipboardCheck, readinessKey: 'assessments' },
  { id: 'Settings', icon: Settings2, readinessKey: 'settings' },
]

const structureActions = {
  createModule: (courseId, title) => cmsApi.createModule(courseId, title),
  renameModule: (id, title) => cmsApi.renameModule(id, title),
  deleteModule: (id) => cmsApi.deleteModule(id),
  reorderModules: (courseId, ids) => cmsApi.reorderModules(courseId, ids),
  createChapter: (moduleId, title) => cmsApi.createChapter(moduleId, title),
  renameChapter: (id, title) => cmsApi.renameChapter(id, title),
  deleteChapter: (id) => cmsApi.deleteChapter(id),
  reorderChapters: (moduleId, ids) => cmsApi.reorderChapters(moduleId, ids),
  createPage: (chapterId, title) => cmsApi.createPage(chapterId, title),
  renamePage: (id, title) => cmsApi.renamePage(id, title),
  deletePage: (id) => cmsApi.deletePage(id),
  reorderPages: (chapterId, ids) => cmsApi.reorderPages(chapterId, ids),
}

/**
 * WorkspacePage (11-content-workspace-cms) — one route per course, tabbed
 * (Structure / Content / Assessments / Settings), per 11's own resolved
 * open question. Route: /cms/:slug (see App.jsx — not wired here, see the
 * workspace report for the exact <Route> to add).
 */
export function WorkspacePage() {
  const { slug } = useParams()
  const { user, logout } = useAuth()
  const [course, setCourse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('Structure')
  const [selectedPage, setSelectedPage] = useState(null)
  const [assessmentTarget, setAssessmentTarget] = useState(null)
  const [aiModal, setAiModal] = useState(null) // { scope, moduleId?, chapterId? }
  const [showBatchModal, setShowBatchModal] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    cmsApi
      .getCourse(slug)
      .then((c) => {
        setCourse(c)
        setError(null)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [slug])

  useEffect(load, [load])

  const readiness = useMemo(() => computeReadiness(course), [course])
  const totalIssues = readinessTotal(readiness)

  if (loading && !course) return <div className="cms-shell cms-loading">Loading workspace…</div>
  if (error) return <div className="cms-shell cms-error">{error}</div>
  if (!course) return null

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

      <header className="cms-workspace-header">
        <div className="cms-workspace-header-inner">
          <Link to="/cms" className="cms-back-link">
            <ChevronLeft size={16} /> All courses
          </Link>
          <div className="cms-workspace-header-title">
            <h1>{course.title}</h1>
            {course.contentStatus && (
              <span className={`cms-status-tag cms-status-${course.contentStatus}`}>
                {course.contentStatus}
              </span>
            )}
            <span
              className={`cms-readiness-badge${totalIssues === 0 ? ' cms-readiness-ok' : ' cms-readiness-warn'}`}
              title={
                totalIssues === 0
                  ? 'No issues found in structure, content, assessments or settings.'
                  : [...readiness.structure, ...readiness.content, ...readiness.assessments, ...readiness.settings].join('\n')
              }
            >
              {totalIssues === 0 ? (
                <>
                  <CheckCircle2 size={13} aria-hidden="true" /> Ready
                </>
              ) : (
                <>
                  <AlertTriangle size={13} aria-hidden="true" /> {totalIssues} issue{totalIssues === 1 ? '' : 's'}
                </>
              )}
            </span>
          </div>
          <p className="cms-hint">{course.description || 'Content workspace'}</p>
        </div>
      </header>

      <div className="cms-workspace-body">
        <nav className="cms-tabs">
          {TABS.map(({ id, icon: TabIcon, readinessKey }) => {
            const issues = readiness[readinessKey] || []
            return (
              <button
                key={id}
                type="button"
                className={`cms-tab${tab === id ? ' cms-tab-active' : ''}`}
                onClick={() => setTab(id)}
                title={issues.length ? issues.join('\n') : undefined}
              >
                <TabIcon size={15} aria-hidden="true" />
                {id}
                {issues.length > 0 && (
                  <span className="cms-tab-problem-dot" aria-label={`${issues.length} issue(s)`}>
                    {issues.length}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="cms-tab-panel"
          >
          {tab === 'Structure' && (
            <StructureTree
              course={course}
              actions={structureActions}
              onChange={load}
              onSelectPage={(page) => {
                setSelectedPage(page)
                setTab('Content')
              }}
              selectedPageId={selectedPage?.id}
              onGenerateWithAi={setAiModal}
              onGenerateAll={() => setShowBatchModal(true)}
            />
          )}

          {tab === 'Content' && (
            <ContentTab page={selectedPage} onGenerateWithAi={setAiModal} />
          )}

          {tab === 'Assessments' && (
            <div className="cms-assessments-wrap">
              <div className="cms-module-picker">
                <label>
                  Bank:
                  <select
                    value={assessmentTarget ? JSON.stringify(assessmentTarget) : ''}
                    onChange={(e) => setAssessmentTarget(e.target.value ? JSON.parse(e.target.value) : null)}
                  >
                    <option value="">Choose…</option>
                    {(course.modules || []).map((m) => (
                      <option key={m.id} value={JSON.stringify({ kind: 'module', id: m.id })}>
                        {m.title}
                      </option>
                    ))}
                    <option value={JSON.stringify({ kind: 'final-exam' })}>Final exam</option>
                  </select>
                </label>
              </div>
              <AssessmentsTab target={assessmentTarget} courseId={course.id} onGenerateWithAi={setAiModal} />
            </div>
          )}

          {tab === 'Settings' && <SettingsTab course={course} onChange={load} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <AiImportModal
        open={!!aiModal}
        onClose={() => setAiModal(null)}
        courseId={course.id}
        scope={aiModal?.scope}
        targetIds={{ moduleId: aiModal?.moduleId, chapterId: aiModal?.chapterId, pageId: aiModal?.pageId }}
        onCommitted={load}
      />

      <BatchGenerateModal
        open={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        course={course}
        onCommitted={load}
      />
    </div>
  )
}
