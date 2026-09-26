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
  cacheRiskSummary,
  getCachedRiskSummary,
  cacheSOSLatest,
  getCachedSOSLatest,
  cacheSOSStats,
  getCachedSOSStats,
  cacheRelocationPriority,
  getCachedRelocationPriority,
  cacheOfflineManifest,
} from './offlineCache'
import { queueSOS, syncSOSQueue, type QueuedSOS } from './offlineQueue'
import type {
  AdvisoryResponse,
  AuthUser,
  BacktestResponse,
  GroundRealityResult,
  LearningState,
  LearningDetail,
  CorpusInfo,
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
  SatcomTerminal,
  SatelliteConstellationStatus,
  SatelliteDownlinkMessage,
  SatelliteTransmitResponse,
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
// Works for both array payloads (villages, reports) and single-object
// payloads (risk summary, stats). An empty array is treated as "no cache";
// a non-null object is always accepted.
async function fetchWithFallback<T>(
  fetchFn: () => Promise<T>,
  cacheFn?: (data: T) => Promise<void>,
  cacheGetFn?: () => Promise<T | undefined>
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
      const hasCache = cached !== undefined && cached !== null && (!Array.isArray(cached) || cached.length > 0)
      if (hasCache) {
        return cached as T
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
  return fetchWithFallback(
    async () => {
      const { data } = await client.get<RiskSummary>('/api/risk-summary')
      return data
    },
    (data) => cacheRiskSummary(data),
    () => getCachedRiskSummary<RiskSummary>()
  )
}

export async function fetchRelocationPriority(): Promise<VillageResult[]> {
  return fetchWithFallback(
    async () => {
      const { data } = await client.get<VillageResult[]>('/api/relocation-priority')
      return data
    },
    (data) => cacheRelocationPriority(data),
    () => getCachedRelocationPriority<VillageResult[]>()
  )
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

// ---- Learning engine status ----

/**
 * Public, safe aggregate. Deliberately excludes the factor weights so the
 * signals driving the risk model are not exposed to the public dashboard.
 */
export async function fetchLearningState(): Promise<LearningState> {
  const { data } = await client.get<LearningState>('/api/learning')
  return data
}

/** Official only: the factor weights, correlations and prior. */
export async function fetchLearningDetail(): Promise<LearningDetail> {
  const { data } = await client.get<LearningDetail>('/api/learning/weights')
  return data
}

/** Official only: what the training corpus contains and how it is labelled. */
export async function fetchCorpusInfo(): Promise<CorpusInfo> {
  const { data } = await client.get<CorpusInfo>('/api/learning/corpus')
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
    // Offline or network error: store locally in queue & cache for auto-sync
    const localId = `LOCAL-${Date.now()}`
    const localReport: SOSReport = {
      ...report,
      id: localId,
      status: 'PENDING_SYNC',
      priority_score: 50,
      timestamp: new Date().toISOString(),
    }
    queueSOS({ ...report, id: localId })
    await addCachedSOSReport(localReport).catch(() => {})
    return localReport
  }
}

export async function syncOfflineQueue(): Promise<{ synced: number; failed: number }> {
  return syncSOSQueue(async (item: QueuedSOS) => {
    const payload = {
      reporter_name: String(item.reporter_name || 'Anonymous'),
      reporter_phone: String(item.reporter_phone || ''),
      village_id: String(item.village_id || ''),
      village_name: String(item.village_name || ''),
      emergency_type: String(item.emergency_type || 'OTHER'),
      severity: Number(item.severity) || 3,
      description: String(item.description || ''),
      people_affected: Number(item.people_affected) || 1,
      medical_emergency: Boolean(item.medical_emergency),
      medical_details: String(item.medical_details || ''),
      latitude: Number(item.latitude) || 0,
      longitude: Number(item.longitude) || 0,
    }
    await client.post<SOSReport>('/api/sos/submit', payload)
  })
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
  return fetchWithFallback(
    async () => {
      const { data } = await client.get<SOSLatestItem[]>('/api/sos/latest')
      return data
    },
    (data) => cacheSOSLatest(data),
    () => getCachedSOSLatest<SOSLatestItem[]>()
  )
}

export async function fetchSOSStats(): Promise<SOSStats> {
  return fetchWithFallback(
    async () => {
      const { data } = await client.get<SOSStats>('/api/sos/stats')
      return data
    },
    (data) => cacheSOSStats(data),
    () => getCachedSOSStats<SOSStats>()
  )
}

// ---- Validation: real-data ingestion + backtest ----
export async function fetchBacktest(): Promise<BacktestResponse> {
  const { data } = await client.get<BacktestResponse>('/api/validation/backtest')
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

// ---- Satellite Backhaul & ISRO DAT-SG / NavIC Simulation ----
export async function transmitSatelliteSOS(payload: {
  village_id: string
  latitude: number
  longitude: number
  severity?: number
  people_affected?: number
  medical_emergency?: boolean
  emergency_type?: string
  description?: string
  reporter_name?: string
  reporter_phone?: string
  terminal_id?: string
  raw_packet?: string
}): Promise<SatelliteTransmitResponse> {
  const { data } = await client.post<SatelliteTransmitResponse>('/api/satellite/transmit', payload)
  return data
}

export async function fetchSatelliteStatus(): Promise<SatelliteConstellationStatus> {
  const { data } = await client.get<SatelliteConstellationStatus>('/api/satellite/status')
  return data
}

export async function fetchSatcomTerminals(): Promise<SatcomTerminal[]> {
  const { data } = await client.get<{ terminals: SatcomTerminal[] }>('/api/satellite/terminals')
  return data.terminals || []
}

export async function pairSatcomTerminal(terminalId: string, deviceName = 'Civilian Mobile Phone'): Promise<{
  paired: boolean
  terminal: SatcomTerminal
  pairing_protocol: string
  message: string
}> {
  const { data } = await client.post('/api/satellite/terminal/pair', {
    terminal_id: terminalId,
    device_name: deviceName,
  })
  return data
}

export async function broadcastSatelliteDownlink(
  title: string,
  content: string,
  messageType = 'ADVISORY',
  targetTerminal = 'ALL'
): Promise<SatelliteDownlinkMessage> {
  const { data } = await client.post<SatelliteDownlinkMessage>('/api/satellite/downlink/broadcast', {
    title,
    content,
    message_type: messageType,
    target_terminal: targetTerminal,
  })
  return data
}

export async function fetchSatelliteDownlinks(terminalId?: string): Promise<SatelliteDownlinkMessage[]> {
  const params = terminalId ? `?terminal_id=${terminalId}` : ''
  const { data } = await client.get<{ messages: SatelliteDownlinkMessage[] }>(`/api/satellite/downlink/messages${params}`)
  return data.messages || []
}

export default client