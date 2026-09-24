// Per-block-type editor forms — registry-pattern mirroring the backend's
// discriminated union (schemas/content.py) and BlockRenderer.jsx's registry.
// Each editor is a small controlled form: `block` (current value),
// `onChange(nextBlock)`. Kept intentionally plain (native inputs) to match
// index.css's existing form styling rather than inventing new components.

function Field({ label, children }) {
  return (
    <label className="cms-field">
      <span>{label}</span>
      {children}
    </label>
  )
}

function set(block, patch) {
  return { ...block, ...patch }
}

export const BLOCK_TYPES = [
  'heading',
  'paragraph',
  'code',
  'terminal',
  'image',
  'video',
  'youtube',
  'link',
  'quote',
  'callout',
  'list',
  'table',
]

export function defaultBlockFor(type) {
  switch (type) {
    case 'heading':
      return { type, text: '', level: 2, numbered: false }
    case 'paragraph':
      return { type, text: '' }
    case 'code':
      return { type, code: '', language: '' }
    case 'terminal':
      return { type, text: '' }
    case 'image':
      // TODO: swap in AssetPicker once frontend/src/features/assets/AssetPicker.jsx lands
      return { type, src: '', alt: '', caption: '' }
    case 'video':
      // TODO: swap in AssetPicker once frontend/src/features/assets/AssetPicker.jsx lands
      return { type, src: '', caption: '' }
    case 'youtube':
      return { type, videoId: '', caption: '' }
    case 'link':
      return { type, href: '', text: '' }
    case 'quote':
      return { type, text: '', attribution: '' }
    case 'callout':
      return { type, variant: 'note', text: '' }
    case 'list':
      return { type, ordered: false, items: [''] }
    case 'table':
      return { type, headers: ['', ''], rows: [['', '']] }
    default:
      return { type: 'paragraph', text: '' }
  }
}

function HeadingEditor({ block, onChange }) {
  return (
    <>
      <Field label="Text">
        <input value={block.text} onChange={(e) => onChange(set(block, { text: e.target.value }))} />
      </Field>
      <Field label="Level">
        <select
          value={block.level}
          onChange={(e) => onChange(set(block, { level: Number(e.target.value) }))}
        >
          {[1, 2, 3, 4].map((l) => (
            <option key={l} value={l}>
              H{l}
            </option>
          ))}
        </select>
      </Field>
      <label className="cms-checkbox">
        <input
          type="checkbox"
          checked={!!block.numbered}
          onChange={(e) => onChange(set(block, { numbered: e.target.checked }))}
        />
        Numbered
      </label>
    </>
  )
}

function ParagraphEditor({ block, onChange }) {
  return (
    <Field label="Text">
      <textarea
        rows={3}
        value={block.text}
        onChange={(e) => onChange(set(block, { text: e.target.value }))}
      />
    </Field>
  )
}

function CodeEditor({ block, onChange }) {
  return (
    <>
      <Field label="Language">
        <input
          value={block.language || ''}
          onChange={(e) => onChange(set(block, { language: e.target.value }))}
          placeholder="e.g. python"
        />
      </Field>
      <Field label="Code">
        <textarea
          rows={6}
          className="cms-mono"
          value={block.code}
          onChange={(e) => onChange(set(block, { code: e.target.value }))}
        />
      </Field>
    </>
  )
}

function TerminalEditor({ block, onChange }) {
  return (
    <Field label="Terminal output">
      <textarea
        rows={4}
        className="cms-mono"
        value={block.text}
        onChange={(e) => onChange(set(block, { text: e.target.value }))}
      />
    </Field>
  )
}

function ImageEditor({ block, onChange }) {
  return (
    <>
      {/* TODO: swap in AssetPicker once frontend/src/features/assets/AssetPicker.jsx lands */}
      <Field label="Image URL / asset id">
        <input value={block.src} onChange={(e) => onChange(set(block, { src: e.target.value }))} />
      </Field>
      <Field label="Alt text">
        <input value={block.alt || ''} onChange={(e) => onChange(set(block, { alt: e.target.value }))} />
      </Field>
      <Field label="Caption">
        <input
          value={block.caption || ''}
          onChange={(e) => onChange(set(block, { caption: e.target.value }))}
        />
      </Field>
    </>
  )
}

function VideoEditor({ block, onChange }) {
  return (
    <>
      {/* TODO: swap in AssetPicker once frontend/src/features/assets/AssetPicker.jsx lands */}
      <Field label="Video URL / asset id">
        <input value={block.src} onChange={(e) => onChange(set(block, { src: e.target.value }))} />
      </Field>
      <Field label="Caption">
        <input
          value={block.caption || ''}
          onChange={(e) => onChange(set(block, { caption: e.target.value }))}
        />
      </Field>
    </>
  )
}

