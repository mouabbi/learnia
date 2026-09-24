import { apiClient } from '../../api/client'

// Real backend — see backend/src/learnia_backend/routers/dashboard.py.
// One aggregation call: { continueLearning, courses, recommendations, stats }.
export const dashboardApi = {
  getDashboard: () => apiClient.get('/dashboard'),
}
