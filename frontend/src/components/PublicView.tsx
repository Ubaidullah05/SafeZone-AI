import { useEffect, useState } from 'react'
import { Shield, MapPin, Radio, Siren, BatteryCharging, Layers, Lock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import SOSReportForm from './SOSReportForm'
import * as api from '../services/api'
import type { BacktestResponse, LearningState, SafeZoneResult, SOSLatestItem, VillageResult } from '../types'

const RiskMap = lazy(() => import('./RiskMap'))

const SEVERITY_PILL: Record<number, string> = {
  1: 'bg-emerald-500/10 text-emerald-400',
  2: 'bg-violet-500/10 text-violet-300',
  3: 'bg-amber-500/10 text-amber-400',
  4: 'bg-orange-500/10 text-orange-400',
  5: 'bg-red-500/10 text-red-400',
}

export default function PublicView() {
  const [villages, setVillages] = useState<VillageResult[]>([])
  const [safeZones, setSafeZones] = useState<SafeZoneResult[]>([])
  const [latest, setLatest] = useState<SOSLatestItem[]>([])
  const [learning, setLearning] = useState<LearningState | null>(null)
  const [backtest, setBacktest] = useState<BacktestResponse | null>(null)
  const [showSOS, setShowSOS] = useState(false)
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        const [v, sz, latestData] = await Promise.all([
          api.fetchVillages(),
          api.fetchSafeZones(),
          api.fetchSOSLatest(),
        ])
        if (!mounted) return
        setVillages(v)
        setSafeZones(sz)
        setLatest(latestData || [])
        setOffline(false)
      } catch {
        if (!mounted) return
        setOffline(true)
      }
    }

    api.fetchLearningState().then(setLearning).catch(() => {})
    api.fetchBacktest().then(setBacktest).catch(() => {})
    load()

    const onOnline = () => { setOffline(false); void load() }
    const onOffline = () => { setOffline(true) }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      mounted = false
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const criticalCount = villages.filter(v => v.risk_level === 'CRITICAL' || v.risk_level === 'HIGH').length
  const totalCapacity = safeZones.reduce((s, z) => s + (z.capacity || 0), 0)

  return (
    <div className="min-h-screen bg-base-950 text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-theme bg-header/80 px-3 py-2.5 backdrop-blur-xl sm:px-5 sm:py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-golden shadow-glow-v sm:h-9 sm:w-9">
              <Shield size={16} className="text-white sm:w-[17px]" />
            </div>
            <div>
              <span className="font-display text-sm font-bold">SafeLink<span className="text-golden">-AI</span></span>
              <span className="ml-2 hidden font-mono text-2xs uppercase tracking-widest text-muted sm:inline">Public Safety Page</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {offline && (
              <span className="rounded-full border border-golden/20 bg-golden/10 px-2 py-0.5 font-mono text-2xs text-golden sm:px-3 sm:py-1">
                <BatteryCharging size={11} className="mr-1 inline" /> Offline
              </span>
            )}
            <Link
              to="/login"
              className="flex items-center gap-1.5 rounded-xl border border-theme bg-panel px-2.5 py-1.5 text-xs font-medium text-muted transition hover:border-violet-500/30 hover:text-white sm:px-3.5 sm:py-2"
            >
              <Lock size={12} /> <span className="hidden sm:inline">Official Login</span><span className="sm:hidden">Login</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3 pb-12 sm:px-4 sm:pb-16">
        {/* Hero */}
        <section className="relative mt-6 overflow-hidden rounded-2xl border border-theme bg-sidebar p-5 shadow-2xl sm:mt-8 sm:rounded-3xl sm:p-8">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-violet-600/20 blur-[100px]" />
          <div className="relative grid items-center gap-6 sm:gap-8 md:grid-cols-2">
            <div>
              <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-danger/20 bg-danger/10 px-2.5 py-0.5 font-mono text-2xs uppercase tracking-widest text-danger sm:mb-3 sm:px-3 sm:py-1">
                <Siren size={12} /> Emergency alert active
              </p>
              <h1 className="font-display text-2xl font-bold leading-tight sm:text-3xl md:text-4xl">
                Know the danger. <span className="text-golden">Reach safety faster.</span>
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted sm:mt-3 sm:text-base">
                Live danger zones, shelter capacity, and one-tap emergency alerting for every village.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 sm:mt-6 sm:gap-3">
                <button
                  onClick={() => setShowSOS(true)}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-red-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-500/25 transition-all hover:from-red-500 hover:to-red-400 sm:px-6 sm:py-3"
                >
                  <Siren size={16} /> Send SOS
                </button>
                <a
                  href="#map"
                  className="flex items-center gap-2 rounded-xl border border-theme bg-panel px-4 py-2.5 text-sm font-medium text-muted transition hover:border-violet-500/30 hover:text-white sm:px-6 sm:py-3"
                >
                  <MapPin size={15} /> View Danger Map
                </a>
              </div>
            </div>

            {/* Live stats */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div className="rounded-2xl border border-theme bg-panel p-3 sm:p-4">
                <p className="font-mono text-2xs uppercase tracking-widest text-muted">High-danger zones</p>
                <p className="mt-1 text-2xl font-bold text-danger sm:text-3xl">{criticalCount}</p>
                <p className="text-xs text-muted">of {villages.length} villages</p>
              </div>
              <div className="rounded-2xl border border-theme bg-panel p-3 sm:p-4">
                <p className="font-mono text-2xs uppercase tracking-widest text-muted">Shelter capacity</p>
                <p className="mt-1 text-2xl font-bold text-violet-300 sm:text-3xl">{totalCapacity.toLocaleString()}</p>
                <p className="text-xs text-muted">across {safeZones.length} shelters</p>
              </div>
              <div className="rounded-2xl border border-theme bg-panel p-3 sm:p-4">
                <p className="font-mono text-2xs uppercase tracking-widest text-muted">Active emergency reports</p>
                <p className="mt-1 text-2xl font-bold text-golden sm:text-3xl">{latest.length}</p>
                <p className="text-xs text-muted">awaiting official action</p>
              </div>
              <div className="rounded-2xl border border-theme bg-panel p-3 sm:p-4">
                <p className="font-mono text-2xs uppercase tracking-widest text-muted">System accuracy</p>
                <p className="mt-1 text-2xl font-bold text-emerald-400 sm:text-3xl">
                  {learning ? `${Math.round((learning.confidence || 0) * 100)}%` : '—'}
                </p>
                <p className="text-xs text-muted">
                  {learning ? `${learning.observations || learning.n_observations || 0} observations` : 'from outcome validation'}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Map */}
        <section id="map" className="mt-6 sm:mt-8">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-bold">Village Danger Map</h2>
              <p className="text-xs text-muted">Colour = danger score; violet pins = shelters.</p>
            </div>
          </div>
          <div className="h-[300px] sm:h-[400px] md:h-[480px]">
            <Suspense fallback={<div className="flex h-full w-full items-center justify-center rounded-2xl border border-theme bg-panel"><div className="h-7 w-7 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" /></div>}><RiskMap villages={villages} safeZones={safeZones} selectedVillageId={null} onSelectVillage={() => {}} /></Suspense>
          </div>
        </section>

        {/* Transparency: backtest + latest SOS feed */}
        <section className="mt-6 grid gap-3 sm:mt-8 sm:gap-4 md:grid-cols-2">
          {backtest && backtest.rows && (
            <div className="rounded-2xl border border-theme bg-sidebar p-5">
              <div className="mb-3 flex items-center gap-2">
                <Layers size={15} className="text-golden" />
                <h3 className="font-display text-sm font-bold">Model validation — Kedarnath 2013</h3>
              </div>
              <p className="mb-4 text-xs text-muted">{backtest.event}</p>
              <div className="flex gap-3">
                <div className="flex-1 rounded-xl border border-theme bg-panel p-3 text-center">
                  <p className="text-2xl font-bold text-white">{Math.round((backtest.accuracy_exact || 0) * 100)}%</p>
                  <p className="font-mono text-2xs text-muted">Exact match</p>
                </div>
                <div className="flex-1 rounded-xl border border-theme bg-panel p-3 text-center">
                  <p className="text-2xl font-bold text-violet-300">{Math.round((backtest.accuracy_within_one_level || 0) * 100)}%</p>
                  <p className="font-mono text-2xs text-muted">Within 1 band</p>
                </div>
                <div className="flex-1 rounded-xl border border-theme bg-panel p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-400">{Math.round((backtest.critical_recall || 0) * 100)}%</p>
                  <p className="font-mono text-2xs text-muted">Severe-event recall</p>
                </div>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-muted">
                Severity 4+ events must be flagged. The model deliberately over-flags rather than miss a severe event.
              </p>
            </div>
          )}

          <div className="rounded-2xl border border-theme bg-sidebar p-5">
            <div className="mb-3 flex items-center gap-2">
              <Radio size={15} className="text-danger" />
                <h3 className="font-display text-sm font-bold">Latest emergency activity</h3>
            </div>
            {latest.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">No active emergency reports right now. Stay safe.</p>
            ) : (
              <ul className="space-y-2">
                {latest.slice(0, 6).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-theme bg-panel px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.village_name}</p>
                      <p className="font-mono text-2xs text-muted">
                        {r.emergency_type} · {r.people_affected} affected · {new Date(r.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-2xs ${SEVERITY_PILL[r.severity] || SEVERITY_PILL[3]}`}>
                      L{r.severity}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Preparedness */}
        <section className="mt-6 rounded-2xl border border-theme bg-sidebar p-4 sm:mt-8 sm:p-6">
          <h3 className="mb-3 font-display text-lg font-bold sm:mb-4">If an evacuation order is issued</h3>
          <div className="grid gap-2 sm:gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['📍 Know your shelter', 'Check the map for the nearest shelter and plan your route now.'],
              ['📦 Carry essentials', 'Water, medicine, documents, warm clothing, phone, and a power bank.'],
              ['🚶 Move early', 'Follow evacuation announcements. Do not wait for a rescue request.'],
              ['📡 One-tap SOS', 'If you are trapped or injured, use the SOS button. Toggle mobile data if a message fails.'],
            ].map(([t, d]) => (
              <div key={t} className="rounded-2xl border border-theme bg-panel p-4">
                <p className="text-sm font-semibold">{t}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">{d}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-theme py-6 text-center">
        <p className="font-mono text-2xs text-muted">
          SafeLink-AI · SIH 26191 · Safety help — recommendations are reviewed by the district authority before action.
        </p>
      </footer>

      {showSOS && <SOSReportForm onSubmit={() => setShowSOS(false)} onClose={() => setShowSOS(false)} />}
    </div>
  )
}