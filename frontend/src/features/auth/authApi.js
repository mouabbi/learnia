import { apiClient } from '../../api/client'

// Each function mirrors one backend endpoint 1:1 — see
// backend/src/learnia_backend/routers/auth.py. Cookies (the session) are
// sent automatically by the browser on same-origin requests; nothing here
// handles the session token directly, the browser does.
export const authApi = {
  register: (email, password) => apiClient.post('/auth/register', { email, password }),
  // Returns { mfa_required, user, mfa_ticket } — see AuthContext.login()
  // for how the two shapes (plain login vs. "go do the MFA step") are handled.
  loginPassword: (email, password) => apiClient.post('/auth/login/password', { email, password }),
  loginMfa: (mfaTicket, code) =>
    apiClient.post('/auth/login/mfa', { mfa_ticket: mfaTicket, code }),
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

  // Phase C — MFA (TOTP), all logged-in-only except loginMfa above
  getMfaStatus: () => apiClient.get('/auth/mfa/status'),
  startMfaEnrollment: () => apiClient.post('/auth/mfa/enroll'),
  confirmMfaEnrollment: (code) => apiClient.post('/auth/mfa/enroll/confirm', { code }),
  disableMfa: (currentPassword) =>
    apiClient.post('/auth/mfa/disable', { current_password: currentPassword }),
}
