import { useEffect, useState } from 'react'
import { Plus, Trash2, Sparkles, Save } from 'lucide-react'
import { cmsApi } from './cmsApi'

function emptyQuestion() {
  return {
    text: '',
    options: [
      { id: null, text: '' },
      { id: null, text: '' },
    ],
    correctOptionIds: [],
    explanation: '',
    difficulty: 'medium',
  }
}

function QuestionForm({ question, onChange, onSave, onDelete, saving }) {
  const updateOption = (i, text) => {
    const options = question.options.map((o, idx) => (idx === i ? { ...o, text } : o))
    onChange({ ...question, options })
  }

  const addOption = () => onChange({ ...question, options: [...question.options, { id: null, text: '' }] })

  const removeOption = (i) => {
    const removedId = question.options[i].id
    onChange({
      ...question,
      options: question.options.filter((_, idx) => idx !== i),
      correctOptionIds: question.correctOptionIds.filter((id) => id !== removedId),
    })
  }

  const toggleCorrect = (id, checked) => {
    // options created client-side have no id yet (assigned by the backend
    // on save) — correctness by index-derived placeholder isn't reliable
    // before the first save, so correct-option toggling only works cleanly
    // once options have real ids (after at least one save).
    const next = checked
      ? [...question.correctOptionIds, id]
      : question.correctOptionIds.filter((x) => x !== id)
    onChange({ ...question, correctOptionIds: next })
  }

  return (
    <div className="cms-block-card">
      <label className="cms-field">
        <span>Question text</span>
        <textarea
          rows={2}
          value={question.text}
          onChange={(e) => onChange({ ...question, text: e.target.value })}
        />
      </label>

      {question.options.map((option, i) => (
        <div key={i} className="cms-row cms-option-row">
          <input
            type="checkbox"
            checked={!!option.id && question.correctOptionIds.includes(option.id)}
            disabled={!option.id}
            title={option.id ? 'Mark correct' : 'Save once to assign this option an id'}
            onChange={(e) => option.id && toggleCorrect(option.id, e.target.checked)}
          />
          <input
            value={option.text}
            onChange={(e) => updateOption(i, e.target.value)}
            placeholder={`Option ${i + 1}`}
          />
          <button type="button" className="cms-btn-icon" onClick={() => removeOption(i)}>
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button type="button" className="cms-btn-secondary" onClick={addOption}>
        <Plus size={14} /> Add option
      </button>

      <label className="cms-field">
        <span>Explanation</span>
        <textarea
          rows={2}
          value={question.explanation || ''}
          onChange={(e) => onChange({ ...question, explanation: e.target.value })}
        />
      </label>

      <label className="cms-field">
        <span>Difficulty</span>
        <select
          value={question.difficulty || 'medium'}
          onChange={(e) => onChange({ ...question, difficulty: e.target.value })}
        >
          {['easy', 'medium', 'hard'].map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>

      <div className="cms-modal-actions">
        <button type="button" className="cms-btn-primary" onClick={onSave} disabled={saving}>
          <Save size={14} /> {question.id ? 'Update' : 'Create'}
        </button>
        {question.id && (
          <button type="button" className="cms-btn-danger" onClick={onDelete}>
            <Trash2 size={14} /> Delete
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Assessments tab — list + add/edit/delete for a module's question bank or
 * the course's final exam bank. `target` is either {kind:'module', id} or
 * {kind:'final-exam', courseId}.
 */
export function AssessmentsTab({ target, courseId, onGenerateWithAi }) {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [draft, setDraft] = useState(null)
  const [savingId, setSavingId] = useState(null)

  const load = () => {
    if (!target) return
    setLoading(true)
    const promise =
      target.kind === 'module'
        ? cmsApi.listModuleQuestions(target.id)
        : cmsApi.listFinalExamQuestions(courseId)
    promise
      .then(setQuestions)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [target, courseId])

  if (!target) {
    return <p className="cms-empty-hint">Select a module (or the final exam) to manage its questions.</p>
  }

  const saveQuestion = async (question, isDraft) => {
    setSavingId(question.id || 'draft')
    setError(null)
    try {
      const body = {
        text: question.text,
        options: question.options.map((o) => ({ id: o.id || undefined, text: o.text })),
        correctOptionIds: question.correctOptionIds,
        explanation: question.explanation || null,
        difficulty: question.difficulty || null,
      }
      if (question.id) {
        await cmsApi.updateQuestion(question.id, body)
      } else if (target.kind === 'module') {
        await cmsApi.createModuleQuestion(target.id, body)
      } else {
        await cmsApi.createFinalExamQuestion(courseId, body)
      }
      if (isDraft) setDraft(null)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingId(null)
    }
  }

  const deleteQuestion = async (id) => {
    if (!window.confirm('Delete this question?')) return
    await cmsApi.deleteQuestion(id)
    load()
  }

  return (
    <div className="cms-assessments">
      <div className="cms-content-header">
        <h3>{target.kind === 'module' ? 'Module question bank' : 'Final exam question bank'}</h3>
        <div className="cms-modal-actions">
          <button
            type="button"
            className="cms-btn-ai"
            onClick={() =>
              onGenerateWithAi(
                target.kind === 'module'
                  ? { scope: 'module-qcm', moduleId: target.id }
                  : { scope: 'final-exam' },
              )
            }
          >
            <Sparkles size={16} /> Generate with AI
          </button>
          {!draft && (
            <button type="button" className="cms-btn-secondary" onClick={() => setDraft(emptyQuestion())}>
              <Plus size={16} /> Add question
            </button>
          )}
        </div>
      </div>

      {error && <p className="cms-error">{error}</p>}
      {loading && <p className="cms-loading">Loading…</p>}

      {draft && (
        <QuestionForm
          question={draft}
          onChange={setDraft}
          onSave={() => saveQuestion(draft, true)}
          saving={savingId === 'draft'}
        />
      )}

      {!loading && questions.length === 0 && !draft && (
        <p className="cms-empty-hint">No questions yet.</p>
      )}

      <ul className="cms-block-list-editor">
        {questions.map((q) => (
          <li key={q.id}>
            <QuestionForm
              question={q}
              onChange={(next) =>
                setQuestions((prev) => prev.map((p) => (p.id === q.id ? next : p)))
              }
              onSave={() => saveQuestion(questions.find((p) => p.id === q.id), false)}
              onDelete={() => deleteQuestion(q.id)}
              saving={savingId === q.id}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
