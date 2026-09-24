import { useRef } from 'react'

// Lightweight JSON syntax highlighter — no dependency, just a regex tokenizer
// over the four JSON token shapes (string/key, number, boolean, null).
// Good enough for a paste-and-review box; not a real parser/tokenizer.
function highlightJson(source) {
  const escaped = (source || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escaped.replace(
    /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?)|\b(?:true|false)\b|\bnull\b|(?:-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match, str, isKey) => {
      if (str) return `<span class="${isKey ? 'json-key' : 'json-string'}">${match}</span>`
      if (match === 'true' || match === 'false') return `<span class="json-boolean">${match}</span>`
      if (match === 'null') return `<span class="json-null">${match}</span>`
      return `<span class="json-number">${match}</span>`
    },
  )
}

/**
 * A textarea with a live syntax-highlighted backdrop — the classic
 * "transparent textarea over a <pre>" trick (no editable rich-text, no
 * dependency): the real <textarea> sits on top with transparent text and a
 * visible caret, and a same-font/same-size <pre> underneath renders the
 * colored version, scrolled in sync. Used by AiImportModal's "paste JSON"
 * step so pasted AI output reads like a real code block instead of flat
 * monospace text.
 */
export function JsonCodeEditor({ value, onChange, placeholder, rows = 10 }) {
  const preRef = useRef(null)

  const syncScroll = (e) => {
    if (preRef.current) {
      preRef.current.scrollTop = e.target.scrollTop
      preRef.current.scrollLeft = e.target.scrollLeft
    }
  }

  return (
    <div className="cms-json-editor" style={{ '--json-editor-rows': rows }}>
      <pre ref={preRef} className="cms-json-editor-highlight" aria-hidden="true">
        {/* Safe: highlightJson HTML-escapes the source first, then only
            wraps regex matches in fixed <span class="..."> tags — never
            injects anything from outside this function. */}
        <code dangerouslySetInnerHTML={{ __html: value ? highlightJson(value) + '\n' : '' }} />
      </pre>
      <textarea
        className="cms-json-editor-input cms-mono"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        placeholder={placeholder}
        spellCheck={false}
        rows={rows}
      />
    </div>
  )
}
