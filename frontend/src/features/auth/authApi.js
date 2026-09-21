import { apiClient } from '../../api/client'

// Each function mirrors one backend endpoint 1:1 — see
// backend/src/learnia_backend/routers/auth.py. Cookies (the session) are
// sent automatically by the browser on same-origin requests; nothing here
// handles the session token directly, the browser does.
export const authApi = {
  register: (email, password) => apiClient.post('/auth/register', { email, password }),
  loginPassword: (email, password) => apiClient.post('/auth/login/password', { email, password }),
  logout: () => apiClient.post('/auth/logout'),
  getMe: () => apiClient.get('/auth/me'),
}