function YoutubeEditor({ block, onChange }) {
  return (
    <>
      <Field label="YouTube video id">
        <input
          value={block.videoId || ''}
          onChange={(e) => onChange(set(block, { videoId: e.target.value }))}
          placeholder="e.g. dQw4w9WgXcQ"
        />
      </Field>
      <Field label="Caption">
        <input
          value={block.caption || ''}
          onChange={(e) => onChange(set(block, { caption: e.target.value }))}
        />
      </Field>
    </>
  )
}

function LinkEditor({ block, onChange }) {
  return (
    <>
      <Field label="URL">
        <input value={block.href} onChange={(e) => onChange(set(block, { href: e.target.value }))} />
      </Field>
      <Field label="Link text">
        <input value={block.text} onChange={(e) => onChange(set(block, { text: e.target.value }))} />
      </Field>
    </>
  )
}

function QuoteEditor({ block, onChange }) {
  return (
    <>
      <Field label="Quote">
        <textarea
          rows={3}
          value={block.text}
          onChange={(e) => onChange(set(block, { text: e.target.value }))}
        />
      </Field>
      <Field label="Attribution">
        <input
          value={block.attribution || ''}
          onChange={(e) => onChange(set(block, { attribution: e.target.value }))}
        />
      </Field>
    </>
  )
}

function CalloutEditor({ block, onChange }) {
  return (
    <>
      <Field label="Variant">
        <select
          value={block.variant}
          onChange={(e) => onChange(set(block, { variant: e.target.value }))}
        >
          {['tip', 'warning', 'important', 'note'].map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Text">
        <textarea
          rows={3}
          value={block.text}
          onChange={(e) => onChange(set(block, { text: e.target.value }))}
        />
      </Field>
    </>
  )
}

function ListEditor({ block, onChange }) {
  const items = block.items || []
  const updateItem = (i, value) => {
    const next = [...items]
    next[i] = value
    onChange(set(block, { items: next }))
  }
  return (
    <>
      <label className="cms-checkbox">
        <input
          type="checkbox"
          checked={!!block.ordered}
          onChange={(e) => onChange(set(block, { ordered: e.target.checked }))}
        />
        Ordered
      </label>
      {items.map((item, i) => (
        <div key={i} className="cms-row">
          <input value={item} onChange={(e) => updateItem(i, e.target.value)} />
          <button
            type="button"
            className="cms-btn-icon"
            onClick={() => onChange(set(block, { items: items.filter((_, idx) => idx !== i) }))}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="cms-btn-secondary"
        onClick={() => onChange(set(block, { items: [...items, ''] }))}
      >
        + Add item
      </button>
    </>
  )
}

function TableEditor({ block, onChange }) {
  const headers = block.headers || []
  const rows = block.rows || []
  const updateHeader = (i, value) => {
    const next = [...headers]
    next[i] = value
    onChange(set(block, { headers: next }))
  }
  const updateCell = (ri, ci, value) => {
    const next = rows.map((row) => [...row])
    next[ri][ci] = value
    onChange(set(block, { rows: next }))
  }
  const addColumn = () => {
    onChange(
      set(block, {
        headers: [...headers, ''],
        rows: rows.map((row) => [...row, '']),
      }),
    )
  }
  const addRow = () => {
    onChange(set(block, { rows: [...rows, headers.map(() => '')] }))
  }
  return (
    <>
      <div className="cms-row">
        {headers.map((h, i) => (
          <input key={i} value={h} onChange={(e) => updateHeader(i, e.target.value)} placeholder={`Header ${i + 1}`} />
        ))}
        <button type="button" className="cms-btn-icon" onClick={addColumn}>
          + Col
        </button>
      </div>
      {rows.map((row, ri) => (
        <div key={ri} className="cms-row">
          {row.map((cell, ci) => (
            <input key={ci} value={cell} onChange={(e) => updateCell(ri, ci, e.target.value)} />
          ))}
        </div>
      ))}
      <button type="button" className="cms-btn-secondary" onClick={addRow}>
        + Add row
      </button>
    </>
  )
}

export const BLOCK_EDITORS = {
  heading: HeadingEditor,
  paragraph: ParagraphEditor,
  code: CodeEditor,
  terminal: TerminalEditor,
  image: ImageEditor,
  video: VideoEditor,
  youtube: YoutubeEditor,
  link: LinkEditor,
  quote: QuoteEditor,
  callout: CalloutEditor,
  list: ListEditor,
  table: TableEditor,
}
