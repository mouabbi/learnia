import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { createLogger } from '../../utils/logger'

const log = createLogger('route')

/**
 * Opposite of ProtectedRoute: for pages that only make sense when logged OUT
 * (login, register). A logged-in user who opens them is sent to the home page.
 *   <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
 */
export function PublicOnlyRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading && isAuthenticated) log.info('PublicOnlyRoute: already logged in -> /')
  }, [isLoading, isAuthenticated])

  // Wait for the initial GET /auth/me before deciding (same reason as ProtectedRoute).
  if (isLoading) return null

  if (isAuthenticated) return <Navigate to="/" replace />

  return children
}
