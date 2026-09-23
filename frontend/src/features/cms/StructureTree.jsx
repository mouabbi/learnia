import { useState } from 'react'
import { ChevronDown, ChevronRight, ArrowUp, ArrowDown, Plus, Pencil, Trash2, Sparkles } from 'lucide-react'

/**
 * Structure tab — Module > Chapter > Page tree with add/rename/delete and
 * up/down reordering (arrow buttons, not drag-and-drop — simpler and
 * dependency-free for v1, see the workspace report for the tradeoff).
 * Clicking a page selects it (drives the Content tab).
 *
 * Props: course (with modules/chapters/pages tree already loaded),
 * onChange() to refetch after any mutation, onSelectPage(page),
 * selectedPageId, onGenerateWithAi({scope, moduleId?, chapterId?}).
 */
export function StructureTree({ course, actions, onChange, onSelectPage, selectedPageId, onGenerateWithAi }) {
  const [expandedModules, setExpandedModules] = useState(() => new Set())
  const [expandedChapters, setExpandedChapters] = useState(() => new Set())

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
      <div className="cms-tree-toolbar">
        <button type="button" className="cms-btn-secondary" onClick={addModule}>
          <Plus size={16} /> Add module
        </button>
        <button
          type="button"
          className="cms-btn-ai"
          onClick={() => onGenerateWithAi({ scope: 'module' })}
        >
          <Sparkles size={16} /> Generate module with AI
        </button>
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
              <div className="cms-tree-row">
                <button
                  type="button"
                  className="cms-tree-toggle"
                  onClick={() => toggle(expandedModules, setExpandedModules, module.id)}
                >
                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                <span className="cms-tree-label">{module.title}</span>
                <div className="cms-tree-actions">
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
                    onClick={() => onGenerateWithAi({ scope: 'chapter', moduleId: module.id })}
                    title="Generate chapter with AI"
                  >
                    <Sparkles size={14} />
                  </button>
                  <button
                    type="button"
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
                          <div className="cms-tree-row">
                            <button
                              type="button"
                              className="cms-tree-toggle"
                              onClick={() => toggle(expandedChapters, setExpandedChapters, chapter.id)}
                            >
                              {chOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                            <span className="cms-tree-label">{chapter.title}</span>
                            <div className="cms-tree-actions">
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
