import { Link } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Lock,
  CheckCircle2,
  Circle,
  HelpCircle,
  GraduationCap,
  Sun,
  Moon,
} from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'

// Docs-style shell for the course reader (see pages/CourseReaderPage.jsx):
// a slim topbar, a left sidebar tree (Module > Chapter > Page, plus a
// module-QCM row per module), and a content pane for whatever's active.
// Purely presentational — all state (expanded modules, active
// page/quiz, lock/completion status) is owned by the caller.
export function ReaderShell({
  course,
  learningPct,
  expandedModuleIds,
  onToggleModule,
  isModuleLocked,
  isPageComplete,
  isModulePagesComplete,
  isModuleQuizPassed,
  activeKind, // 'page' | 'quiz'
  activePageId,
  activeModuleId,
  onSelectPage,
  onSelectQuiz,
  allModulesDone,
  children,
}) {
  const { theme, toggleTheme } = useTheme()
  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches)

  // Per-course accent (16-theming) as a scoped CSS custom property — the
  // reader shell can lean on --course-accent wherever it wants a
  // course-branded touch, without a full CSS rewrite. `course.color`
  // already exists on CourseSummary (== theme.accent, see
  // repositories/course_repository.py); falls back to the app's own
  // --accent (see hooks/useAccentColor.js) if a course has no theme yet.
  const courseThemeStyle = course.color ? { '--course-accent': course.color } : undefined

  return (
    <div className="reader-shell" style={courseThemeStyle}>
      <header className="reader-topbar">
        <Link to="/courses" className="reader-back-link">
          <ChevronLeft size={16} /> All courses
        </Link>
        <span className="reader-topbar-title">{course.title}</span>
        <span className="reader-topbar-progress">{learningPct}% complete</span>
        {allModulesDone && course.finalExam && (
          <Link
            to={`/courses/${course.slug}/exam`}
            className="reader-topbar-exam-cta"
          >
            <GraduationCap size={15} aria-hidden="true" /> Final exam
          </Link>
        )}
        <button
          type="button"
          className="reader-theme-toggle"
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={toggleTheme}
        >
          {isDark ? <Sun aria-hidden="true" size={17} /> : <Moon aria-hidden="true" size={17} />}
        </button>
      </header>

      <div className="reader-body">
        <nav className="reader-sidebar" aria-label="Course contents">
          {course.modules.map((courseModule, moduleIndex) => {
            const locked = isModuleLocked(moduleIndex)
            const expanded = expandedModuleIds.has(courseModule.id)
            const pagesComplete = isModulePagesComplete(courseModule)
            const quizPassed = courseModule.quiz ? isModuleQuizPassed(courseModule.id) : true
            const moduleDone = pagesComplete && quizPassed

            return (
              <div key={courseModule.id} className="reader-module">
                <button
                  type="button"
                  className={`reader-module-header ${locked ? 'reader-module-header-locked' : ''}`}
                  onClick={() => !locked && onToggleModule(courseModule.id)}
                  disabled={locked}
                >
                  {expanded && !locked ? (
                    <ChevronDown size={14} className="reader-module-chevron" />
                  ) : (
                    <ChevronRight size={14} className="reader-module-chevron" />
                  )}
                  <span className="reader-module-title">{courseModule.title}</span>
                  {locked ? (
                    <Lock size={14} className="reader-module-status" />
                  ) : moduleDone ? (
                    <CheckCircle2 size={14} className="reader-module-status reader-module-status-done" />
                  ) : null}
                </button>

                {expanded && !locked && (
                  <div className="reader-module-body">
                    {courseModule.chapters.map((chapter) => (
                      <div key={chapter.id} className="reader-chapter">
                        <span className="reader-chapter-title">{chapter.title}</span>
                        <ul className="reader-page-list">
                          {chapter.pages.map((p) => {
                            const done = isPageComplete(p.id)
                            const active = activeKind === 'page' && activePageId === p.id
                            return (
                              <li key={p.id}>
                                <button
                                  type="button"
                                  className={`reader-page-item ${active ? 'reader-page-item-active' : ''}`}
                                  onClick={() => onSelectPage(p.id)}
                                >
                                  {done ? (
                                    <CheckCircle2 size={14} className="reader-page-icon reader-page-icon-done" />
                                  ) : (
                                    <Circle size={14} className="reader-page-icon" />
                                  )}
                                  {p.title}
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    ))}

                    {courseModule.quiz && (
                      <button
                        type="button"
                        className={`reader-quiz-item ${
                          activeKind === 'quiz' && activeModuleId === courseModule.id
                            ? 'reader-page-item-active'
                            : ''
                        } ${!pagesComplete ? 'reader-quiz-item-locked' : ''}`}
                        disabled={!pagesComplete}
                        onClick={() => onSelectQuiz(courseModule.id)}
                        title={!pagesComplete ? 'Read every page in this module first' : undefined}
                      >
                        {!pagesComplete ? (
                          <Lock size={14} className="reader-page-icon" />
                        ) : quizPassed ? (
                          <CheckCircle2 size={14} className="reader-page-icon reader-page-icon-done" />
                        ) : (
                          <HelpCircle size={14} className="reader-page-icon" />
                        )}
                        Module QCM
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <main className="reader-content">{children}</main>
      </div>
    </div>
  )
}
