import { useCallback, useEffect, useMemo, useState } from 'react'
import Dashboard from './Dashboard'
import * as api from '../services/api'
import type { RecommendationResult, RiskSummary, SafeZoneResult, ScenarioAdjustments, ScenarioComparison, ScenarioResult, VillageResult } from '../types'

export default function AppDashboard() {
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [villages, setVillages] = useState<VillageResult[]>([])
  const [safeZones, setSafeZones] = useState<SafeZoneResult[]>([])
  const [riskSummary, setRiskSummary] = useState<RiskSummary | null>(null)

  const [selectedVillageId, setSelectedVillageId] = useState<string | null>(null)
  const [recommendation, setRecommendation] = useState<RecommendationResult | null>(null)
  const [isLoadingRecommendation, setIsLoadingRecommendation] = useState(false)

  const [scenarioComparison, setScenarioComparison] = useState<ScenarioComparison | null>(null)
  const [isRunningScenario, setIsRunningScenario] = useState(false)

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [health, v, sz, summary] = await Promise.all([
          api.checkHealth(),
          api.fetchVillages(),
          api.fetchSafeZones(),
          api.fetchRiskSummary(),
        ])
        setVillages(v)
        setSafeZones(sz)
        setRiskSummary(summary)
        setIsDemoMode(health.mode === 'demo-data')
        api.fetchAndCacheManifest().catch(() => {})
      } catch {
        // Backend unreachable — try offline cache
        try {
          const cachedV = await import('../services/offlineCache').then(m => m.getCachedVillages())
          const cachedSZ = await import('../services/offlineCache').then(m => m.getCachedSafeZones())
          if (cachedV && cachedV.length > 0) {
            setVillages(cachedV)
            setSafeZones(cachedSZ || [])
            setIsDemoMode(true)
          }
        } catch {
          // No cache available
        }
      } finally {
        setIsLoading(false)
      }
    }
    void loadInitialData()
  }, [])

  const selectedVillage = useMemo(
    () => villages.find((v) => v.id === selectedVillageId) || null,
    [villages, selectedVillageId]
  )

  const handleSelectVillage = useCallback((id: string) => {
    setSelectedVillageId(id)
    setRecommendation(null)
  }, [])

  const handleFindSafeZone = useCallback(async (villageId: string) => {
    setIsLoadingRecommendation(true)
    try {
      setRecommendation(await api.fetchRecommendation(villageId))
    } catch {
      setRecommendation(null)
    } finally {
      setIsLoadingRecommendation(false)
    }
  }, [])

  const applyScenarioResult = useCallback((result: ScenarioResult) => {
    setVillages(result.villages)
    setSafeZones(result.safe_zones)
    setRiskSummary(result.risk_summary)
    setScenarioComparison(result.comparison)
  }, [])

  const handleRunScenario = useCallback(async (params: ScenarioAdjustments) => {
    setIsRunningScenario(true)
    try {
      applyScenarioResult(await api.runScenario(params))
    } catch {
      // Scenario failed — keep current state
    } finally {
      setIsRunningScenario(false)
    }
  }, [applyScenarioResult])

  if (isLoading || !riskSummary) {
    return (
      <div className="flex h-dvh items-center justify-center bg-base-950 text-slate-500">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          <p className="font-mono text-sm">Loading SafeLink - AI…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-base-950">
      <Dashboard
        villages={villages}
        safeZones={safeZones}
        riskSummary={riskSummary}
        selectedVillage={selectedVillage}
        selectedVillageId={selectedVillageId}
        onSelectVillage={handleSelectVillage}
        onFindSafeZone={handleFindSafeZone}
        isLoadingRecommendation={isLoadingRecommendation}
        recommendation={recommendation}
        onRunScenario={handleRunScenario}
        scenarioComparison={scenarioComparison}
        isRunningScenario={isRunningScenario}
        isDemoMode={isDemoMode}
      />
    </div>
  )
}