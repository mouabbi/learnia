import { AnimatePresence, motion } from 'motion/react'
import { NavLink } from 'react-router-dom'

// Off-canvas nav drawer used by AppLayout. Pure presentational component —
// open/close state and the close callback are owned by the caller so this
// stays easy to test without touching routing. Slide/fade handled by
// motion (see AnimatePresence) instead of a CSS transform transition, so
// the drawer unmounts (not just hides) when closed.
export function Sidebar({ email, isOpen, onClose, onLogout }) {
  const displayName = email.split('@')[0]

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
            <div className="sidebar-user">
              <span className="sidebar-avatar" aria-hidden="true">
                {displayName.charAt(0).toUpperCase()}
              </span>
              <div>
                <p className="sidebar-name">{displayName}</p>
                <p className="sidebar-email">{email}</p>
              </div>
            </div>

            <ul className="sidebar-links">
              <li>
                <NavLink to="/" end onClick={onClose}>
                  Home
                </NavLink>
              </li>
              <li>
                <NavLink to="/account" onClick={onClose}>
                  Settings
                </NavLink>
              </li>
            </ul>

            <motion.button
              type="button"
              className="sidebar-logout"
              onClick={onLogout}
              whileTap={{ scale: 0.96 }}
            >
              Log out
            </motion.button>
          </motion.nav>
        </>
      )}
    </AnimatePresence>
  )
}
