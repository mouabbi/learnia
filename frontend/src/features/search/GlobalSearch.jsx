/**
 * Global command-palette search (14-global-search). Self-contained: it
 * manages its own open/closed state internally, listening for Ctrl+K /
 * Cmd+K on `window`, so the only integration another file needs is
 * rendering `<GlobalSearch />` once near the app root (e.g. in App.jsx or
 * AppLayout) — no props required. Not wired into App.jsx yet, per this
 * task's scope (avoiding a concurrent edit to that file); whoever wires it
 * in just needs to add that one render.
 *
 * Navigation limitation: the reader (features/courses' course reader) does
 * not support deep-linking to a specific page via URL today, so clicking a
 * page/chapter/module result just navigates to `/courses/{slug}/learn`
 * (the course's reader entry point), not to that exact page. Clicking a
 * course result navigates to the same route. A future reader change to
 * support `?page=` (or similar) could make this precise.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Search, BookOpen, Layers, Bookmark, FileText, X } from 'lucide-react'
import { searchApi } from './searchApi'

const DEBOUNCE_MS = 250

const TYPE_ICON = {
  course: BookOpen,
  module: Layers,
  chapter: Bookmark,
  page: FileText,
}

const TYPE_LABEL = {
  course: 'Course',
  module: 'Module',
  chapter: 'Chapter',
  page: 'Page',
}

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef(null)
  const debounceRef = useRef(null)
  const navigate = useNavigate()

  const close = useCallback(() => {
    setIsOpen(false)
    setQuery('')
    setResults([])
  }, [])

  // Ctrl+K / Cmd+K opens the palette from anywhere; Escape closes it.
  useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen((open) => !open)
      } else if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Focus the input as soon as the palette opens.
  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

  // Debounced query-as-you-type.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!query.trim()) {
      setResults([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchApi.search(query.trim())
        setResults(data?.results ?? [])
      } catch {
        setResults([])
      } finally {
        setIsLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(debounceRef.current)
  }, [query])

  function handleSelect(result) {
    // See file-top docstring: no deep-linking into a specific page/chapter
    // yet, so every result type lands on the course's reader entry point.
    navigate(`/courses/${result.courseSlug}/learn`)
    close()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="global-search-overlay"
            onClick={close}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          />

          <motion.div
            className="global-search-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Global search"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ type: 'tween', duration: 0.18, ease: 'easeOut' }}
          >
            <div className="global-search-input-row">
              <Search aria-hidden="true" size={18} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search courses, chapters, pages..."
                aria-label="Search"
              />
              <button
                type="button"
                className="global-search-close"
                onClick={close}
                aria-label="Close search"
                title="Close"
              >
                <X aria-hidden="true" size={16} />
              </button>
            </div>

            <div className="global-search-results">
              {isLoading && <p className="global-search-status">Searching…</p>}

              {!isLoading && query.trim() && results.length === 0 && (
                <p className="global-search-status">No results for "{query.trim()}"</p>
              )}

              {!isLoading && results.length > 0 && (
                <ul>
                  {results.map((result) => {
                    const Icon = TYPE_ICON[result.type] ?? FileText
                    return (
                      <li key={`${result.type}-${result.id}`}>
                        <button
                          type="button"
                          className="global-search-result"
                          onClick={() => handleSelect(result)}
                        >
                          <Icon aria-hidden="true" size={16} />
                          <span className="global-search-result-body">
                            <span className="global-search-result-title">{result.title}</span>
                            {result.snippet && (
                              <span
                                className="global-search-result-snippet"
                                // snippet HTML comes from our own backend's
                                // FTS5 snippet() output (just <b> tags around
                                // the match), never user-authored markup.
                                dangerouslySetInnerHTML={{ __html: result.snippet }}
                              />
                            )}
                          </span>
                          <span className="global-search-result-type">
                            {TYPE_LABEL[result.type] ?? result.type}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}

              {!isLoading && !query.trim() && (
                <p className="global-search-status">
                  Type to search, or press <kbd>Esc</kbd> to close.
                </p>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
