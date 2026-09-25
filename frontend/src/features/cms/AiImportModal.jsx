import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { X, Copy, Check, Loader2, AlertTriangle, Braces } from 'lucide-react'
import { cmsApi } from './cmsApi'
import { copyText } from '../../utils/clipboard'
import { BlockRenderer } from './BlockRenderer'
import { JsonCodeEditor } from './JsonCodeEditor'

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
 *  - courseId, scope ("course"|"module"|"chapter"|"page"|"module-content"|"module-qcm"|"final-exam")
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
  const [formatError, setFormatError] = useState(null)
  const [validating, setValidating] = useState(false)
  const [validateResult, setValidateResult] = useState(null)
  const [needsReplaceConfirm, setNeedsReplaceConfirm] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [commitError, setCommitError] = useState(null)

  useEffect(() => {
    if (!open) return
    setStep(1)
    setPastedJson('')
    setFormatError(null)
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
    const ok = await copyText(prompt)
    setCopied(ok ? 'ok' : 'failed')
    setTimeout(() => setCopied(false), ok ? 1500 : 3000)
  }

  // Re-indents whatever was pasted (LLMs often return single-line or
  // inconsistently-indented JSON) — pure formatting, doesn't validate
  // against the real schema, that's still what "Validate" is for.
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
            <h3>Generate with AI — {SCOPE_LABELS[scope] ?? scope}</h3>
            <button type="button" className="cms-btn-icon" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>

          <div className="cms-modal-steps">
            <span className={`cms-modal-step${step === 1 ? ' cms-step-active' : ''}${step > 1 ? ' cms-step-done' : ''}`}>
              <span className="cms-modal-step-badge">{step > 1 ? <Check size={12} /> : 1}</span>
              Copy prompt
            </span>
            <span className="cms-modal-step-connector" />
            <span className={`cms-modal-step${step === 2 ? ' cms-step-active' : ''}`}>
              <span className="cms-modal-step-badge">2</span>
              Paste JSON
            </span>
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
                        {copied === 'ok' ? <Check size={16} /> : <Copy size={16} />}
                        {copied === 'ok'
                          ? 'Copied'
                          : copied === 'failed'
                            ? 'Copy failed — select the text and press Ctrl+C'
                            : 'Copy to clipboard'}
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
                  <button type="button" className="cms-btn-secondary" onClick={() => setStep(1)}>
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
                    {scope === 'page' ? (
                      <BlockRenderer blocks={parsedPreview?.blocks} />
                    ) : scope === 'module-content' ? (
                      <ul className="cms-question-preview-list">
                        {(parsedPreview?.pages || []).map((p, i) => (
                          <li key={i}>
                            Page {i + 1}: {p.blocks?.length || 0} block{p.blocks?.length === 1 ? '' : 's'}
                          </li>
                        ))}
                      </ul>
                    ) : scope === 'module' || scope === 'chapter' || scope === 'course' ? (
                      <StructurePreview scope={scope} parsed={parsedPreview} />
                    ) : Array.isArray(parsedPreview) ? (
                      <ul className="cms-question-preview-list">
                        {parsedPreview.map((q, i) => (
                          <li key={i}>{q.text}</li>
                        ))}
                      </ul>
                    ) : (
                      <pre className="cms-mono">{JSON.stringify(parsedPreview, null, 2)}</pre>
                    )}
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

const SCOPE_LABELS = {
  course: 'course structure',
  module: 'module structure',
  chapter: 'new chapter',
  page: 'page content',
  'module-content': 'module content',
  'module-qcm': 'module quiz',
  'final-exam': 'final exam',
}

// Chapter/page outline of a structure import (course, module or chapter
// scope) — what will be created, instead of a raw JSON dump.
function StructurePreview({ scope, parsed }) {
  const chapterList = (chapters) => (
    <ul className="cms-structure-preview">
      {(chapters || []).map((c, ci) => (
        <li key={ci}>
          <strong>{c.title}</strong>
          {(c.pages || []).length > 0 && (
            <ul>
              {c.pages.map((p, pi) => (
                <li key={pi}>{p.title}</li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  )
  if (scope === 'chapter') return chapterList([parsed])
  if (scope === 'module') {
    return (
      <>
        <p className="cms-hint">
          <strong>{parsed?.title}</strong> — {(parsed?.chapters || []).length} chapter(s) to add
        </p>
        {chapterList(parsed?.chapters)}
      </>
    )
  }
  return (
    <>
      <p className="cms-hint">
        <strong>{parsed?.title}</strong>
        {(parsed?.modules || []).length > 0 ? ` — ${parsed.modules.length} module(s)` : ''}
      </p>
      <ul className="cms-structure-preview">
        {(parsed?.modules || []).map((m, mi) => (
          <li key={mi}>
            <strong>{m.title}</strong>
            {chapterList(m.chapters)}
          </li>
        ))}
      </ul>
    </>
  )
}
