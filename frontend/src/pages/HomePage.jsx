import { useAuth } from '../features/auth/AuthContext'

// Protected (see App.jsx's <ProtectedRoute> wrapping this route) — only
// reachable once /auth/me has confirmed a logged-in user.
export function HomePage() {
  const { user, logout } = useAuth()

  return (
    <section className="page">
      <h1>Learnia</h1>
      <p>Logged in as {user.email}</p>
      <button type="button" onClick={logout}>
        Log out
      </button>
    </section>
  )
}
