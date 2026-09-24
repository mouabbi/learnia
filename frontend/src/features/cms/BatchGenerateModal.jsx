import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { X, Copy, Check, Loader2, AlertTriangle, Braces, FileText, ClipboardCheck } from 'lucide-react'
import { cmsApi } from './cmsApi'
import { JsonCodeEditor } from './JsonCodeEditor'

/**
 * BatchGenerateModal — "Generate All": pick, per module, whether to generate
 * its content and/or quiz, plus an optional final exam, and get ONE combined
 * prompt for everything selected — then paste ONE JSON back and commit it
 * all in one step. A sibling of AiImportModal (same modal chrome, same
 * paste-JSON step pattern), but with an extra step 1 up front for the
 * per-module selection instead of a fixed single scope/target.
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

  // Step 3 — paste + validate + commit
  const [pastedJson, setPastedJson] = useState('')
  const [formatError, setFormatError] = useState(null)
  const [validating, setValidating] = useState(false)
  const [validateResult, setValidateResult] = useState(null)
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
    setPastedJson('')
    setFormatError(null)
    setValidateResult(null)
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
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard API can fail (permissions, non-secure context) — the
      // textarea is still selectable/copyable manually, so this is silent.
    }
  }

  const formatJson = () => {
    try {
      const parsed = JSON.parse(pastedJson)
      setPastedJson(JSON.stringify(parsed, null, 2))
      setFormatError(null)
    } catch (err) {
      setFormatError(err.message)
    }
  }

  const runValidate = async () => {
    setValidating(true)
    setValidateResult(null)
    setCommitError(null)
    try {
      const result = await cmsApi.validateBatchImport(course.id, selections, pastedJson)
      setValidateResult(result)
    } catch (err) {
      setValidateResult({ valid: false, errors: [{ field: '(request)', message: err.message }] })
    } finally {
      setValidating(false)
    }
  }

  const runCommit = async (replace) => {
    setCommitting(true)
    setCommitError(null)
    try {
      const result = await cmsApi.commitBatchImport(course.id, selections, pastedJson, replace)
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
              Paste JSON
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
                  you'll get one combined prompt and paste back one JSON response.
                </p>

                <ul className="cms-batch-module-list">
                  {modules.map((m) => (
                    <li key={m.id} className="cms-batch-module-row">
                      <span className="cms-batch-module-title">{m.title}</span>
                      <div className="cms-batch-module-toggles">
                        <button
                          type="button"
                          className={`cms-batch-toggle${contentIds.has(m.id) ? ' cms-batch-toggle-active' : ''}`}
                          onClick={() => toggle(contentIds, setContentIds, m.id)}
                        >
                          <FileText size={13} /> Content
                        </button>
                        <button
                          type="button"
                          className={`cms-batch-toggle${qcmIds.has(m.id) ? ' cms-batch-toggle-active' : ''}`}
                          onClick={() => toggle(qcmIds, setQcmIds, m.id)}
                        >
                          <ClipboardCheck size={13} /> Quiz
                        </button>
                      </div>
                    </li>
                  ))}
                  {modules.length === 0 && (
                    <li className="cms-empty-hint">No modules yet — add some first.</li>
                  )}
                </ul>

                <label className="cms-batch-final-exam">
                  <input
                    type="checkbox"
                    checked={includeFinalExam}
                    onChange={(e) => setIncludeFinalExam(e.target.checked)}
                  />
                  Include final exam
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
                      Copy this into your AI chat tool of choice, then paste the JSON it gives
                      back in the next step.
                    </p>
                    <textarea className="cms-prompt-textarea" rows={14} readOnly value={prompt} />
                    <div className="cms-modal-actions">
                      <button type="button" className="cms-btn-secondary" onClick={() => setStep(1)}>
                        Back
                      </button>
                      <button type="button" className="cms-btn-secondary" onClick={copyPrompt}>
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                        {copied ? 'Copied' : 'Copy to clipboard'}
                      </button>
                      <button type="button" className="cms-btn-primary" onClick={() => setStep(3)}>
                        Next: paste JSON
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
                <div className="cms-json-editor-toolbar">
                  <p className="cms-hint">Paste the JSON your AI tool returned:</p>
                  <button type="button" className="cms-btn-secondary cms-btn-format" onClick={formatJson} disabled={!pastedJson.trim()}>
                    <Braces size={14} aria-hidden="true" /> Format
                  </button>
                </div>
                <JsonCodeEditor
                  value={pastedJson}
                  onChange={(next) => {
                    setPastedJson(next)
                    setFormatError(null)
                    setValidateResult(null)
                    setNeedsReplaceConfirm(false)
                  }}
                  placeholder="{ ... }"
                  rows={10}
                />
                {formatError && (
                  <p className="cms-error cms-format-error">
                    <AlertTriangle size={13} /> Can't format — not valid JSON yet: {formatError}
                  </p>
                )}

                <div className="cms-modal-actions">
                  <button type="button" className="cms-btn-secondary" onClick={() => setStep(2)}>
                    Back
                  </button>
                  <motion.button
                    type="button"
                    className={`cms-btn-secondary${validateResult?.valid ? ' cms-btn-validate-ok' : ''}`}
                    onClick={runValidate}
                    disabled={!pastedJson.trim() || validating}
                    whileTap={{ scale: 0.95 }}
                  >
                    {validating ? (
                      <Loader2 className="cms-spin" size={16} />
                    ) : validateResult?.valid ? (
                      <Check size={16} />
                    ) : null}
                    Validate
                  </motion.button>
                  <motion.button
                    type="button"
                    className="cms-btn-primary"
                    disabled={!validateResult?.valid || committing}
                    onClick={() => runCommit(false)}
                    whileTap={{ scale: 0.95 }}
                  >
                    {committing ? <Loader2 className="cms-spin" size={16} /> : null}
                    Commit
                  </motion.button>
                </div>

                {validateResult && !validateResult.valid && (
                  <motion.div
                    className="cms-error-list"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <p className="cms-error">
                      <AlertTriangle size={14} /> Invalid JSON — fix these and re-validate:
                    </p>
                    <ul>
                      {validateResult.errors.map((e, i) => (
                        <li key={i}>
                          <code>{e.field}</code>: {e.message}
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}

                {validateResult?.valid && (
                  <motion.div
                    className="cms-preview"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <p className="cms-hint">
                      <Check size={14} className="cms-preview-check" aria-hidden="true" /> Looks valid. Preview:
                    </p>
                    <ul className="cms-question-preview-list">
                      {Object.keys(validateResult.parsed?.moduleContent || {}).map((id) => (
                        <li key={`content-${id}`}>
                          Module {id}: content — {(validateResult.parsed.moduleContent[id]?.pages || []).length} page(s)
                        </li>
                      ))}
                      {Object.keys(validateResult.parsed?.moduleQcm || {}).map((id) => (
                        <li key={`qcm-${id}`}>
                          Module {id}: quiz — {(validateResult.parsed.moduleQcm[id] || []).length} question(s)
                        </li>
                      ))}
                      {validateResult.parsed?.finalExam && (
                        <li>Final exam: {validateResult.parsed.finalExam.length} question(s)</li>
                      )}
                    </ul>
                  </motion.div>
                )}

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
