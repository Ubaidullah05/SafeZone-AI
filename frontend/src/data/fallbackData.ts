import type { RiskLevel, ScenarioAdjustments, ScenarioResult, RecommendationResult, VillageResult, SafeZoneResult, RiskSummary } from '../types'

// Fallback demo data used ONLY when the backend cannot be reached.
// The raw records mirror backend/app/data/*.json exactly, and the
// calculations below mirror app/risk_engine.py, relocation_engine.py,
// capacity_engine.py and scenario_engine.py so "Demo Data Mode" still
// demonstrates the full, correct workflow rather than a frozen snapshot.
// This is a UI convenience only - the backend remains the source of truth
// whenever it is reachable.

interface RawVillage {
  id: string
  name: string
  latitude: number
  longitude: number
  population: number
  hazard_severity: number
  slope_risk: number
  population_exposure: number
  accessibility_risk: number
  facility_access_risk: number
  historical_event_risk: number
}

interface RawSafeZone {
  id: string
  name: string
  latitude: number
  longitude: number
  capacity: number
  medical_access: number
  safety_score: number
  road_access_score: number
}

export const RAW_VILLAGES: RawVillage[] = [
  { id: 'V001', name: 'Sundarpur', latitude: 30.121, longitude: 78.451, population: 2450, hazard_severity: 90, slope_risk: 80, population_exposure: 75, accessibility_risk: 40, facility_access_risk: 30, historical_event_risk: 70 },
  { id: 'V002', name: 'Ganganagar', latitude: 30.145, longitude: 78.472, population: 1830, hazard_severity: 85, slope_risk: 88, population_exposure: 60, accessibility_risk: 65, facility_access_risk: 55, historical_event_risk: 80 },
  { id: 'V003', name: 'Rishikot', latitude: 30.098, longitude: 78.433, population: 950, hazard_severity: 40, slope_risk: 35, population_exposure: 30, accessibility_risk: 20, facility_access_risk: 25, historical_event_risk: 20 },
  { id: 'V004', name: 'Kailashpur', latitude: 30.162, longitude: 78.505, population: 3200, hazard_severity: 55, slope_risk: 50, population_exposure: 65, accessibility_risk: 45, facility_access_risk: 40, historical_event_risk: 35 },
  { id: 'V005', name: 'Devigram', latitude: 30.075, longitude: 78.489, population: 1275, hazard_severity: 25, slope_risk: 20, population_exposure: 20, accessibility_risk: 15, facility_access_risk: 15, historical_event_risk: 10 },
  { id: 'V006', name: 'Nandagaon', latitude: 30.188, longitude: 78.418, population: 2680, hazard_severity: 78, slope_risk: 70, population_exposure: 68, accessibility_risk: 72, facility_access_risk: 60, historical_event_risk: 65 },
  { id: 'V007', name: 'Shivpuri', latitude: 30.109, longitude: 78.520, population: 1540, hazard_severity: 48, slope_risk: 42, population_exposure: 38, accessibility_risk: 30, facility_access_risk: 28, historical_event_risk: 22 },
  { id: 'V008', name: 'Amrapur', latitude: 30.203, longitude: 78.460, population: 3890, hazard_severity: 95, slope_risk: 92, population_exposure: 88, accessibility_risk: 80, facility_access_risk: 70, historical_event_risk: 85 },
  { id: 'V009', name: 'Lakshmangarh', latitude: 30.132, longitude: 78.398, population: 2100, hazard_severity: 62, slope_risk: 58, population_exposure: 55, accessibility_risk: 50, facility_access_risk: 45, historical_event_risk: 40 },
  { id: 'V010', name: 'Champawali', latitude: 30.055, longitude: 78.445, population: 780, hazard_severity: 18, slope_risk: 15, population_exposure: 12, accessibility_risk: 10, facility_access_risk: 12, historical_event_risk: 8 },
  { id: 'V011', name: 'Bhairavgarh', latitude: 30.219, longitude: 78.495, population: 3020, hazard_severity: 82, slope_risk: 75, population_exposure: 72, accessibility_risk: 68, facility_access_risk: 58, historical_event_risk: 75 },
  { id: 'V012', name: 'Manikpur', latitude: 30.088, longitude: 78.470, population: 1680, hazard_severity: 52, slope_risk: 45, population_exposure: 48, accessibility_risk: 38, facility_access_risk: 33, historical_event_risk: 30 },
]

