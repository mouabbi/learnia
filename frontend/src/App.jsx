import { Route, Routes } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthContext'
import { RouteLogger } from './components/RouteLogger'
import { BackendGate } from './features/health/BackendGate'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { PublicOnlyRoute } from './features/auth/PublicOnlyRoute'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { VerifyEmailPage } from './pages/VerifyEmailPage'

// App.jsx stays thin: routing + the AuthProvider wrapping everything so
// useAuth() works anywhere in the tree. Actual content lives in pages/ and features/.
function App() {
  return (
    <BackendGate>
      <AuthProvider>
        <RouteLogger />
        <Routes>
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicOnlyRoute>
                <RegisterPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />
          {/* Reachable whether logged in or out: a just-registered user is
              logged in but still needs /verify-email; forgot/reset password
              must work for a logged-out user. */}
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
        </Routes>
      </AuthProvider>
    </BackendGate>
  )
}

export default App
