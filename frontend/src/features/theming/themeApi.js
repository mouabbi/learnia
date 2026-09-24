import { apiClient } from '../../api/client'

// Real backend — see backend/src/learnia_backend/routers/theme.py.
// Same thin-wrapper pattern as features/courses/coursesApi.js: plain
// async functions returning whatever the backend gives back, no caching
// or state here — that's ThemeEditor's job.
export const themeApi = {
  // -> { theme: CourseTheme, warnings: string[] }
  getTheme: (courseId) => apiClient.get(`/courses/${courseId}/theme`),
  // -> { theme: CourseTheme, warnings: string[] }
  updateTheme: (courseId, theme) => apiClient.patch(`/courses/${courseId}/theme`, theme),
}