export const RAW_SAFE_ZONES: RawSafeZone[] = [
  { id: 'SZ001', name: 'Rajpur Relief Center', latitude: 30.200, longitude: 78.510, capacity: 4500, medical_access: 85, safety_score: 92, road_access_score: 80 },
  { id: 'SZ002', name: 'Dehragunj Stadium Shelter', latitude: 30.150, longitude: 78.380, capacity: 3000, medical_access: 70, safety_score: 88, road_access_score: 90 },
  { id: 'SZ003', name: 'Haridwar Road Community Hall', latitude: 30.095, longitude: 78.520, capacity: 1800, medical_access: 60, safety_score: 78, road_access_score: 65 },
  { id: 'SZ004', name: 'Chandpur Government College', latitude: 30.240, longitude: 78.440, capacity: 2500, medical_access: 55, safety_score: 82, road_access_score: 60 },
  { id: 'SZ005', name: 'Vasant Vihar Sports Complex', latitude: 30.060, longitude: 78.400, capacity: 1200, medical_access: 50, safety_score: 75, road_access_score: 70 },
]

const W = { hazard: 0.3, slope: 0.2, popExp: 0.15, access: 0.15, facility: 0.1, historical: 0.1 }

function riskLevel(score: number): RiskLevel {
  if (score <= 30) return 'SAFE'
  if (score <= 60) return 'MODERATE'
  if (score <= 80) return 'HIGH'
  return 'CRITICAL'
}

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v))
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function explain(v: RawVillage): string[] {
  const reasons: string[] = []
  if (v.hazard_severity >= 70) reasons.push('High hazard exposure')
  else if (v.hazard_severity >= 40) reasons.push('Moderate hazard exposure')
  if (v.slope_risk >= 70) reasons.push('Steep terrain / high slope risk')
  if (v.population_exposure >= 60) reasons.push('Significant population exposure')
  if (v.accessibility_risk >= 60) reasons.push('Poor emergency accessibility')
  else if (v.accessibility_risk >= 40) reasons.push('Limited emergency accessibility')
  if (v.facility_access_risk >= 50) reasons.push('Limited access to critical facilities')
  if (v.historical_event_risk >= 60) reasons.push('Strong history of past hazard events')
  if (reasons.length === 0) reasons.push('All contributing risk factors are within safe range')
  return reasons
}

export function applyAdjustments(villages: RawVillage[], adj: ScenarioAdjustments): RawVillage[] {
  return villages.map((v) => {
    let hazard = v.hazard_severity * (1 + adj.hazard_severity_delta_pct / 100)
    hazard += v.hazard_severity * (adj.rainfall_intensity_delta_pct / 100) * 0.5
    const popExp = v.population_exposure * (1 + adj.population_exposure_delta_pct / 100)
    let access = v.accessibility_risk * (1 - adj.road_accessibility_delta_pct / 100)
    if (adj.road_closure) access = Math.max(access, 85)
    return { ...v, hazard_severity: clamp(hazard), population_exposure: clamp(popExp), accessibility_risk: clamp(access) }
  })
}

interface PipelineOut {
  villages: VillageResult[]
  safeZones: SafeZoneResult[]
  summary: RiskSummary
}

