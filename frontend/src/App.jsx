import { Route, Routes } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthContext'
import { RouteLogger } from './components/RouteLogger'
import { BackendGate } from './features/health/BackendGate'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { PublicOnlyRoute } from './features/auth/PublicOnlyRoute'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'

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
        </Routes>
      </AuthProvider>
    </BackendGate>
  )
}

export default App
