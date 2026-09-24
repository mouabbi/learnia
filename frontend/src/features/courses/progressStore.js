import { apiClient } from '../../api/client'

// Real backend — see backend/src/learnia_backend/routers/courses.py's
// progress endpoints. Was localStorage; now every mutation is a request
// against /courses/{courseId}/progress/*, and each one returns the full
// updated progress record.
export function getCourseProgress(courseId) {
  return apiClient.get(`/courses/${courseId}/progress`)
}

export function setLastPage(courseId, pageId) {
  return apiClient.post(`/courses/${courseId}/progress/last-page`, { pageId })
}

export function markPageComplete(courseId, pageId) {
  return apiClient.post(`/courses/${courseId}/progress/complete-page`, { pageId })
}

// Backend keeps the best-scoring attempt but always bumps lastAttemptAt —
// see progress_repository.py. Returns just this module's attempt (not the
// whole progress record) to match the old localStorage-backed return shape.
export function recordModuleQuizAttempt(courseId, moduleId, { score, total }) {
  return apiClient
    .post(`/courses/${courseId}/progress/module-quiz`, { moduleId, score, total })
    .then((progress) => progress.moduleQuizzes[moduleId])
}

export function recordFinalExamAttempt(courseId, { score, total }) {
  return apiClient
    .post(`/courses/${courseId}/progress/final-exam`, { score, total })
    .then((progress) => progress.finalExam)
}

// Dismisses the "this course was updated" badge/banner (progress.hasUnseenUpdate)
// for this learner — called once they've seen the reader for a course
// flagged as changed. See backend routers/courses.py's mark-content-seen.
export function markContentSeen(courseId) {
  return apiClient.post(`/courses/${courseId}/progress/mark-content-seen`)
}