export function runPipeline(villages: RawVillage[], safeZones: RawSafeZone[]): PipelineOut {
  const totalCapacity = safeZones.reduce((s, z) => s + z.capacity, 0)

  const scored = villages.map((v) => {
    const riskScore = clamp(
      W.hazard * v.hazard_severity +
        W.slope * v.slope_risk +
        W.popExp * v.population_exposure +
        W.access * v.accessibility_risk +
        W.facility * v.facility_access_risk +
        W.historical * v.historical_event_risk
    )
    const level = riskLevel(riskScore)
    const popExpFactor = 0.5 + v.population_exposure / 200
    const accessFactor = 0.5 + v.accessibility_risk / 200
    const vulnerability = Math.min(riskScore * popExpFactor * accessFactor, 100)

    let relocationNeeded = 0
    if (riskScore >= 60) {
      const severityFraction = Math.min((riskScore - 60) / 40, 1)
      const affectedFraction = 0.4 + 0.55 * severityFraction
      relocationNeeded = Math.round(v.population * affectedFraction)
    }

    const capacityDeficit = Math.max(relocationNeeded - totalCapacity, 0)
    const capacityDeficitScore = Math.min((capacityDeficit / Math.max(v.population, 1)) * 100, 100)
    const priority =
      0.4 * riskScore + 0.25 * vulnerability + 0.2 * v.population_exposure + 0.15 * capacityDeficitScore

    return { v, riskScore: Math.round(riskScore * 10) / 10, level, vulnerability: Math.round(vulnerability * 10) / 10, relocationNeeded, priority: Math.round(priority * 10) / 10 }
  })

  scored.sort((a, b) => b.priority - a.priority)

  const remaining = Object.fromEntries(safeZones.map((z) => [z.id, z.capacity])) as Record<string, number>
  const allocated = Object.fromEntries(safeZones.map((z) => [z.id, 0])) as Record<string, number>

  const results = scored.map((r, idx) => {
    let recommendedId: string | null = null
    let recommendedName: string | null = null

    if (r.relocationNeeded > 0) {
      const scoredZones = safeZones.map((z) => {
        const distance = haversineKm(r.v.latitude, r.v.longitude, z.latitude, z.longitude)
        const distSuitability = Math.max(Math.min(100 * (1 - distance / 60), 100), 0)
        const capRatio = Math.min(remaining[z.id] / Math.max(r.relocationNeeded, 1), 1)
        const capScore = capRatio * 100
        const destScore =
          0.25 * z.safety_score + 0.25 * capScore + 0.2 * z.road_access_score + 0.15 * distSuitability + 0.15 * z.medical_access
        return { z, distance, destScore, remainingCap: remaining[z.id] }
      })
      const withCapacity = scoredZones.filter((s) => s.remainingCap > 0)
      const pool = withCapacity.length ? withCapacity : scoredZones
      pool.sort((a, b) => b.destScore - a.destScore)
      const best = pool[0]
      if (best) {
        recommendedId = best.z.id
        recommendedName = best.z.name
        const allocation = Math.min(r.relocationNeeded, best.remainingCap)
        if (allocation > 0) {
          remaining[best.z.id] -= allocation
          allocated[best.z.id] += allocation
        }
      }
    }

    return {
      id: r.v.id,
      name: r.v.name,
      latitude: r.v.latitude,
      longitude: r.v.longitude,
      population: r.v.population,
      risk_score: r.riskScore,
      risk_level: r.level,
      vulnerability_score: r.vulnerability,
      relocation_required: r.relocationNeeded > 0,
      people_requiring_relocation: r.relocationNeeded,
      relocation_priority_score: r.priority,
      relocation_priority_rank: idx + 1,
      risk_breakdown: {
        hazard_severity: r.v.hazard_severity,
        slope_risk: r.v.slope_risk,
        population_exposure: r.v.population_exposure,
        accessibility_risk: r.v.accessibility_risk,
        facility_access_risk: r.v.facility_access_risk,
        historical_event_risk: r.v.historical_event_risk,
      },
      explanation: explain(r.v),
      recommended_safe_zone_id: recommendedId,
      recommended_safe_zone_name: recommendedName,
    }
  })

  results.sort((a, b) => a.id.localeCompare(b.id))

  const safeZoneResults = safeZones.map((z) => ({
    ...z,
    effective_capacity: z.capacity - allocated[z.id],
    allocated_population: allocated[z.id],
    remaining_capacity: z.capacity - allocated[z.id],
  }))

  const highOrCritical = results.filter((r) => r.risk_level === 'HIGH' || r.risk_level === 'CRITICAL').length
  const populationAtRisk = results
    .filter((r) => r.risk_level === 'HIGH' || r.risk_level === 'CRITICAL')
    .reduce((s, r) => s + r.population, 0)
  const relocationPopulation = results.reduce((s, r) => s + r.people_requiring_relocation, 0)
  const capacityGap = Math.max(relocationPopulation - totalCapacity, 0)

  const distribution: Record<RiskLevel, number> = { SAFE: 0, MODERATE: 0, HIGH: 0, CRITICAL: 0 }
  results.forEach((r) => (distribution[r.risk_level] += 1))

  const summary: RiskSummary = {
    total_habitations: results.length,
    high_or_critical: highOrCritical,
    population_at_risk: populationAtRisk,
    relocation_required_population: relocationPopulation,
    available_safe_capacity: totalCapacity,
    capacity_gap: capacityGap,
    risk_distribution: distribution,
  }

  return { villages: results, safeZones: safeZoneResults, summary }
}

