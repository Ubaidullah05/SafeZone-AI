export type RiskLevel = 'SAFE' | 'MODERATE' | 'HIGH' | 'CRITICAL'

export type Role = 'ADMIN' | 'OFFICIAL' | 'VOLUNTEER'

export interface RiskBreakdown {
  hazard_severity: number
  slope_risk: number
  population_exposure: number
  accessibility_risk: number
  facility_access_risk: number
  historical_event_risk: number
}

export interface VillageResult {
  id: string
  name: string
  latitude: number
  longitude: number
  population: number
  risk_score: number
  risk_level: RiskLevel
  vulnerability_score: number
  relocation_required: boolean
  people_requiring_relocation: number
  relocation_priority_score: number
  relocation_priority_rank?: number | null
  risk_breakdown: RiskBreakdown
  explanation: string[]
  recommended_safe_zone_id?: string | null
  recommended_safe_zone_name?: string | null
}

export interface SafeZoneResult {
  id: string
  name: string
  latitude: number
  longitude: number
  capacity: number
  medical_access: number
  safety_score: number
  road_access_score: number
  effective_capacity: number
  allocated_population: number
  remaining_capacity: number
}

export interface RiskSummary {
  total_habitations: number
  high_or_critical: number
  population_at_risk: number
  relocation_required_population: number
  available_safe_capacity: number
  capacity_gap: number
  risk_distribution: Record<RiskLevel, number>
}

export interface DestinationScore {
  safe_zone_id: string
  safe_zone_name: string
  distance_km: number
  estimated_travel_time_minutes: number
  available_capacity: number
  safety_score: number
  medical_access: number
  road_accessibility: number
  destination_score: number
  reasons: string[]
  livelihood_access?: number
  community_continuity?: number
}

export interface RecommendationResult {
  village_id: string
  village_name: string
  people_requiring_relocation: number
  recommended: DestinationScore | null
  alternatives: DestinationScore[]
  summary: string
}

export interface ScenarioAdjustments {
  hazard_severity_delta_pct: number
  rainfall_intensity_delta_pct: number
  population_exposure_delta_pct: number
  road_accessibility_delta_pct: number
  road_closure: boolean
}

export interface ScenarioComparison {
  before_high_risk: number
  before_critical: number
  before_population_at_risk: number
  after_high_risk: number
  after_critical: number
  after_population_at_risk: number
  additional_population_at_risk: number
}

export interface ScenarioResult {
  villages: VillageResult[]
  safe_zones: SafeZoneResult[]
  risk_summary: RiskSummary
  comparison: ScenarioComparison
}

export interface GroundRealityResult {
  village_id: string
  village_name: string
  latitude: number
  longitude: number
  population: number
  predicted_risk_score: number
  predicted_risk_level: RiskLevel
  sos_intensity: number
  report_density: number
  severity_aggregate: number
  medical_urgency: number
  ground_reality_score: number
  operational_priority: string
  total_sos_reports: number
  active_sos_reports: number
  people_affected_by_sos: number
  medical_emergencies: number
  emergency_types: string[]
  risk_breakdown?: RiskBreakdown | null
  explanation: string[]
}

export interface OperationalPriorityItem {
  village_id: string
  village_name: string
  predicted_risk: number
  ground_reality_score: number
  operational_priority: string
  active_sos_reports: number
  people_affected: number
  medical_emergencies: number
  population: number
}

export interface AdvisoryProposal {
  safe_zone_id: string
  safe_zone_name: string
  people: number
}

export interface AdvisoryItem {
  village_id: string
  village_name: string
  /** The action code e.g. "NO_ACTION" | "MONITOR" | "REVIEW_EVACUATION" | "PREFERENTIAL_RELOCATION" */
  recommended_action: string
  recommended_action_label: string
  confidence: number
  evidence: string[]
  reasoning: string
  caveats: string[]
  proposed_relocation: AdvisoryProposal | null
  verdict: string
  verdict_note: string
  // Legacy aliases kept for backwards compat — prefer recommended_action / evidence
  action?: string
  action_label?: string
  rationale?: string[]
  active_sos?: number
  medical?: number
}

export interface DistrictAdvisory {
  recommended_action: string
  recommended_action_label: string
  confidence: number
  evidence: string[]
  verdict: string
  verdict_note: string
}

export interface AdvisoryResponse {
  district: DistrictAdvisory
  habitations: AdvisoryItem[]
  generated_at: string
}

export interface LearningState {
  /** Primary field from backend stats() */
  n_observations: number
  confidence: number
  weights: Record<string, number>
  prior?: Record<string, number>
  learning_rate?: number
  updated_at?: string
  /** Legacy aliases */
  observations?: number
  alpha_lr?: number
}

export interface BacktestRow {
  id: string
  location_name: string
  observed_severity: number
  observed_outcome: string
  predicted_risk_score: number
  predicted_risk_level: RiskLevel
  expected_risk_level: RiskLevel
  classification_match: boolean
  within_one_level: boolean
  explanation: string[]
}

export interface BacktestResponse {
  event: string
  note?: string
  fixture?: string
  rows: BacktestRow[]
  accuracy_exact: number | null
  accuracy_within_one_level: number | null
  critical_recall: number | null
  learning_confidence?: number
}

export type SOSStatus = 'NEW' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'RESOLVED' | 'PENDING_SYNC'

export interface SOSReport {
  id: string
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
  timestamp: string
  status: SOSStatus
  priority_score: number
  adjudicated_by?: string | null
  adjudicated_at?: string | null
  relay_hops?: number
}

export interface SOSStats {
  total_reports: number
  active_reports: number
  new_reports: number
  medical_emergencies: number
  total_people_affected: number
}

export interface SOSLatestItem {
  id: string
  village_id: string
  village_name: string
  emergency_type: string
  severity: number
  people_affected: number
  medical_emergency: boolean
  latitude: number
  longitude: number
  timestamp: string
}

export interface AuthUser {
  id: string
  name: string
  email: string
  role: Role
  department?: string
  pin_enabled?: boolean
}

export interface TokenResponse {
  access_token: string
  token_type?: string
  user: AuthUser
}

export interface AuthSession {
  token: string
  user: AuthUser
  cachedAt?: number
}

// ---------------------------------------------------------------------------
// LifeLink Mesh types
// ---------------------------------------------------------------------------

export interface MeshNode {
  node_id: string
  device_id: string
  battery_level: number
  connectivity_score: number
  role: 'USER' | 'RELAY' | 'CLUSTER_LEADER' | 'RESCUE'
  latitude?: number
  longitude?: number
  last_seen: string
  is_active: boolean
}

export interface MeshPacket {
  packet_id: string
  source_node_id: string
  destination_node_id: string
  message_type: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  payload: Record<string, unknown>
  ttl: number
  hop_count: number
  relay_path: string[]
  encrypted: boolean
  timestamp: string
  status: string
}