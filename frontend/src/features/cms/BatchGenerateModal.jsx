import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  X,
  Copy,
  Check,
  Loader2,
  AlertTriangle,
  FileText,
  ClipboardCheck,
  CheckCheck,
  FileArchive,
  Folder,
  ArrowRight,
} from 'lucide-react'
import { cmsApi } from './cmsApi'
import { copyText } from '../../utils/clipboard'

/**
 * BatchGenerateModal — "Generate All": pick, per module, whether to generate
 * its content and/or quiz, plus an optional final exam, and get ONE combined
 * prompt for everything selected — then upload the ONE .zip the AI produces
 * (a folder per module with content.json/quiz.json, final-exam.json at the
 * root). The server unpacks it, maps each folder to its module, validates
 * it, and this modal shows that mapping before a single commit. A sibling
 * of AiImportModal (same modal chrome), with an extra step 1 up front for
 * the per-module selection instead of a fixed single scope/target.
 *
 * Props:
 *  - open, onClose
 *  - course (needs course.id and course.modules)
 *  - onCommitted(result): called after a successful commit.
 */
export function BatchGenerateModal({ open, onClose, course, onCommitted }) {
  const [step, setStep] = useState(1)

  // Step 1 — selection
  const [contentIds, setContentIds] = useState(() => new Set())
  const [qcmIds, setQcmIds] = useState(() => new Set())
  const [includeFinalExam, setIncludeFinalExam] = useState(false)

  // Step 2 — prompt
  const [prompt, setPrompt] = useState('')
  const [promptLoading, setPromptLoading] = useState(false)
  const [promptError, setPromptError] = useState(null)
  const [copied, setCopied] = useState(false)

  // Step 3 — upload zip (parsed + validated server-side) + commit
  const [zipFile, setZipFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [zipResult, setZipResult] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [needsReplaceConfirm, setNeedsReplaceConfirm] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [commitError, setCommitError] = useState(null)

  useEffect(() => {
    if (!open) return
    setStep(1)
    setContentIds(new Set())
    setQcmIds(new Set())
    setIncludeFinalExam(false)
    setPrompt('')
    setPromptError(null)
    setZipFile(null)
    setZipResult(null)
    setDragOver(false)
    setNeedsReplaceConfirm(false)
    setCommitError(null)
  }, [open])

  if (!open) return null

  const modules = course?.modules || []

  const toggle = (set, setSet, id) => {
    const next = new Set(set)
    next.has(id) ? next.delete(id) : next.add(id)
    setSet(next)
  }

  // What's already filled can't be picked (to regenerate something, clear
  // it first or use the per-module "Generate with AI"). A module with no
  // pages yet has nothing to fill either.
  const modulePages = (m) => (m.chapters || []).flatMap((c) => c.pages || [])
  const contentState = (m) => {
    const pages = modulePages(m)
    if (pages.length === 0) return 'no-pages'
    return pages.every((p) => p.content?.trim()) ? 'filled' : 'open'
  }
  const emptyPageCount = (m) => modulePages(m).filter((p) => !p.content?.trim()).length
  const hasQuiz = (m) => (m.quiz?.questions?.length || 0) > 0
  const examFilled = (course?.finalExam?.questions?.length || 0) > 0

  const contentOpenIds = modules.filter((m) => contentState(m) === 'open').map((m) => m.id)
  const qcmOpenIds = modules.filter((m) => !hasQuiz(m)).map((m) => m.id)
  const allContent = contentOpenIds.length > 0 && contentOpenIds.every((id) => contentIds.has(id))
  const allQcm = qcmOpenIds.length > 0 && qcmOpenIds.every((id) => qcmIds.has(id))
  const nothingOpen = contentOpenIds.length === 0 && qcmOpenIds.length === 0 && examFilled
  const allSelected =
    !nothingOpen &&
    (contentOpenIds.length === 0 || allContent) &&
    (qcmOpenIds.length === 0 || allQcm) &&
    (examFilled || includeFinalExam)

  const toggleAll = (isAll, openIds, setSet) => setSet(isAll ? new Set() : new Set(openIds))
  const toggleEverything = () => {
    const next = !allSelected
    setContentIds(next ? new Set(contentOpenIds) : new Set())
    setQcmIds(next ? new Set(qcmOpenIds) : new Set())
    setIncludeFinalExam(next && !examFilled)
  }

  const selections = {
    moduleContentIds: [...contentIds],
    moduleQcmIds: [...qcmIds],
    includeFinalExam,
  }

  const nothingSelected =
    selections.moduleContentIds.length === 0 &&
    selections.moduleQcmIds.length === 0 &&
    !selections.includeFinalExam

  const buildPrompt = async () => {
    setStep(2)
    setPromptLoading(true)
    setPromptError(null)
    try {
      const res = await cmsApi.getBatchPrompt(course.id, selections)
      setPrompt(res.prompt)
    } catch (err) {
      setPromptError(err.message || 'Failed to build prompt')
    } finally {
      setPromptLoading(false)
    }
  }

  const copyPrompt = async () => {
    const ok = await copyText(prompt)
    setCopied(ok ? 'ok' : 'failed')
    setTimeout(() => setCopied(false), ok ? 1500 : 3000)
  }

  const uploadZip = async (file) => {
    if (!file) return
    setZipFile(file)
    setZipResult(null)
    setCommitError(null)
    setNeedsReplaceConfirm(false)
    setUploading(true)
    try {
      setZipResult(await cmsApi.uploadBatchZip(course.id, file))
    } catch (err) {
      setZipResult({ valid: false, errors: [{ field: '(upload)', message: err.message }] })
    } finally {
      setUploading(false)
    }
  }

  const runCommit = async (replace) => {
    setCommitting(true)
    setCommitError(null)
    try {
      // Commit what the zip actually contained (its own selections), not
      // what was ticked in step 1 — the server re-validates it anyway.
      const result = await cmsApi.commitBatchImport(
        course.id,
        zipResult.selections,
        zipResult.json,
        replace,
      )
      setNeedsReplaceConfirm(false)
      onCommitted?.(result)
      onClose()
    } catch (err) {
      if (err.code === 'VALIDATION_ERROR' && /replace:true/.test(err.message || '')) {
        setNeedsReplaceConfirm(true)
        setCommitError(err.message)
      } else {
        setCommitError(err.message || 'Commit failed')
      }
    } finally {
      setCommitting(false)
    }
  }

  const summaryParts = []
  if (selections.moduleContentIds.length > 0) {
    summaryParts.push(`${selections.moduleContentIds.length} module${selections.moduleContentIds.length === 1 ? '' : 's'} × content`)
  }
  if (selections.moduleQcmIds.length > 0) {
    summaryParts.push(`${selections.moduleQcmIds.length} module${selections.moduleQcmIds.length === 1 ? '' : 's'} × quiz`)
  }
  if (includeFinalExam) summaryParts.push('final exam')
  const summary = summaryParts.length > 0 ? summaryParts.join(', ') : 'Nothing selected yet'

  return (
    <AnimatePresence>
      <motion.div
        className="cms-modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="cms-modal cms-modal-wide"
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="cms-modal-header">
            <h3>Generate All with AI</h3>
            <button type="button" className="cms-btn-icon" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>

          <div className="cms-modal-steps">
            <span className={`cms-modal-step${step === 1 ? ' cms-step-active' : ''}${step > 1 ? ' cms-step-done' : ''}`}>
              <span className="cms-modal-step-badge">{step > 1 ? <Check size={12} /> : 1}</span>
              Select
            </span>
            <span className="cms-modal-step-connector" />
            <span className={`cms-modal-step${step === 2 ? ' cms-step-active' : ''}${step > 2 ? ' cms-step-done' : ''}`}>
              <span className="cms-modal-step-badge">{step > 2 ? <Check size={12} /> : 2}</span>
              Copy prompt
            </span>
            <span className="cms-modal-step-connector" />
            <span className={`cms-modal-step${step === 3 ? ' cms-step-active' : ''}`}>
              <span className="cms-modal-step-badge">3</span>
              Upload zip
            </span>
          </div>

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.15 }}
                className="cms-modal-body"
              >
                <p className="cms-hint">
                  Pick what to generate for each module, plus the final exam if you want it too —
                  you'll get one combined prompt, and upload back the one .zip it produces.
                </p>

                {modules.length > 0 && (
                  <div className="cms-batch-select-all">
                    <button
                      type="button"
                      className={`cms-batch-toggle${allSelected ? ' cms-batch-toggle-active' : ''}`}
                      onClick={toggleEverything}
                      disabled={nothingOpen}
                    >
                      <CheckCheck size={13} /> {allSelected ? 'Clear all' : 'Select all'}
                    </button>
                    <button
                      type="button"
                      className={`cms-batch-toggle${allContent ? ' cms-batch-toggle-active' : ''}`}
                      onClick={() => toggleAll(allContent, contentOpenIds, setContentIds)}
                      disabled={contentOpenIds.length === 0}
                    >
                      <FileText size={13} /> All content
                    </button>
                    <button
                      type="button"
                      className={`cms-batch-toggle${allQcm ? ' cms-batch-toggle-active' : ''}`}
                      onClick={() => toggleAll(allQcm, qcmOpenIds, setQcmIds)}
                      disabled={qcmOpenIds.length === 0}
                    >
                      <ClipboardCheck size={13} /> All quizzes
                    </button>
                  </div>
                )}

                <ul className="cms-batch-module-list">
                  {modules.map((m) => {
                    const cState = contentState(m)
                    const quizDone = hasQuiz(m)
                    return (
                      <li key={m.id} className="cms-batch-module-row">
                        <span className="cms-batch-module-title">{m.title}</span>
                        <div className="cms-batch-module-toggles">
                          <button
                            type="button"
                            className={`cms-batch-toggle${contentIds.has(m.id) ? ' cms-batch-toggle-active' : ''}${cState === 'filled' ? ' cms-batch-toggle-done' : ''}`}
                            onClick={() => toggle(contentIds, setContentIds, m.id)}
                            disabled={cState !== 'open'}
                            title={
                              cState === 'filled'
                                ? 'Every page already has content'
                                : cState === 'no-pages'
                                  ? 'No pages yet — add them in Structure first'
                                  : emptyPageCount(m) < modulePages(m).length
                                    ? `Fills only the ${emptyPageCount(m)} empty page(s) — written pages are kept`
                                    : undefined
                            }
                          >
                            {cState === 'filled' ? <Check size={13} /> : <FileText size={13} />}
                            {cState === 'filled' ? 'Content filled' : 'Content'}
                          </button>
                          <button
                            type="button"
                            className={`cms-batch-toggle${qcmIds.has(m.id) ? ' cms-batch-toggle-active' : ''}${quizDone ? ' cms-batch-toggle-done' : ''}`}
                            onClick={() => toggle(qcmIds, setQcmIds, m.id)}
                            disabled={quizDone}
                            title={quizDone ? `Already has ${m.quiz.questions.length} question(s)` : undefined}
                          >
                            {quizDone ? <Check size={13} /> : <ClipboardCheck size={13} />}
                            {quizDone ? 'Quiz ready' : 'Quiz'}
                          </button>
                        </div>
                      </li>
                    )
                  })}
                  {modules.length === 0 && (
                    <li className="cms-empty-hint">No modules yet — add some first.</li>
                  )}
                </ul>

                <label className={`cms-batch-final-exam${examFilled ? ' cms-batch-final-exam-done' : ''}`}>
                  <input
                    type="checkbox"
                    checked={includeFinalExam}
                    disabled={examFilled}
                    onChange={(e) => setIncludeFinalExam(e.target.checked)}
                  />
                  {examFilled
                    ? `Final exam ready (${course.finalExam.questions.length} questions)`
                    : 'Include final exam'}
                </label>

                <p className="cms-batch-summary">{summary}</p>

                <div className="cms-modal-actions">
                  <button type="button" className="cms-btn-secondary" onClick={onClose}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="cms-btn-primary"
                    disabled={nothingSelected}
                    onClick={buildPrompt}
                  >
                    Build prompt
                  </button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.15 }}
                className="cms-modal-body"
              >
                {promptLoading && (
                  <p className="cms-loading">
                    <Loader2 className="cms-spin" size={16} /> Building prompt…
                  </p>
                )}
                {promptError && <p className="cms-error">{promptError}</p>}
                {!promptLoading && !promptError && (
                  <>
                    <p className="cms-hint">
                      Copy this into an AI tool that can create files (e.g. one with code
                      execution), then upload the .zip it gives back in the next step.
                    </p>
                    <textarea className="cms-prompt-textarea" rows={14} readOnly value={prompt} />
                    <div className="cms-modal-actions">
                      <button type="button" className="cms-btn-secondary" onClick={() => setStep(1)}>
                        Back
                      </button>
                      <button type="button" className="cms-btn-secondary" onClick={copyPrompt}>
                        {copied === 'ok' ? <Check size={16} /> : <Copy size={16} />}
                        {copied === 'ok'
                          ? 'Copied'
                          : copied === 'failed'
                            ? 'Copy failed — select the text and press Ctrl+C'
                            : 'Copy to clipboard'}
                      </button>
                      <button type="button" className="cms-btn-primary" onClick={() => setStep(3)}>
                        Next: upload zip
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.15 }}
                className="cms-modal-body"
              >
                <p className="cms-hint">
                  Upload the .zip your AI tool produced — one folder per module
                  (<code>content.json</code>, <code>quiz.json</code>) plus{' '}
                  <code>final-exam.json</code> at the root.
                </p>
                <label
                  className={`cms-zip-drop${dragOver ? ' cms-zip-drop-active' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOver(false)
                    uploadZip(e.dataTransfer.files?.[0])
                  }}
                >
                  <input
                    type="file"
                    accept=".zip,application/zip,application/x-zip-compressed"
                    onChange={(e) => {
                      uploadZip(e.target.files?.[0])
                      e.target.value = ''
                    }}
                  />
                  {uploading ? (
                    <Loader2 className="cms-spin" size={20} />
                  ) : (
                    <FileArchive size={20} aria-hidden="true" />
                  )}
                  <span>
                    {zipFile ? zipFile.name : 'Drop the .zip here or click to choose'}
                  </span>
                </label>

                {zipResult?.mappings && (zipResult.mappings.length > 0 || zipResult.parsed?.finalExam) && (
                  <motion.div
                    className="cms-preview"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <p className="cms-hint">
                      {zipResult.valid && (
                        <Check size={14} className="cms-preview-check" aria-hidden="true" />
                      )}{' '}
                      What's in the zip:
                    </p>
                    <ul className="cms-zip-map">
                      {zipResult.mappings.map((m) => {
                        const pages = zipResult.parsed?.moduleContent?.[m.moduleId]?.pages
                        const questions = zipResult.parsed?.moduleQcm?.[m.moduleId]
                        return (
                          <li key={m.folder} className={m.moduleId ? '' : 'cms-zip-map-unmatched'}>
                            <span className="cms-zip-map-folder">
                              <Folder size={13} aria-hidden="true" /> {m.folder}/
                            </span>
                            <ArrowRight size={13} aria-hidden="true" />
                            <span className="cms-zip-map-module">
                              {m.moduleTitle ?? 'No matching module'}
                            </span>
                            <span className="cms-zip-map-parts">
                              {m.hasContent && (
                                <span>
                                  <FileText size={12} /> {pages ? `${pages.length} page(s)` : 'content'}
                                </span>
                              )}
                              {m.hasQuiz && (
                                <span>
                                  <ClipboardCheck size={12} />{' '}
                                  {questions ? `${questions.length} question(s)` : 'quiz'}
                                </span>
                              )}
                              {m.ignoredFiles.length > 0 && (
                                <span className="cms-zip-map-ignored">
                                  {m.ignoredFiles.length} file(s) ignored
                                </span>
                              )}
                            </span>
                          </li>
                        )
                      })}
                      {zipResult.selections?.includeFinalExam && (
                        <li>
                          <span className="cms-zip-map-folder">
                            <FileText size={13} aria-hidden="true" /> final-exam.json
                          </span>
                          <ArrowRight size={13} aria-hidden="true" />
                          <span className="cms-zip-map-module">Final exam</span>
                          <span className="cms-zip-map-parts">
                            {zipResult.parsed?.finalExam && (
                              <span>{zipResult.parsed.finalExam.length} question(s)</span>
                            )}
                          </span>
                        </li>
                      )}
                    </ul>
                    {zipResult.warnings?.length > 0 && (
                      <ul className="cms-zip-warnings">
                        {zipResult.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    )}
                  </motion.div>
                )}

                {zipResult && !zipResult.valid && (
                  <motion.div
                    className="cms-error-list"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <p className="cms-error">
                      <AlertTriangle size={14} /> The zip has problems — fix these and upload again:
                    </p>
                    <ul>
                      {zipResult.errors.map((e, i) => (
                        <li key={i}>
                          <code>{e.field}</code>: {e.message}
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}

                <div className="cms-modal-actions">
                  <button type="button" className="cms-btn-secondary" onClick={() => setStep(2)}>
                    Back
                  </button>
                  <motion.button
                    type="button"
                    className="cms-btn-primary"
                    disabled={!zipResult?.valid || uploading || committing}
                    onClick={() => runCommit(false)}
                    whileTap={{ scale: 0.95 }}
                  >
                    {committing ? <Loader2 className="cms-spin" size={16} /> : null}
                    Commit
                  </motion.button>
                </div>

                {commitError && (
                  <div className="cms-error-list">
                    <p className="cms-error">
                      <AlertTriangle size={14} /> {commitError}
                    </p>
                    {needsReplaceConfirm && (
                      <button
                        type="button"
                        className="cms-btn-danger"
                        onClick={() => runCommit(true)}
                        disabled={committing}
                      >
                        Overwrite existing content
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