export function runFallbackRecommendation(villageId: string): RecommendationResult {
  const pipeline = runPipeline(RAW_VILLAGES, RAW_SAFE_ZONES)
  const villageResult = pipeline.villages.find((v) => v.id === villageId)
  const rawVillage = RAW_VILLAGES.find((v) => v.id === villageId)

  if (!villageResult || villageResult.people_requiring_relocation === 0) {
    return {
      village_id: villageId,
      village_name: villageResult?.name || villageId,
      people_requiring_relocation: 0,
      recommended: null,
      alternatives: [],
      summary: `${villageResult?.name || villageId} does not currently require relocation based on current risk factors.`,
    }
  }

  if (!rawVillage) {
    return {
      village_id: villageId,
      village_name: villageResult.name,
      people_requiring_relocation: villageResult.people_requiring_relocation,
      recommended: null,
      alternatives: [],
      summary: `Relocation assessment requires village geometry data for ${villageResult.name}.`,
    }
  }

  const scoredZones = RAW_SAFE_ZONES.map((z) => {
    const distance = haversineKm(rawVillage.latitude, rawVillage.longitude, z.latitude, z.longitude)
    const travelTime = (distance / 30) * 60
    const remaining = z.capacity
    const capRatio = Math.min(remaining / Math.max(villageResult.people_requiring_relocation, 1), 1)
    const capScore = capRatio * 100
    const distSuitability = Math.max(Math.min(100 * (1 - distance / 60), 100), 0)
    const destScore =
      0.25 * z.safety_score + 0.25 * capScore + 0.2 * z.road_access_score + 0.15 * distSuitability + 0.15 * z.medical_access

    const reasons: string[] = []
    if (z.safety_score >= 80) reasons.push('High safety score')
    if (remaining >= villageResult.people_requiring_relocation) reasons.push('Sufficient capacity')
    else if (remaining > 0) reasons.push('Partial capacity available')
    if (z.road_access_score >= 70) reasons.push('Good road accessibility')
    if (z.medical_access >= 70) reasons.push('Nearby medical facilities')
    if (distance <= 25) reasons.push('Acceptable travel distance')
    if (reasons.length === 0) reasons.push('Best available option among feasible safe zones')

    return {
      safe_zone_id: z.id,
      safe_zone_name: z.name,
      distance_km: Math.round(distance * 10) / 10,
      estimated_travel_time_minutes: Math.round(travelTime),
      available_capacity: remaining,
      safety_score: z.safety_score,
      medical_access: z.medical_access,
      road_accessibility: z.road_access_score,
      destination_score: Math.round(destScore * 10) / 10,
      reasons,
    }
  })

  scoredZones.sort((a, b) => b.destination_score - a.destination_score)
  const best = scoredZones[0]
  const reasonsText = villageResult.explanation.join(', ').toLowerCase()

  return {
    village_id: villageId,
    village_name: villageResult.name,
    people_requiring_relocation: villageResult.people_requiring_relocation,
    recommended: best,
    alternatives: scoredZones.slice(1, 4),
    summary: `${villageResult.name} is currently classified as ${villageResult.risk_level} due to ${reasonsText}. An estimated ${villageResult.people_requiring_relocation.toLocaleString('en-IN')} residents require relocation assessment. ${best.safe_zone_name} is currently the highest-ranked feasible destination based on safety, capacity, accessibility, medical access, and travel distance.`,
  }
}

export function runFallbackScenario(adjustments: ScenarioAdjustments): ScenarioResult {
  const before = runPipeline(RAW_VILLAGES, RAW_SAFE_ZONES)
  const adjustedVillages = applyAdjustments(RAW_VILLAGES, adjustments)
  const after = runPipeline(adjustedVillages, RAW_SAFE_ZONES)

  const comparison = {
    before_high_risk: before.villages.filter((v) => v.risk_level === 'HIGH').length,
    before_critical: before.villages.filter((v) => v.risk_level === 'CRITICAL').length,
    before_population_at_risk: before.summary.population_at_risk,
    after_high_risk: after.villages.filter((v) => v.risk_level === 'HIGH').length,
    after_critical: after.villages.filter((v) => v.risk_level === 'CRITICAL').length,
    after_population_at_risk: after.summary.population_at_risk,
    additional_population_at_risk: after.summary.population_at_risk - before.summary.population_at_risk,
  }

  return { villages: after.villages, safe_zones: after.safeZones, risk_summary: after.summary, comparison }
}