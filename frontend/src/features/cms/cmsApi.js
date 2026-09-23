import { apiClient } from '../../api/client'

// Thin wrapper over apiClient for every CMS-only endpoint (structure CRUD,
// page content, questions, prompt-builder, import/validate/commit) — same
// pattern as features/courses/coursesApi.js. No caching/state here, that's
// the CMS components' job.
export const cmsApi = {
  // -- structure (06-course-structure, already-existing backend) ---------
  createModule: (courseId, title) => apiClient.post(`/courses/${courseId}/modules`, { title }),
  renameModule: (moduleId, title) => apiClient.patch(`/courses/modules/${moduleId}`, { title }),
  deleteModule: (moduleId) => apiClient.delete(`/courses/modules/${moduleId}`),
  reorderModules: (courseId, orderedIds) =>
    apiClient.post(`/courses/${courseId}/modules/reorder`, { orderedIds }),

  createChapter: (moduleId, title) =>
    apiClient.post(`/courses/modules/${moduleId}/chapters`, { title }),
  renameChapter: (chapterId, title) =>
    apiClient.patch(`/courses/chapters/${chapterId}`, { title }),
  deleteChapter: (chapterId) => apiClient.delete(`/courses/chapters/${chapterId}`),
  moveChapter: (chapterId, moduleId) =>
    apiClient.post(`/courses/chapters/${chapterId}/move`, { moduleId }),
  reorderChapters: (moduleId, orderedIds) =>
    apiClient.post(`/courses/modules/${moduleId}/chapters/reorder`, { orderedIds }),

  createPage: (chapterId, title) => apiClient.post(`/courses/chapters/${chapterId}/pages`, { title }),
  renamePage: (pageId, title) => apiClient.patch(`/courses/pages/${pageId}`, { title }),
  deletePage: (pageId) => apiClient.delete(`/courses/pages/${pageId}`),
  movePage: (pageId, chapterId) => apiClient.post(`/courses/pages/${pageId}/move`, { chapterId }),
  reorderPages: (chapterId, orderedIds) =>
    apiClient.post(`/courses/chapters/${chapterId}/pages/reorder`, { orderedIds }),

  // -- page content (07-content-system) -----------------------------------
  getPageContent: (pageId) => apiClient.get(`/courses/pages/${pageId}/content`),
  putPageContent: (pageId, content) => apiClient.put(`/courses/pages/${pageId}/content`, content),

  // -- questions (09/10) ----------------------------------------------------
  listModuleQuestions: (moduleId) => apiClient.get(`/courses/modules/${moduleId}/questions`),
  createModuleQuestion: (moduleId, body) =>
    apiClient.post(`/courses/modules/${moduleId}/questions`, body),
  listFinalExamQuestions: (courseId) => apiClient.get(`/courses/${courseId}/final-exam/questions`),
  createFinalExamQuestion: (courseId, body) =>
    apiClient.post(`/courses/${courseId}/final-exam/questions`, body),
  updateQuestion: (questionId, body) => apiClient.patch(`/courses/questions/${questionId}`, body),
  deleteQuestion: (questionId) => apiClient.delete(`/courses/questions/${questionId}`),

  // -- AI prompt builder (12) ----------------------------------------------
  // scope: course|module|chapter|page|module-qcm|final-exam
  getPrompt: (courseId, scope, { moduleId, chapterId } = {}) => {
    const params = new URLSearchParams()
    if (moduleId != null) params.set('moduleId', moduleId)
    if (chapterId != null) params.set('chapterId', chapterId)
    const qs = params.toString()
    return apiClient.get(`/courses/${courseId}/prompts/${scope}${qs ? `?${qs}` : ''}`)
  },

  // -- AI import/validate/commit (13) --------------------------------------
  validateImport: (courseId, scope, json) =>
    apiClient.post(`/courses/${courseId}/import/${scope}/validate`, { json }),
  commitImport: (courseId, scope, json, { replace, moduleId, chapterId, pageId } = {}) => {
    const params = new URLSearchParams()
    if (moduleId != null) params.set('moduleId', moduleId)
    if (chapterId != null) params.set('chapterId', chapterId)
    if (pageId != null) params.set('pageId', pageId)
    const qs = params.toString()
    return apiClient.post(
      `/courses/${courseId}/import/${scope}/commit${qs ? `?${qs}` : ''}`,
      { json, replace: !!replace },
    )
  },

  // -- course metadata (basic settings tab; theme handled by ThemeEditor) --
  getCourse: (slug) => apiClient.get(`/courses/${slug}`),

  // -- admin course lifecycle (create/list-all/publish/archive/delete) ----
  listAllCourses: () => apiClient.get('/cms/courses'),
  createCourse: (body) => apiClient.post('/cms/courses', body),
  updateCourse: (courseId, body) => apiClient.patch(`/cms/courses/${courseId}`, body),
  deleteCourse: (courseId) => apiClient.delete(`/cms/courses/${courseId}`),
}
