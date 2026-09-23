import { useEffect, useState } from 'react'
import { Plus, Trash2, ArrowUp, ArrowDown, Sparkles, Eye, Pencil } from 'lucide-react'
import { cmsApi } from './cmsApi'
import { BLOCK_EDITORS, BLOCK_TYPES, defaultBlockFor } from './BlockEditors'
import { BlockRenderer } from './BlockRenderer'

/**
 * Content tab — block-by-block editor for the page selected in the
 * Structure tab. Explicit "Save" only (11's resolved decision: no
 * autosave). A Preview toggle renders the same blocks read-only via
 * BlockRenderer (also reused by AiImportModal's page-content preview).
 */
export function ContentTab({ page, onGenerateWithAi }) {
  const [blocks, setBlocks] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)
  const [preview, setPreview] = useState(false)

  useEffect(() => {
    if (!page) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(null)
    setSaved(false)
    cmsApi
      .getPageContent(page.id)
      .then((res) => setBlocks(res.blocks || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [page])

  if (!page) {
    return <p className="cms-empty-hint">Select a page from the Structure tab to edit its content.</p>
  }

  const updateBlock = (index, next) => {
    setBlocks((prev) => prev.map((b, i) => (i === index ? next : b)))
  }

  const removeBlock = (index) => {
    setBlocks((prev) => prev.filter((_, i) => i !== index))
  }

  const moveBlock = (index, dir) => {
    setBlocks((prev) => {
      const next = [...prev]
      const target = index + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const addBlock = (type) => {
    setBlocks((prev) => [...prev, defaultBlockFor(type)])
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await cmsApi.putPageContent(page.id, { schemaVersion: 1, blocks })
      setSaved(true)
      setTimeout(() => setSaved(false), 1800)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="cms-content-editor">
      <div className="cms-content-header">
        <h3>{page.title}</h3>
        <div className="cms-modal-actions">
          <button
            type="button"
            className="cms-btn-ai"
            onClick={() => onGenerateWithAi({ scope: 'page', chapterId: page.chapterId, pageId: page.id })}
          >
            <Sparkles size={16} /> Generate with AI
          </button>
          <button type="button" className="cms-btn-secondary" onClick={() => setPreview((p) => !p)}>
            {preview ? <Pencil size={16} /> : <Eye size={16} />}
            {preview ? 'Edit' : 'Preview'}
          </button>
          <button type="button" className="cms-btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
          </button>
        </div>
      </div>

      {error && <p className="cms-error">{error}</p>}
      {loading && <p className="cms-loading">Loading…</p>}

      {!loading && preview && <BlockRenderer blocks={blocks} />}

      {!loading && !preview && (
        <>
          {blocks.length === 0 && <p className="cms-empty-hint">No blocks yet — add one below.</p>}
          <ul className="cms-block-list-editor">
            {blocks.map((block, i) => {
              const Editor = BLOCK_EDITORS[block.type]
              return (
                <li key={i} className="cms-block-card">
                  <div className="cms-block-card-header">
                    <span className="cms-block-type-tag">{block.type}</span>
                    <div className="cms-tree-actions">
                      <button type="button" onClick={() => moveBlock(i, -1)} title="Move up">
                        <ArrowUp size={14} />
                      </button>
                      <button type="button" onClick={() => moveBlock(i, 1)} title="Move down">
                        <ArrowDown size={14} />
                      </button>
                      <button type="button" onClick={() => removeBlock(i)} title="Remove block">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {Editor ? (
                    <Editor block={block} onChange={(next) => updateBlock(i, next)} />
                  ) : (
                    <p className="cms-error">Unknown block type: {block.type}</p>
                  )}
                </li>
              )
            })}
          </ul>

          <div className="cms-add-block-row">
            <span>Add block:</span>
            {BLOCK_TYPES.map((type) => (
              <button key={type} type="button" className="cms-btn-secondary" onClick={() => addBlock(type)}>
                <Plus size={12} /> {type}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
