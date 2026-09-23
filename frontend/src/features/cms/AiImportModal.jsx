import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { X, Copy, Check, Loader2, AlertTriangle } from 'lucide-react'
import { cmsApi } from './cmsApi'
import { BlockRenderer } from './BlockRenderer'

/**
 * AiImportModal — the manual AI workflow (12 + 13), reachable as a
 * "Generate with AI" button from the Structure/Content/Assessments tabs.
 *
 * Step 1: fetch + show the copy-pasteable prompt (12).
 * Step 2: paste the JSON the user got back, Validate it (13), preview it,
 *         then Commit (only enabled once valid) — with an explicit
 *         replace-confirmation if the target already has content.
 *
 * Props:
 *  - open, onClose
 *  - courseId, scope ("course"|"module"|"chapter"|"page"|"module-qcm"|"final-exam")
 *  - targetIds: { moduleId?, chapterId?, pageId? } — passed straight through
 *    to the prompt-builder and commit endpoints.
 *  - onCommitted(result): called after a successful commit.
 */
export function AiImportModal({ open, onClose, courseId, scope, targetIds = {}, onCommitted }) {
  const [step, setStep] = useState(1)
  const [prompt, setPrompt] = useState('')
  const [promptLoading, setPromptLoading] = useState(false)
  const [promptError, setPromptError] = useState(null)
  const [copied, setCopied] = useState(false)

  const [pastedJson, setPastedJson] = useState('')
  const [validating, setValidating] = useState(false)
  const [validateResult, setValidateResult] = useState(null)
  const [needsReplaceConfirm, setNeedsReplaceConfirm] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [commitError, setCommitError] = useState(null)

  useEffect(() => {
    if (!open) return
    setStep(1)
    setPastedJson('')
    setValidateResult(null)
    setNeedsReplaceConfirm(false)
    setCommitError(null)
    setPromptError(null)
    setPromptLoading(true)
    cmsApi
      .getPrompt(courseId, scope, targetIds)
      .then((res) => setPrompt(res.prompt))
      .catch((err) => setPromptError(err.message || 'Failed to build prompt'))
      .finally(() => setPromptLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, courseId, scope])

  if (!open) return null

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

  const runValidate = async () => {
    setValidating(true)
    setValidateResult(null)
    setCommitError(null)
    try {
      const result = await cmsApi.validateImport(courseId, scope, pastedJson)
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
      const result = await cmsApi.commitImport(courseId, scope, pastedJson, {
        replace,
        ...targetIds,
      })
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

  const parsedPreview = validateResult?.valid ? validateResult.parsed : null

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
          className="cms-modal"
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="cms-modal-header">
            <h3>Generate with AI — {scope}</h3>
            <button type="button" className="cms-btn-icon" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>

          <div className="cms-modal-steps">
            <span className={step === 1 ? 'cms-step-active' : ''}>1. Copy prompt</span>
            <span className={step === 2 ? 'cms-step-active' : ''}>2. Paste JSON</span>
          </div>

          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="step1"
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
                      <button type="button" className="cms-btn-secondary" onClick={copyPrompt}>
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                        {copied ? 'Copied' : 'Copy to clipboard'}
                      </button>
                      <button type="button" className="cms-btn-primary" onClick={() => setStep(2)}>
                        Next: paste JSON
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.15 }}
                className="cms-modal-body"
              >
                <p className="cms-hint">Paste the JSON your AI tool returned:</p>
                <textarea
                  className="cms-prompt-textarea cms-mono"
                  rows={10}
                  value={pastedJson}
                  onChange={(e) => {
                    setPastedJson(e.target.value)
                    setValidateResult(null)
                    setNeedsReplaceConfirm(false)
                  }}
                  placeholder="{ ... }"
                />

                <div className="cms-modal-actions">
                  <button type="button" className="cms-btn-secondary" onClick={() => setStep(1)}>
                    Back
                  </button>
                  <button
                    type="button"
                    className="cms-btn-secondary"
                    onClick={runValidate}
                    disabled={!pastedJson.trim() || validating}
                  >
                    {validating ? <Loader2 className="cms-spin" size={16} /> : null}
                    Validate
                  </button>
                  <button
                    type="button"
                    className="cms-btn-primary"
                    disabled={!validateResult?.valid || committing}
                    onClick={() => runCommit(false)}
                  >
                    {committing ? <Loader2 className="cms-spin" size={16} /> : null}
                    Commit
                  </button>
                </div>

                {validateResult && !validateResult.valid && (
                  <div className="cms-error-list">
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
                  </div>
                )}

                {validateResult?.valid && (
                  <div className="cms-preview">
                    <p className="cms-hint">Looks valid. Preview:</p>
                    {scope === 'page' ? (
                      <BlockRenderer blocks={parsedPreview?.blocks} />
                    ) : Array.isArray(parsedPreview) ? (
                      <ul className="cms-question-preview-list">
                        {parsedPreview.map((q, i) => (
                          <li key={i}>{q.text}</li>
                        ))}
                      </ul>
                    ) : (
                      <pre className="cms-mono">{JSON.stringify(parsedPreview, null, 2)}</pre>
                    )}
                  </div>
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
