import { Navigate } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from './AuthContext'
import '../cms/cms.css'

// Gates the CMS routes (see App.jsx): logged out -> straight to /login like
// any ProtectedRoute; logged in but not an admin -> a "wrong account"
// prompt instead of silently redirecting, since that's a signed-in user
// hitting a real permission wall, not someone who forgot to log in.
export function AdminRoute({ children }) {
  const { isAuthenticated, isLoading, user, logout } = useAuth()

  if (isLoading) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!user.is_admin) return <AdminRequired onSwitchAccount={logout} />

  return children
}

function AdminRequired({ onSwitchAccount }) {
  return (
    <div className="admin-gate">
      <div className="admin-gate-panel">
        <span className="admin-gate-icon">
          <ShieldAlert size={28} aria-hidden="true" />
        </span>
        <h1>Admin access required</h1>
        <p>The content workspace is only available to admin accounts. You're signed in as a regular user.</p>
        <button type="button" className="cms-btn-primary" onClick={onSwitchAccount}>
          Switch account
        </button>
      </div>
    </div>
  )
}
