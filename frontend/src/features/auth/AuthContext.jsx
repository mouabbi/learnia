import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { authApi } from './authApi'
import { createLogger } from '../../utils/logger'

const log = createLogger('auth')

const AuthContext = createContext(null)

/**
 * App-wide auth state, per 02-architecture's "frontend: auth state
 * available app-wide" requirement. Wraps the whole app once (see App.jsx)
 * so any component can call useAuth() instead of each page fetching /me
 * and managing its own "am I logged in" state independently.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // Distinguishes "haven't checked yet" from "checked, not logged in" —
  // without this, a protected route would flash a redirect-to-login
  // before the initial GET /auth/me call even resolves.
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    authApi
      .getMe()
      .then((me) => {
        log.info('session check: logged in', { userId: me.id })
        setUser(me)
      })
      .catch(() => {
        log.info('session check: not logged in')
        setUser(null)
      })
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(async (email, password) => {
    try {
      const loggedInUser = await authApi.loginPassword(email, password)
      log.info('login ok', { userId: loggedInUser.id })
      setUser(loggedInUser)
      return loggedInUser
    } catch (error) {
      log.warn('login failed', { reason: error.code ?? error.message })
      throw error
    }
  }, [])

  const register = useCallback(async (email, password) => {
    try {
      const newUser = await authApi.register(email, password)
      log.info('register ok', { userId: newUser.id })
      setUser(newUser) // backend logs the user in immediately on register
      return newUser
    } catch (error) {
      log.warn('register failed', { reason: error.code ?? error.message })
      throw error
    }
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout()
    log.info('logout ok')
    setUser(null)
  }, [])

  const value = { user, isLoading, isAuthenticated: user !== null, login, register, logout }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === null) {
    throw new Error('useAuth() must be used inside an <AuthProvider>')
  }
  return context
}
