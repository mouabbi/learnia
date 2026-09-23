import { apiClient } from '../../api/client'

// Real backend — see backend/src/learnia_backend/routers/assets.py.
// Each asset the API returns already has a `url` field (resolved server
// side, see schemas/assets.py) — never build asset URLs on this side.
export const assetsApi = {
  listAssets: (courseId) => apiClient.get(`/courses/${courseId}/assets`),
  uploadAsset: (courseId, file) => {
    const formData = new FormData()
    formData.append('file', file)
    return apiClient.postForm(`/courses/${courseId}/assets`, formData)
  },
  deleteAsset: (assetId) => apiClient.delete(`/courses/assets/${assetId}`),
}
