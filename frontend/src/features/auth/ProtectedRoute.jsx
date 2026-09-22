import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { createLogger } from '../../utils/logger'

const log = createLogger('route')

/**
 * Wrap any route element that requires a logged-in user:
 *   <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
 */
export function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth()

  // Logged from an effect (not the render body) so it prints once per decision,
  // not on every re-render.
  useEffect(() => {
    if (!isLoading && !isAuthenticated) log.info('ProtectedRoute: not logged in -> /login')
  }, [isLoading, isAuthenticated])

  // Wait for the initial GET /auth/me to resolve before deciding — see
  // AuthContext's isLoading comment for why this check exists.
  if (isLoading) return null

  if (!isAuthenticated) return <Navigate to="/login" replace />

  return children
}
