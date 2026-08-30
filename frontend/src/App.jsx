import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import ProtectedRoute from './auth/ProtectedRoute'
import LoginPage from './auth/LoginPage'
import RegisterPage from './auth/RegisterPage'
import Dashboard from './components/Dashboard'
import * as api from './services/api'
import { RAW_VILLAGES, RAW_SAFE_ZONES, runPipeline, runFallbackRecommendation, runFallbackScenario } from './data/fallbackData'
import { fetchAndCacheManifest } from './services/api'

function AppDashboard() {
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
    // Register Service Worker for offline capability
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

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
        // Cache data for offline use in background
        fetchAndCacheManifest().catch(() => {})
      } catch (err) {
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
      <div className="flex h-screen items-center justify-center bg-base-950 text-slate-500">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-signal-zone border-t-transparent" />
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

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
