import { useState } from 'react'
import { Menu, Sun, Moon, Sparkles } from 'lucide-react'
import { Link, Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useAuth } from '../../features/auth/AuthContext'
import { useTheme } from '../../hooks/useTheme'
import { useLearnerXp } from '../../features/courses/useLearnerXp'

// Shell for every authenticated page (see App.jsx): a topbar with a menu
// button, the slide-in Sidebar it controls, and the routed page content.
// Only mounted inside <ProtectedRoute>, so `user` is always set here.
// At desktop widths (see .app-shell-desktop in index.css) the sidebar is
// also rendered pinned in a permanent left column; the off-canvas drawer
// keeps working underneath for mobile/tablet widths.
export function AppLayout() {
  const { user, logout } = useAuth()
  const [isSidebarOpen, setSidebarOpen] = useState(false)
  const [isDesktopSidebarOpen, setDesktopSidebarOpen] = useState(true)
  const { theme, toggleTheme } = useTheme()
  const learnerXp = useLearnerXp()
  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches)

  async function handleLogout() {
    setSidebarOpen(false)
    await logout()
  }

  // One trigger, two behaviors: below the desktop breakpoint it opens the
  // off-canvas drawer; at/above it, it collapses/expands the pinned column
  // instead (see .app-shell-collapsed in index.css).
  function toggleSidebar() {
    if (typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1024px)').matches) {
      setDesktopSidebarOpen((open) => !open)
    } else {
      setSidebarOpen(true)
    }
  }

  return (
    <div className={`app-shell ${isDesktopSidebarOpen ? '' : 'app-shell-collapsed'}`}>
      <header className="topbar">
        <button
          type="button"
          className="menu-button"
          aria-label={isDesktopSidebarOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isSidebarOpen || isDesktopSidebarOpen}
          onClick={toggleSidebar}
        >
          <Menu aria-hidden="true" size={20} />
        </button>
        <Link to="/" className="topbar-title">
          Learnia
        </Link>

        <div className="topbar-spacer" />

        {learnerXp && (
          <span className="topbar-xp" title={`${learnerXp.xp} XP total`}>
            <Sparkles size={14} aria-hidden="true" />
            Level {learnerXp.level}
          </span>
        )}

        <button
          type="button"
          className="menu-button theme-toggle"
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={toggleTheme}
        >
          {isDark ? <Sun aria-hidden="true" size={18} /> : <Moon aria-hidden="true" size={18} />}
        </button>
      </header>

      {/* Pinned desktop sidebar — a second render of the same component, no
          overlay/close affordance, collapsible via the topbar menu button
          (see toggleSidebar) or its own in-sidebar toggle. Hidden via CSS
          below the desktop breakpoint, where the drawer instance takes over. */}
      <div className="sidebar-pinned">
        <Sidebar
          email={user.email}
          isOpen
          pinned
          collapsed={!isDesktopSidebarOpen}
          onToggleCollapse={() => setDesktopSidebarOpen((open) => !open)}
          onLogout={handleLogout}
        />
      </div>

      <Sidebar
        email={user.email}
        isOpen={isSidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={handleLogout}
      />

      <main className="app-content">
        <Outlet />
      </main>
    </div>
  )
}
