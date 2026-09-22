import { useState } from 'react'
import { Menu } from 'lucide-react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useAuth } from '../../features/auth/AuthContext'

// Shell for every authenticated page (see App.jsx): a topbar with a menu
// button, the slide-in Sidebar it controls, and the routed page content.
// Only mounted inside <ProtectedRoute>, so `user` is always set here.
export function AppLayout() {
  const { user, logout } = useAuth()
  const [isSidebarOpen, setSidebarOpen] = useState(false)

  async function handleLogout() {
    setSidebarOpen(false)
    await logout()
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          type="button"
          className="menu-button"
          aria-label="Open menu"
          aria-expanded={isSidebarOpen}
          onClick={() => setSidebarOpen(true)}
        >
          <Menu aria-hidden="true" size={20} />
        </button>
        <span className="topbar-title">Learnia</span>
      </header>

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
