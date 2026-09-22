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

  // Phase B — account management (see backend routers/auth.py)
  changePassword: (currentPassword, newPassword) =>
    apiClient.post('/auth/password/change', {
      current_password: currentPassword,
      new_password: newPassword,
    }),
  forgotPassword: (email) => apiClient.post('/auth/password/forgot', { email }),
  resetPassword: (token, newPassword) =>
    apiClient.post('/auth/password/reset', { token, new_password: newPassword }),
  sendVerificationEmail: () => apiClient.post('/auth/email/verification/send'),
  verifyEmail: (token) => apiClient.post('/auth/email/verify', { token }),
}
