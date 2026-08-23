import { useEffect, useState } from 'react'
import Header from './components/Header'
import Dashboard from './components/Dashboard'
import * as api from './services/api'
import { RAW_VILLAGES, RAW_SAFE_ZONES, runPipeline, runFallbackRecommendation, runFallbackScenario } from './data/fallbackData'

export default function App() {
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [villages, setVillages] = useState([])
  const [safeZones, setSafeZones] = useState([])
  const [riskSummary, setRiskSummary] = useState(null)

  const [selectedVillageId, setSelectedVillageId] = useState(null)
  const [recommendation, setRecommendation] = useState(null)
  const [isLoadingRecommendation, setIsLoadingRecommendation] = useState(false)

  const [scenarioComparison, setScenarioComparison] = useState(null)
  const [isRunningScenario, setIsRunningScenario] = useState(false)

  useEffect(() => {
    async function loadInitialData() {
      try {
        await api.checkHealth()
        const [v, sz, summary] = await Promise.all([
          api.fetchVillages(),
          api.fetchSafeZones(),
          api.fetchRiskSummary(),
        ])
        setVillages(v)
        setSafeZones(sz)
        setRiskSummary(summary)
        setIsDemoMode(false)
      } catch (err) {
        // Backend unreachable -> fall back to bundled sample data, and say so.
        const pipeline = runPipeline(RAW_VILLAGES, RAW_SAFE_ZONES)
        setVillages(pipeline.villages)
        setSafeZones(pipeline.safeZones)
        setRiskSummary(pipeline.summary)
        setIsDemoMode(true)
      } finally {
        setIsLoading(false)
      }
    }
    loadInitialData()
  }, [])

  const selectedVillage = villages.find((v) => v.id === selectedVillageId) || null

  async function handleSelectVillage(id) {
    setSelectedVillageId(id)
    setRecommendation(null)
  }

  async function handleFindSafeZone(villageId) {
    setIsLoadingRecommendation(true)
    try {
      if (isDemoMode) {
        setRecommendation(runFallbackRecommendation(villageId))
      } else {
        const rec = await api.fetchRecommendation(villageId)
        setRecommendation(rec)
      }
    } catch (err) {
      setRecommendation(runFallbackRecommendation(villageId))
    } finally {
      setIsLoadingRecommendation(false)
    }
  }

  async function handleRunScenario(params) {
    setIsRunningScenario(true)
    try {
      let result
      if (isDemoMode) {
        result = runFallbackScenario(params)
      } else {
        result = await api.runScenario(params)
      }
      setVillages(result.villages)
      setSafeZones(result.safe_zones)
      setRiskSummary(result.risk_summary)
      setScenarioComparison(result.comparison)
    } catch (err) {
      const result = runFallbackScenario(params)
      setVillages(result.villages)
      setSafeZones(result.safe_zones)
      setRiskSummary(result.risk_summary)
      setScenarioComparison(result.comparison)
    } finally {
      setIsRunningScenario(false)
    }
  }

  if (isLoading || !riskSummary) {
    return (
      <div className="flex h-screen items-center justify-center bg-base-950 text-slate-400">
        <p className="font-mono text-sm">Loading SAFEZONE-AI…</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-base-950">
      <Header isDemoMode={isDemoMode} />
      <div className="min-h-0 flex-1 overflow-hidden">
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
        />
      </div>
    </div>
  )
}
