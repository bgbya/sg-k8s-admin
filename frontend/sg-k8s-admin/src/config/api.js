export const API_BASE_URL = 'http://localhost:30080'

export const API_ENDPOINTS = {
  namespaces: `${API_BASE_URL}/api/namespaces`,
  pods: `${API_BASE_URL}/api/pods`,
  deployments: `${API_BASE_URL}/api/deployments`,
  statefulsets: `${API_BASE_URL}/api/statefulsets`
} 