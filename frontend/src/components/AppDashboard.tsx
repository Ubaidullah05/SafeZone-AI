'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Dashboard from './Dashboard'
import * as api from '../services/api'
import { RAW_SAFE_ZONES, RAW_VILLAGES, runFallbackRecommendation, runFallbackScenario, runPipeline } from '../data/fallbackData'
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
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})

    async function loadInitialData() {
      try {
        const [v, sz, summary] = await Promise.all([
          api.fetchVillages(),
          api.fetchSafeZones(),
          api.fetchRiskSummary(),
        ])
        setVillages(v)
        setSafeZones(sz)
        setRiskSummary(summary)
        setIsDemoMode(false)
        api.fetchAndCacheManifest().catch(() => {})
      } catch {
        const pipeline = runPipeline(RAW_VILLAGES, RAW_SAFE_ZONES)
        setVillages(pipeline.villages)
        setSafeZones(pipeline.safeZones)
        setRiskSummary(pipeline.summary)
        setIsDemoMode(true)
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
      setRecommendation(isDemoMode ? runFallbackRecommendation(villageId) : await api.fetchRecommendation(villageId))
    } catch {
      setRecommendation(runFallbackRecommendation(villageId))
    } finally {
      setIsLoadingRecommendation(false)
    }
  }, [isDemoMode])

  const applyScenarioResult = useCallback((result: ScenarioResult) => {
    setVillages(result.villages)
    setSafeZones(result.safe_zones)
    setRiskSummary(result.risk_summary)
    setScenarioComparison(result.comparison)
  }, [])

  const handleRunScenario = useCallback(async (params: ScenarioAdjustments) => {
    setIsRunningScenario(true)
    try {
      applyScenarioResult(isDemoMode ? runFallbackScenario(params) : await api.runScenario(params))
    } catch {
      applyScenarioResult(runFallbackScenario(params))
    } finally {
      setIsRunningScenario(false)
    }
  }, [isDemoMode, applyScenarioResult])

  if (isLoading || !riskSummary) {
    return (
      <div className="flex h-screen items-center justify-center bg-base-950 text-slate-500">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          <p className="font-mono text-sm">Loading SafeLink - AI…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-base-950">
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