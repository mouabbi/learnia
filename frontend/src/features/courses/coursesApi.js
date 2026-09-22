import { apiClient } from '../../api/client'

// Real backend — see backend/src/learnia_backend/routers/courses.py.
// Same shape the mock version had (async functions returning plain data),
// so no caller needed to change when this stopped being mock data.
export const coursesApi = {
  listCourses: () => apiClient.get('/courses'),
  getCourse: (slug) => apiClient.get(`/courses/${slug}`),
  // { completedPageIds, lastPageId, moduleQuizzes, finalExam } — created
  // empty on the backend the first time it's requested for a given course.
  getProgress: (courseId) => apiClient.get(`/courses/${courseId}/progress`),
}
