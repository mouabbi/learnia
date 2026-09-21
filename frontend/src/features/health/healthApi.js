// Feature-specific API calls live next to the feature that uses them,
// but always go through the shared apiClient (see api/client.js).
import { apiClient } from '../../api/client'

export function fetchHealth() {
  return apiClient.get('/health')
}
