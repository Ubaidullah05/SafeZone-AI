import axios from 'axios'
import {
  cacheVillages, getCachedVillages,
  cacheSafeZones, getCachedSafeZones,
  cacheSOSReports, getCachedSOSReports, addCachedSOSReport,
  cacheMeshData, getCachedMeshData,
  cacheGroundReality, getCachedGroundReality,
  cacheOperationalPriority, getCachedOperationalPriority,
  cacheOfflineManifest,
} from './offlineCache'

// Use relative URLs — Vite proxy forwards /api to backend
// For production: set VITE_API_URL in .env
const API_BASE_URL = import.meta.env.VITE_API_URL || ''

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
})

// Inject auth token into every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('safezone_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 responses
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('safezone_token')
      localStorage.removeItem('safezone_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ---- Helper: try network, fall back to cache ----
async function fetchWithFallback(fetchFn, cacheFn, cacheGetFn) {
  try {
    const data = await fetchFn()
    if (cacheFn && data) {
      await cacheFn(data).catch(() => {})
    }
    return data
  } catch (err) {
    // Try cache
    if (cacheGetFn) {
      const cached = await cacheGetFn().catch(() => null)
      if (cached && cached.length > 0) {
        return cached
      }
    }
    throw err
  }
}

// ---- Auth ----
export async function registerUser(name, email, password, role = 'citizen') {
  const { data } = await client.post('/api/auth/register', { name, email, password, role })
  return data
}

export async function loginUser(email, password) {
  const { data } = await client.post('/api/auth/login', { email, password })
  return data
}

export async function faceLogin(imageData) {
  const { data } = await client.post('/api/auth/face-login', { image_data: imageData || 'demo' })
  return data
}

export async function fingerprintLogin(credentialId) {
  const { data } = await client.post('/api/auth/fingerprint-login', { credential_id: credentialId || 'demo' })
  return data
}

export async function pinLogin(pin) {
  const { data } = await client.post('/api/auth/pin-login', { pin })
  return data
}

export async function getMe() {
  const { data } = await client.get('/api/auth/me')
  return data
}

// ---- Core (with offline fallback) ----
export async function checkHealth() {
  const { data } = await client.get('/api/health')
  return data
}

export async function fetchVillages() {
  return fetchWithFallback(
    async () => {
      const { data } = await client.get('/api/villages')
      return data
    },
    cacheVillages,
    getCachedVillages
  )
}

export async function fetchVillage(id) {
  const { data } = await client.get(`/api/villages/${id}`)
  return data
}

export async function fetchSafeZones() {
  return fetchWithFallback(
    async () => {
      const { data } = await client.get('/api/safe-zones')
      return data
    },
    cacheSafeZones,
    getCachedSafeZones
  )
}

export async function fetchRiskSummary() {
  const { data } = await client.get('/api/risk-summary')
  return data
}

export async function fetchRelocationPriority() {
  const { data } = await client.get('/api/relocation-priority')
  return data
}

export async function fetchRecommendation(villageId) {
  const { data } = await client.get(`/api/recommendation/${villageId}`)
  return data
}

export async function runScenario(adjustments) {
  const { data } = await client.post('/api/scenario', adjustments)
  return data
}

// ---- SOS (with offline queue) ----
export async function submitSOS(report) {
  try {
    const { data } = await client.post('/api/sos/submit', report)
    return data
  } catch (err) {
    // Offline: store locally for later sync
    if (!navigator.onLine) {
      const localReport = {
        ...report,
        id: `LOCAL-${Date.now()}`,
        status: 'PENDING_SYNC',
        priority_score: 50,
        timestamp: new Date().toISOString(),
      }
      await addCachedSOSReport(localReport)
      return localReport
    }
    throw err
  }
}

export async function fetchSOSReports(filters = {}) {
  return fetchWithFallback(
    async () => {
      const params = new URLSearchParams()
      if (filters.village_id) params.set('village_id', filters.village_id)
      if (filters.status) params.set('status', filters.status)
      const { data } = await client.get(`/api/sos/reports?${params}`)
      return data
    },
    cacheSOSReports,
    getCachedSOSReports
  )
}

export async function updateSOSReport(reportId, body) {
  const { data } = await client.patch(`/api/sos/reports/${reportId}`, body)
  return data
}

export async function fetchSOSPriorityQueue() {
  const { data } = await client.get('/api/sos/priority-queue')
  return data
}

export async function fetchSOSStats() {
  const { data } = await client.get('/api/sos/stats')
  return data
}

export async function fetchSOSAggregate() {
  const { data } = await client.get('/api/sos/aggregate')
  return data
}

// ---- Mesh (with offline fallback) ----
export async function fetchMeshNodes() {
  return fetchWithFallback(
    async () => {
      const { data } = await client.get('/api/mesh/nodes')
      return data
    },
    async (data) => {
      // Cache nodes within mesh data
      const existing = await getCachedMeshData()
      await cacheMeshData({ ...existing, nodes: data })
    },
    async () => {
      const cached = await getCachedMeshData()
      return cached?.nodes || []
    }
  )
}

export async function fetchMeshHealth() {
  return fetchWithFallback(
    async () => {
      const { data } = await client.get('/api/mesh/health')
      return data
    },
    async (data) => {
      const existing = await getCachedMeshData()
      await cacheMeshData({ ...existing, health: data })
    },
    async () => {
      const cached = await getCachedMeshData()
      return cached?.health || {}
    }
  )
}

export async function fetchMeshRelayPaths() {
  const { data } = await client.get('/api/mesh/relay-paths')
  return data
}

export async function fetchMeshClusters() {
  const { data } = await client.get('/api/mesh/clusters')
  return data
}

export async function fetchMeshMessages() {
  const { data } = await client.get('/api/mesh/messages')
  return data
}

export async function fetchMeshMapData() {
  const { data } = await client.get('/api/mesh/map-data')
  return data
}

export async function submitMeshSOS(body) {
  const { data } = await client.post('/api/mesh/sos', body)
  return data
}

// ---- Ground Reality (with offline fallback) ----
export async function fetchGroundReality() {
  return fetchWithFallback(
    async () => {
      const { data } = await client.get('/api/ground-reality')
      return data
    },
    cacheGroundReality,
    getCachedGroundReality
  )
}

export async function fetchVillageGroundReality(villageId) {
  const { data } = await client.get(`/api/ground-reality/${villageId}`)
  return data
}

export async function fetchOperationalPriority() {
  return fetchWithFallback(
    async () => {
      const { data } = await client.get('/api/operational-priority')
      return data
    },
    cacheOperationalPriority,
    getCachedOperationalPriority
  )
}

// ---- Offline manifest ----
export async function fetchAndCacheManifest() {
  try {
    const { data } = await client.get('/api/offline-manifest')
    await cacheOfflineManifest(data)
    return data
  } catch (err) {
    console.warn('Failed to fetch offline manifest:', err)
    return null
  }
}

// ---- Online status helper ----
export function isOnline() {
  return navigator.onLine
}

export default client
