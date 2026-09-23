import { apiClient } from '../../api/client'

// Real backend — see backend/src/learnia_backend/routers/search.py.
// Thin wrapper following features/courses/coursesApi.js's pattern.
export const searchApi = {
  // Returns { results: [{ type, id, title, snippet, courseId, courseSlug }] }.
  search: (query) => apiClient.get(`/search?q=${encodeURIComponent(query)}`),
}
