import { useState } from 'react'
import { ChevronDown, ChevronRight, ArrowUp, ArrowDown, Plus, Pencil, Trash2, Sparkles, FileText, Eraser, Wand2, ListTree } from 'lucide-react'

/**
 * Structure tab — Module > Chapter > Page tree with add/rename/delete and
 * up/down reordering (arrow buttons, not drag-and-drop — simpler and
 * dependency-free for v1, see the workspace report for the tradeoff).
 * Clicking a page selects it (drives the Content tab).
 *
 * Props: course (with modules/chapters/pages tree already loaded),
 * onChange() to refetch after any mutation, onSelectPage(page),
 * selectedPageId, onGenerateWithAi({scope, moduleId?, chapterId?}),
 * onGenerateAll() — opens the batch "Generate All" modal.
 */
export function StructureTree({ course, actions, onChange, onSelectPage, selectedPageId, onGenerateWithAi, onGenerateAll }) {
  const [expandedModules, setExpandedModules] = useState(() => new Set())
  const [expandedChapters, setExpandedChapters] = useState(() => new Set())
  const [clearing, setClearing] = useState(false)

  const toggle = (set, setSet, id) => {
    const next = new Set(set)
    next.has(id) ? next.delete(id) : next.add(id)
    setSet(next)
  }

  const addModule = async () => {
    const title = window.prompt('New module title')
    if (!title) return
    await actions.createModule(course.id, title)
    onChange()
  }

  const renameNode = async (kind, node) => {
    const title = window.prompt('Rename', node.title)
    if (!title || title === node.title) return
    if (kind === 'module') await actions.renameModule(node.id, title)
    if (kind === 'chapter') await actions.renameChapter(node.id, title)
    if (kind === 'page') await actions.renamePage(node.id, title)
    onChange()
  }

  const deleteNode = async (kind, node) => {
    if (!window.confirm(`Delete "${node.title}"? This cannot be undone.`)) return
    if (kind === 'module') await actions.deleteModule(node.id)
    if (kind === 'chapter') await actions.deleteChapter(node.id)
    if (kind === 'page') await actions.deletePage(node.id)
    onChange()
  }

  // v1, on purpose (see the TODO block below): delete every module — and
  // with it every chapter/page/content-file/quiz question underneath, via
  // the orphan-safe cascading delete_module already used one-at-a-time —
  // then let the admin either add modules by hand or hit "Generate full
  // course structure with AI" again, which only shows once modules.length
  // is back to 0. A smarter "edit in place, preserve unchanged names"
  // version is deliberately deferred (see the TODO comment).
  const clearStructure = async () => {
    const modules = course.modules || []
    if (modules.length === 0) return
    if (
      !window.confirm(
        `Clear this course's entire structure? This deletes all ${modules.length} module(s) — ` +
          `every chapter, page, page content, and module quiz question underneath them. ` +
          `The final exam bank is not affected. This cannot be undone.`,
      )
    ) {
      return
    }
    setClearing(true)
    try {
      for (const module of modules) {
        // Sequential, not Promise.all: each delete_module renumbers
        // sibling positions server-side, so deleting concurrently could
        // race against those renumbers.
        await actions.deleteModule(module.id)
      }
      onChange()
    } finally {
      setClearing(false)
    }
  }

  const move = async (kind, parentId, ids, index, dir) => {
    const next = [...ids]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    if (kind === 'module') await actions.reorderModules(course.id, next)
    if (kind === 'chapter') await actions.reorderChapters(parentId, next)
    if (kind === 'page') await actions.reorderPages(parentId, next)
    onChange()
  }

  return (
    <div className="cms-tree">
      {/*
        TODO (next version, per user direction 2026-09-24): a top-level
        "generate a new module with AI" button was removed here on purpose
        — it duplicated the per-module AI actions and wasn't a clear
        action once a course already has structure. Planned replacement,
        not built yet:
          - "Clear structure" (below) is the deliberate v1 stopgap for
            "I want to redo the structure": it's delete-everything-then-
            regenerate, not an edit. A smarter version would prompt with
            the CURRENT structure included and ask the AI to only add/
            remove what's actually changing, preserving names/content for
            everything else — so redoing a course's outline doesn't have
            to mean losing every page's written content. Not built yet.
          - "Generate full course structure" (below) should only show
            while the course is small (< 4 modules); past that, offer an
            "edit structure with AI" flow instead of a from-scratch one.
          - A brand-new module generated by AI should be started from
            context on an existing module/chapter "card", not a floating
            toolbar button.
          - Separately (bigger, unrelated to this toolbar): when a
            published course's content changes after a learner has already
            taken it, surface that in the learner platform ("this course
            was updated") with an option to review what's new and retake
            the affected module quiz/final exam.
      */}
      <div className="cms-tree-toolbar">
        <button type="button" className="cms-btn-secondary" onClick={addModule}>
          <Plus size={16} /> Add module
        </button>
        {(course.modules || []).length > 0 && (
          <button
            type="button"
            className="cms-btn-ai"
            onClick={onGenerateAll}
            title="Pick modules to generate content/quiz for (and the final exam), in one combined prompt"
          >
            <Wand2 size={16} /> Generate All
          </button>
        )}
        {(course.modules || []).length > 0 && (
          <button
            type="button"
            className="cms-btn-ai"
            onClick={() => onGenerateWithAi({ scope: 'module' })}
            title="Design one new module (chapters + page titles) with AI and add it at the end — fill its content afterwards with Generate All"
          >
            <ListTree size={16} /> Add module with AI
          </button>
        )}
        {(course.modules || []).length > 0 && (
          <button
            type="button"
            className="cms-btn-danger"
            onClick={clearStructure}
            disabled={clearing}
            title="Delete every module (and everything under them) to start the structure over"
          >
            <Eraser size={16} /> {clearing ? 'Clearing…' : 'Clear structure'}
          </button>
        )}
        {(course.modules || []).length === 0 && (
          <button
            type="button"
            className="cms-btn-ai cms-btn-ai-structure"
            onClick={() => onGenerateWithAi({ scope: 'course' })}
          >
            <Sparkles size={16} /> Generate full course structure with AI
          </button>
        )}
      </div>

      {(course.modules || []).length === 0 && (
        <p className="cms-empty-hint">
          No modules yet — add one manually, or generate the whole course structure
          (modules, chapters, pages) with AI in one shot.
        </p>
      )}

      <ul className="cms-tree-list">
        {(course.modules || []).map((module, mi) => {
          const moduleIds = (course.modules || []).map((m) => m.id)
          const isOpen = expandedModules.has(module.id)
          return (
            <li key={module.id} className="cms-tree-node">
              <div
                className="cms-tree-row cms-tree-row-clickable"
                role="button"
                tabIndex={0}
                onClick={() => toggle(expandedModules, setExpandedModules, module.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    toggle(expandedModules, setExpandedModules, module.id)
                  }
                }}
              >
                <span className="cms-tree-toggle">
                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </span>
                <span className="cms-tree-label">{module.title}</span>
                <div className="cms-tree-actions" onClick={(e) => e.stopPropagation()}>
                  <button type="button" onClick={() => move('module', null, moduleIds, mi, -1)} title="Move up">
                    <ArrowUp size={14} />
                  </button>
                  <button type="button" onClick={() => move('module', null, moduleIds, mi, 1)} title="Move down">
                    <ArrowDown size={14} />
                  </button>
                  <button type="button" onClick={() => renameNode('module', module)} title="Rename">
                    <Pencil size={14} />
                  </button>
                  <button type="button" onClick={() => deleteNode('module', module)} title="Delete">
                    <Trash2 size={14} />
                  </button>
                  <button
                    type="button"
                    className="cms-tree-action-ai-content"
                    onClick={() => onGenerateWithAi({ scope: 'module', moduleId: module.id })}
                    title="Generate structure with AI: adds the chapters + pages this module is missing (existing ones are kept as-is)"
                  >
                    <ListTree size={14} /> Structure
                  </button>
                  <button
                    type="button"
                    onClick={() => onGenerateWithAi({ scope: 'chapter', moduleId: module.id })}
                    title="Add ONE new chapter (with its pages) to this module with AI"
                  >
                    <Sparkles size={14} />
                  </button>
                  <button
                    type="button"
                    className="cms-tree-action-ai-content"
                    onClick={() => onGenerateWithAi({ scope: 'module-content', moduleId: module.id })}
                    title="Generate module content with AI (fills only the empty pages — or every page if none is written yet)"
                  >
                    <FileText size={14} /> Content
                  </button>
                  <button
                    type="button"
                    className="cms-tree-action-ai-content"
                    onClick={() => onGenerateWithAi({ scope: 'module-qcm', moduleId: module.id })}
                    title="Generate module quiz with AI"
                  >
                    QCM
                  </button>
                </div>
              </div>

              {isOpen && (
                <>
                  <button
                    type="button"
                    className="cms-btn-secondary cms-tree-add-child"
                    onClick={async () => {
                      const title = window.prompt('New chapter title')
                      if (!title) return
                      await actions.createChapter(module.id, title)
                      onChange()
                    }}
                  >
                    <Plus size={14} /> Add chapter
                  </button>

                  <ul className="cms-tree-list cms-tree-indent">
                    {(module.chapters || []).map((chapter, ci) => {
                      const chapterIds = (module.chapters || []).map((c) => c.id)
                      const chOpen = expandedChapters.has(chapter.id)
                      return (
                        <li key={chapter.id} className="cms-tree-node">
                          <div
                            className="cms-tree-row cms-tree-row-clickable"
                            role="button"
                            tabIndex={0}
                            onClick={() => toggle(expandedChapters, setExpandedChapters, chapter.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                toggle(expandedChapters, setExpandedChapters, chapter.id)
                              }
                            }}
                          >
                            <span className="cms-tree-toggle">
                              {chOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </span>
                            <span className="cms-tree-label">{chapter.title}</span>
                            <div className="cms-tree-actions" onClick={(e) => e.stopPropagation()}>
                              <button type="button" onClick={() => move('chapter', module.id, chapterIds, ci, -1)} title="Move up">
                                <ArrowUp size={14} />
                              </button>
                              <button type="button" onClick={() => move('chapter', module.id, chapterIds, ci, 1)} title="Move down">
                                <ArrowDown size={14} />
                              </button>
                              <button type="button" onClick={() => renameNode('chapter', chapter)} title="Rename">
                                <Pencil size={14} />
                              </button>
                              <button type="button" onClick={() => deleteNode('chapter', chapter)} title="Delete">
                                <Trash2 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => onGenerateWithAi({ scope: 'page', chapterId: chapter.id })}
                                title="Generate page with AI"
                              >
                                <Sparkles size={14} />
                              </button>
                            </div>
                          </div>

                          {chOpen && (
                            <>
                              <button
                                type="button"
                                className="cms-btn-secondary cms-tree-add-child"
                                onClick={async () => {
                                  const title = window.prompt('New page title')
                                  if (!title) return
                                  await actions.createPage(chapter.id, title)
                                  onChange()
                                }}
                              >
                                <Plus size={14} /> Add page
                              </button>

                              <ul className="cms-tree-list cms-tree-indent">
                                {(chapter.pages || []).map((page, pi) => {
                                  const pageIds = (chapter.pages || []).map((p) => p.id)
                                  return (
                                    <li key={page.id} className="cms-tree-node">
                                      <div className="cms-tree-row">
                                        <button
                                          type="button"
                                          className={`cms-tree-page-btn${
                                            selectedPageId === page.id ? ' cms-tree-page-selected' : ''
                                          }`}
                                          onClick={() => onSelectPage({ ...page, chapterId: chapter.id })}
                                        >
                                          {page.title}
                                        </button>
                                        <div className="cms-tree-actions">
                                          <button type="button" onClick={() => move('page', chapter.id, pageIds, pi, -1)} title="Move up">
                                            <ArrowUp size={14} />
                                          </button>
                                          <button type="button" onClick={() => move('page', chapter.id, pageIds, pi, 1)} title="Move down">
                                            <ArrowDown size={14} />
                                          </button>
                                          <button type="button" onClick={() => renameNode('page', page)} title="Rename">
                                            <Pencil size={14} />
                                          </button>
                                          <button type="button" onClick={() => deleteNode('page', page)} title="Delete">
                                            <Trash2 size={14} />
                                          </button>
                                        </div>
                                      </div>
                                    </li>
                                  )
                                })}
                              </ul>
                            </>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
