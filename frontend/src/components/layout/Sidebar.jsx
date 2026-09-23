import { AnimatePresence, motion } from 'motion/react'
import { NavLink } from 'react-router-dom'
import { Home, BookOpen, Settings, LogOut, PanelLeftClose, PanelLeftOpen, LayoutGrid, ShieldCheck } from 'lucide-react'

// Off-canvas nav drawer used by AppLayout. Pure presentational component —
// open/close state and the close callback are owned by the caller so this
// stays easy to test without touching routing. Slide/fade handled by
// motion (see AnimatePresence) instead of a CSS transform transition, so
// the drawer unmounts (not just hides) when closed.
//
// `pinned` renders the same nav as a static, always-visible column (no
// overlay, no slide animation, no close button) — used by AppLayout for
// the persistent desktop sidebar, hidden below the desktop breakpoint via
// CSS (see .sidebar-pinned in index.css).
export function Sidebar({
  email,
  isAdmin = false,
  isOpen,
  onClose,
  onLogout,
  pinned = false,
  collapsed = false,
  onToggleCollapse,
}) {
  const displayName = email.split('@')[0]

  const links = (
    <>
      {pinned && onToggleCollapse && (
        <button
          type="button"
          className="sidebar-collapse-toggle"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden="true" size={18} />
          ) : (
            <PanelLeftClose aria-hidden="true" size={18} />
          )}
        </button>
      )}

      <div className="sidebar-user">
        <span className="sidebar-avatar" aria-hidden="true">
          {displayName.charAt(0).toUpperCase()}
        </span>
        {!collapsed && (
          <div>
            <p className="sidebar-name">
              {displayName}
              {isAdmin && (
                <span className="sidebar-admin-badge" title="Admin account">
                  <ShieldCheck aria-hidden="true" size={11} /> Admin
                </span>
              )}
            </p>
            <p className="sidebar-email">{email}</p>
          </div>
        )}
      </div>

      <ul className="sidebar-links">
        <li>
          <NavLink to="/" end onClick={onClose} title="Home">
            <Home aria-hidden="true" size={18} />
            {!collapsed && <span>Home</span>}
          </NavLink>
        </li>
        <li>
          <NavLink to="/courses" onClick={onClose} title="Courses">
            <BookOpen aria-hidden="true" size={18} />
            {!collapsed && <span>Courses</span>}
          </NavLink>
        </li>
        {isAdmin && (
          <li>
            {/* Genuinely separate app, not a route in this SPA — opens in
                its own tab with its own shell (see pages/CmsHomePage.jsx),
                same way the course reader opens (see CourseCard.jsx). */}
            <a href="/cms" target="_blank" rel="noopener noreferrer" title="CMS workspace" className="sidebar-link-cms">
              <LayoutGrid aria-hidden="true" size={18} />
              {!collapsed && <span>CMS workspace</span>}
            </a>
          </li>
        )}
        <li>
          <NavLink to="/account" onClick={onClose} title="Settings">
            <Settings aria-hidden="true" size={18} />
            {!collapsed && <span>Settings</span>}
          </NavLink>
        </li>
      </ul>

      <button type="button" className="sidebar-logout" onClick={onLogout} title="Log out">
        <LogOut aria-hidden="true" size={18} />
        {!collapsed && <span>Log out</span>}
      </button>
    </>
  )

  if (pinned) {
    return (
      <nav
        className={`sidebar sidebar-static${collapsed ? ' sidebar-collapsed' : ''}`}
        aria-label="Main menu"
      >
        {links}
      </nav>
    )
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="sidebar-overlay"
            onClick={onClose}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          />

          <motion.nav
            className="sidebar"
            aria-label="Main menu"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'tween', duration: 0.2, ease: 'easeOut' }}
          >
            {links}
          </motion.nav>
        </>
      )}
    </AnimatePresence>
  )
}
