import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

/**
 * Wrap any route element that requires a logged-in user:
 *   <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
 */
export function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth()

  // Wait for the initial GET /auth/me to resolve before deciding — see
  // AuthContext's isLoading comment for why this check exists.
  if (isLoading) return null

  if (!isAuthenticated) return <Navigate to="/login" replace />

  return children
}
