import axios from 'axios'
import {
  cacheVillages,
  getCachedVillages,
  cacheSafeZones,
  getCachedSafeZones,
  cacheSOSReports,
  getCachedSOSReports,
  addCachedSOSReport,
  cacheGroundReality,
  getCachedGroundReality,
  cacheOperationalPriority,
  getCachedOperationalPriority,
  cacheOfflineManifest,
} from './offlineCache'
import type {
  AdvisoryItem,
  AdvisoryResponse,
  AuthUser,
  BacktestResponse,
  GroundRealityResult,
  LearningState,
  OperationalPriorityItem,
  RecommendationResult,
  RiskSummary,
  SafeZoneResult,
  ScenarioAdjustments,
  ScenarioResult,
  SOSReport,
  SOSStats,
  SOSLatestItem,
  TokenResponse,
  VillageResult,
  Role,
} from '../types'

// Backend proxy target (Vite dev server proxies /api and /ws automatically).
// Override with VITE_API_URL env var for production.
const API_BASE_URL = import.meta.env.VITE_API_URL || ''

export const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
})

// Inject the auth token into every request
client.interceptors.request.use((config) => {
  if (typeof window === 'undefined') return config
  const token = window.localStorage.getItem('safezone_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 (authority sessions only; public calls do not send tokens)
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      window.localStorage.removeItem('safezone_token')
      window.localStorage.removeItem('safezone_user')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

// ---- Helper: try network, fall back to cache ----
async function fetchWithFallback<T extends unknown[]>(
  fetchFn: () => Promise<T>,
  cacheFn?: (data: T) => Promise<void>,
  cacheGetFn?: () => Promise<T>
): Promise<T> {
  try {
    const data = await fetchFn()
    if (cacheFn && data) {
      await cacheFn(data).catch(() => {})
    }
    return data
  } catch (err) {
    if (cacheGetFn) {
      const cached = await cacheGetFn().catch(() => undefined)
      if (cached && cached.length > 0) {
        return cached
      }
    }
    throw err
  }
}

// ---- Auth (authority accounts) ----
export async function registerUser(name: string, email: string, password: string, role: Role, department = '', pin = ''): Promise<TokenResponse> {
  const { data } = await client.post<TokenResponse>('/api/auth/register', { name, email, password, role, department, pin })
  return data
}

export async function loginUser(email: string, password: string): Promise<TokenResponse> {
  const { data } = await client.post<TokenResponse>('/api/auth/login', { email, password })
  return data
}

export async function pinLogin(email: string, pin: string): Promise<TokenResponse> {
  const { data } = await client.post<TokenResponse>('/api/auth/pin-login', { email, pin })
  return data
}

export async function getMe(): Promise<AuthUser> {
  const { data } = await client.get<AuthUser>('/api/auth/me')
  return data
}

export async function fetchUsers(): Promise<AuthUser[]> {
  const { data } = await client.get<AuthUser[]>('/api/auth/users')
  return data
}

// ---- Core (with offline fallback) ----
export async function checkHealth(): Promise<{ status: string; mode?: string }> {
  const { data } = await client.get<{ status: string; mode?: string }>('/api/health')
  return data
}

export async function fetchVillages(): Promise<VillageResult[]> {
  return fetchWithFallback(
    async () => {
      const { data } = await client.get<VillageResult[]>('/api/villages')
      return data
    },
    (data) => cacheVillages(data),
    () => getCachedVillages()
  )
}

export async function fetchVillage(id: string): Promise<VillageResult> {
  const { data } = await client.get<VillageResult>(`/api/villages/${id}`)
  return data
}

export async function fetchSafeZones(): Promise<SafeZoneResult[]> {
  return fetchWithFallback(
    async () => {
      const { data } = await client.get<SafeZoneResult[]>('/api/safe-zones')
      return data
    },
    (data) => cacheSafeZones(data),
    () => getCachedSafeZones()
  )
}

export async function fetchRiskSummary(): Promise<RiskSummary> {
  const { data } = await client.get<RiskSummary>('/api/risk-summary')
  return data
}

export async function fetchRelocationPriority(): Promise<VillageResult[]> {
  const { data } = await client.get<VillageResult[]>('/api/relocation-priority')
  return data
}

export async function fetchRecommendation(villageId: string): Promise<RecommendationResult> {
  const { data } = await client.get<RecommendationResult>(`/api/recommendation/${villageId}`)
  return data
}

export async function runScenario(adjustments: ScenarioAdjustments): Promise<ScenarioResult> {
  const { data } = await client.post<ScenarioResult>('/api/scenario', adjustments)
  return data
}

// ---- Advisory (machine proposes, authority decides) ----
export async function fetchAdvisory(): Promise<AdvisoryResponse> {
  const { data } = await client.get<AdvisoryResponse>('/api/advisory')
  return data
}

export async function fetchVillageAdvisory(villageId: string): Promise<AdvisoryItem> {
  const { data } = await client.get<AdvisoryItem>(`/api/advisory/${villageId}`)
  return data
}

// ---- Learning engine status ----
export async function fetchLearningState(): Promise<LearningState> {
  const { data } = await client.get<LearningState>('/api/learning')
  return data
}

// ---- SOS ----
export async function submitSOS(report: {
  reporter_name: string
  reporter_phone?: string
  village_id: string
  village_name: string
  emergency_type: string
  severity: number
  description: string
  people_affected: number
  medical_emergency: boolean
  medical_details?: string
  latitude: number
  longitude: number
}): Promise<SOSReport> {
  try {
    const { data } = await client.post<SOSReport>('/api/sos/submit', report)
    return data
  } catch (err) {
    // Offline: store locally for later sync from the service worker
    if (!navigator.onLine) {
      const localReport: SOSReport = {
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

export async function fetchSOSReports(filters: { village_id?: string; status?: string } = {}): Promise<SOSReport[]> {
  return fetchWithFallback(
    async () => {
      const params = new URLSearchParams()
      if (filters.village_id) params.set('village_id', filters.village_id)
      if (filters.status) params.set('status', filters.status)
      const { data } = await client.get<SOSReport[]>(`/api/sos/reports?${params}`)
      return data
    },
    (data) => cacheSOSReports(data),
    () => getCachedSOSReports()
  )
}

export async function updateSOSReport(reportId: string, body: { status: string }): Promise<SOSReport> {
  const { data } = await client.patch<SOSReport>(`/api/sos/reports/${reportId}`, body)
  return data
}

export async function adjudicateSOS(
  reportId: string,
  body: { actual_people_affected: number; actual_severity: number; outcome: string; note?: string }
): Promise<{ report_id: string; status: string; recorded: boolean; learning_update?: unknown }> {
  const { data } = await client.post('/api/sos/adjudicate', { report_id: reportId, ...body })
  return data
}

export async function fetchSOSLatest(): Promise<SOSLatestItem[]> {
  const { data } = await client.get<SOSLatestItem[]>('/api/sos/latest')
  return data
}

export async function fetchSOSPriorityQueue(): Promise<SOSReport[]> {
  const { data } = await client.get<SOSReport[]>('/api/sos/priority-queue')
  return data
}

export async function fetchSOSStats(): Promise<SOSStats> {
  const { data } = await client.get<SOSStats>('/api/sos/stats')
  return data
}

export async function fetchSOSAggregate(): Promise<Record<string, unknown>> {
  const { data } = await client.get('/api/sos/aggregate')
  return data
}

// ---- Validation: real-data ingestion + backtest ----
export async function fetchRedZones(): Promise<{ source_note: string; villages: VillageResult[] }> {
  const { data } = await client.get('/api/validation/red-zones')
  return data
}

export async function fetchBacktest(): Promise<BacktestResponse> {
  const { data } = await client.get<BacktestResponse>('/api/validation/backtest')
  return data
}

export async function registerValidationEvent(event: {
  id: string
  village_id?: string
  location_name: string
  hazard_type: string
  date: string
  observed_severity: number
  magnitude?: string
  source?: string
  note?: string
}): Promise<{ id: string; registered: boolean }> {
  const { data } = await client.post('/api/validation/register-event', event)
  return data
}

export async function fetchEvents(): Promise<Record<string, unknown>[]> {
  const { data } = await client.get('/api/events')
  return data
}

// ---- Ground Reality (with offline fallback) ----
export async function fetchGroundReality(): Promise<GroundRealityResult[]> {
  return fetchWithFallback(
    async () => {
      const { data } = await client.get<GroundRealityResult[]>('/api/ground-reality')
      return data
    },
    (data) => cacheGroundReality(data),
    () => getCachedGroundReality()
  )
}

export async function fetchVillageGroundReality(villageId: string): Promise<GroundRealityResult> {
  const { data } = await client.get<GroundRealityResult>(`/api/ground-reality/${villageId}`)
  return data
}

export async function fetchOperationalPriority(): Promise<OperationalPriorityItem[]> {
  return fetchWithFallback(
    async () => {
      const { data } = await client.get<OperationalPriorityItem[]>('/api/operational-priority')
      return data
    },
    (data) => cacheOperationalPriority(data),
    () => getCachedOperationalPriority()
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
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

export default client