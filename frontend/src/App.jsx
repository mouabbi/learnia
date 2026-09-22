import { Route, Routes } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthContext'
import { RouteLogger } from './components/RouteLogger'
import { AppLayout } from './components/layout/AppLayout'
import { BackendGate } from './features/health/BackendGate'
import { useAccentColor } from './hooks/useAccentColor'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { PublicOnlyRoute } from './features/auth/PublicOnlyRoute'
import { AccountPage } from './pages/AccountPage'
import { HomePage } from './pages/HomePage'
import { CoursesPage } from './pages/CoursesPage'
import { CourseReaderPage } from './pages/CourseReaderPage'
import { ExamPage } from './features/exam/ExamPage'
import { LoginPage } from './pages/LoginPage'
import { MfaChallengePage } from './pages/MfaChallengePage'
import { RegisterPage } from './pages/RegisterPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { VerifyEmailPage } from './pages/VerifyEmailPage'

// App.jsx stays thin: routing + the AuthProvider wrapping everything so
// useAuth() works anywhere in the tree. Actual content lives in pages/ and features/.
function App() {
  // Applies the user's persisted accent color (see hooks/useAccentColor.js)
  // on every page, not just Settings where it's actually changed.
  useAccentColor()

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
          {/* Not wrapped in PublicOnlyRoute: mid-login, the user has proven
              their password but useAuth() isn't authenticated yet (no
              session cookie exists until the MFA step succeeds). */}
          <Route path="/mfa-challenge" element={<MfaChallengePage />} />
          {/* Every authenticated page shares one shell (topbar + slide-in
              sidebar) — see components/layout/AppLayout.jsx. Gated by a
              single ProtectedRoute here instead of per-page. */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<HomePage />} />
            <Route path="/courses" element={<CoursesPage />} />
            <Route path="/account" element={<AccountPage />} />
          </Route>
          {/* The course reader and the final exam are deliberately outside
              AppLayout — no topbar/sidebar chrome, each with its own
              dedicated shell (docs-style reader, full-screen exam room).
              Course cards open the reader in a new browser tab (see
              CourseCard.jsx). Still gated by ProtectedRoute. */}
          <Route
            path="/courses/:slug/learn"
            element={
              <ProtectedRoute>
                <CourseReaderPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/courses/:slug/exam"
            element={
              <ProtectedRoute>
                <ExamPage />
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
