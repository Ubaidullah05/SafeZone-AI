import { useState, useMemo, useEffect, useCallback } from 'react'
import { Building2, TriangleAlert, Users, MoveRight, Home, AlertOctagon, WifiOff } from 'lucide-react'
import Sidebar from './Sidebar'
import Header from './Header'
import AlertBanner from './AlertBanner'
import RiskMap from './RiskMap'
import VillagePanel from './VillagePanel'
import ShelterPanel from './ShelterPanel'
import RelocationPanel from './RelocationPanel'
import ScenarioSimulator from './ScenarioSimulator'
import SOSPanel from './SOSPanel'
import SOSReportForm from './SOSReportForm'
import MeshNetworkView from './MeshNetworkView'
import GroundRealityPanel from './GroundRealityPanel'
import OperationalPriorityTable from './OperationalPriorityTable'
import { riskColor, fmtNumber } from '../utils'
import * as api from '../services/api'
import { useAlertWebSocket } from '../hooks/useWebSocket'
import { useAlertToasts } from './Toast'

function KpiCard({ icon: Icon, label, value, accent, delay = 0 }) {
  return (
    <div className="card-hover flex items-center gap-4 rounded-2xl border border-theme bg-bg-card px-5 py-4 shadow-card animate-fade-in-up" style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}>
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ background: `${accent}15`, color: accent }}>
        <Icon size={20} strokeWidth={1.8} />
      </div>
      <div className="min-w-0">
        <p className="truncate font-mono text-xs uppercase tracking-widest text-muted">{label}</p>
        <p className="font-display text-2xl font-bold text-primary">{value}</p>
      </div>
    </div>
  )
}

export default function Dashboard({ villages, safeZones, riskSummary, selectedVillage, selectedVillageId, onSelectVillage, onFindSafeZone, isLoadingRecommendation, recommendation, onRunScenario, scenarioComparison, isRunningScenario, isDemoMode }) {
  const [activeTab, setActiveTab] = useState('risk')
  const [search, setSearch] = useState('')
  const [showSOSForm, setShowSOSForm] = useState(false)
  const [sosStats, setSosStats] = useState(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [tabKey, setTabKey] = useState(0)
  const { alerts, connected: wsConnected } = useAlertWebSocket(true)
  useAlertToasts(alerts)

  const loadStats = useCallback(() => { api.fetchSOSStats().then(setSosStats).catch(() => {}) }, [])
  useEffect(() => { loadStats() }, [loadStats])
  useEffect(() => { if (alerts?.type === 'sos_update') loadStats() }, [alerts, loadStats])
  useEffect(() => { const on = () => setIsOnline(true), off = () => setIsOnline(false); window.addEventListener('online', on); window.addEventListener('offline', off); return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) } }, [])
  useEffect(() => { if (!wsConnected) { const i = setInterval(loadStats, 10000); return () => clearInterval(i) } }, [wsConnected, loadStats])

  const handleTabChange = useCallback((tab) => { setActiveTab(tab); setTabKey(p => p + 1) }, [])
  const filteredVillages = useMemo(() => { const s = [...villages].sort((a, b) => b.risk_score - a.risk_score); return search.trim() ? s.filter(v => v.name.toLowerCase().includes(search.toLowerCase())) : s }, [villages, search])
  const priorityList = useMemo(() => [...villages].filter(v => v.relocation_required).sort((a, b) => b.relocation_priority_score - a.relocation_priority_score), [villages])
  const criticalCount = riskSummary?.risk_distribution?.CRITICAL || 0

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ backgroundColor: 'var(--bg-body)' }}>
      <Header isDemoMode={isDemoMode} sosActiveCount={sosStats?.active_reports || 0} />
      <AlertBanner criticalCount={criticalCount} sosStats={sosStats} />
      {!isOnline && (
        <div className="flex items-center justify-center gap-2 border-b border-gold-400/15 bg-gold-400/8 px-6 py-2.5 animate-fade-in-down">
          <WifiOff size={15} className="text-gold-400" />
          <span className="text-sm font-medium text-gold-300">You are offline — showing cached data. SOS will sync when reconnected.</span>
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <Sidebar activeTab={activeTab} onTabChange={handleTabChange} sosCount={sosStats?.new_reports || 0} />
        <main className="flex min-h-0 flex-1 flex-col">
          {activeTab === 'risk' && (
            <div className="grid grid-cols-2 gap-4 p-5 pb-0 sm:grid-cols-3 lg:grid-cols-6">
              <KpiCard icon={Building2} label="Habitations" value={riskSummary.total_habitations} accent="var(--surface-400)" delay={0} />
              <KpiCard icon={AlertOctagon} label="High / Critical" value={riskSummary.high_or_critical} accent="#FB923C" delay={50} />
              <KpiCard icon={TriangleAlert} label="Pop. at Risk" value={fmtNumber(riskSummary.population_at_risk)} accent="#F43F5E" delay={100} />
              <KpiCard icon={MoveRight} label="Relocation" value={fmtNumber(relocation_required_population(riskSummary))} accent="#FBBF24" delay={150} />
              <KpiCard icon={Home} label="Safe Capacity" value={fmtNumber(riskSummary.available_safe_capacity)} accent="#34D399" delay={200} />
              <KpiCard icon={Users} label="Capacity Gap" value={fmtNumber(riskSummary.capacity_gap)} accent="#F43F5E" delay={250} />
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <div key={tabKey} className="animate-tab-change">
              {activeTab === 'risk' && <RiskMapTab villages={filteredVillages} safeZones={safeZones} selectedVillageId={selectedVillageId} onSelectVillage={onSelectVillage} selectedVillage={selectedVillage} onFindSafeZone={onFindSafeZone} isLoadingRecommendation={isLoadingRecommendation} recommendation={recommendation} search={search} onSearch={setSearch} />}
              {activeTab === 'sos' && <SOSPanel onShowForm={() => setShowSOSForm(true)} />}
              {activeTab === 'ground' && <GroundRealityPanel />}
              {activeTab === 'mesh' && <MeshNetworkView />}
              {activeTab === 'scenario' && <ScenarioSimulator onRunScenario={onRunScenario} comparison={scenarioComparison} isRunning={isRunningScenario} />}
              {activeTab === 'relocation' && <div className="space-y-5"><RelocationPanel priorityList={priorityList} recommendation={recommendation} onSelectVillage={onSelectVillage} /><OperationalPriorityTable onSelectVillage={onSelectVillage} /></div>}
              {activeTab === 'shelters' && <ShelterPanel safeZones={safeZones} />}
            </div>
          </div>
          <div className="border-t border-theme px-6 py-3 text-center">
            <div className="flex items-center justify-center gap-5">
              <p className="font-mono text-xs text-muted">SafeLink-AI — Analytical decision support. Final evacuation decisions by authorized officials.</p>
              <div className="flex items-center gap-2">
                {wsConnected ? <><div className="h-2 w-2 rounded-full bg-safe animate-pulse" /><span className="font-mono text-xs text-safe font-medium">LIVE</span></> : <><div className="h-2 w-2 rounded-full bg-gold-400" /><span className="font-mono text-xs text-gold-400">OFFLINE</span></>}
              </div>
            </div>
          </div>
        </main>
      </div>
      {showSOSForm && <SOSReportForm onSubmit={() => loadStats()} onClose={() => setShowSOSForm(false)} />}
    </div>
  )
}

function relocation_required_population(s) { return s.relocation_required_population || 0 }

function RiskMapTab({ villages, safeZones, selectedVillageId, onSelectVillage, selectedVillage, onFindSafeZone, isLoadingRecommendation, recommendation, search, onSearch }) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-[300px_1fr_380px]">
      <div className="flex min-h-0 flex-col rounded-2xl border border-theme bg-bg-card p-4 shadow-card">
        <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search habitations…" className="mb-3 rounded-xl border border-theme bg-input px-4 py-2.5 text-sm text-primary outline-none placeholder:text-muted focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20 transition-all" />
        <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
          {villages.map((v) => {
            const sel = v.id === selectedVillageId
            return (
              <button key={v.id} onClick={() => onSelectVillage(v.id)} className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-all ${sel ? 'bg-violet-500/12 border border-violet-500/20' : 'border border-transparent hover:bg-violet-500/5'}`}>
                <div className="min-w-0">
                  <p className={`truncate text-sm font-medium ${sel ? 'text-golden' : 'text-primary'}`}>{v.name}</p>
                  <p className="font-mono text-xs text-muted">{fmtNumber(v.population)} residents</p>
                </div>
                <span className="ml-2 shrink-0 rounded-lg px-2.5 py-1 font-mono text-xs font-bold" style={{ color: riskColor(v.risk_level), background: `${riskColor(v.risk_level)}15` }}>{v.risk_score}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex min-h-0 flex-col gap-5">
        <div className="min-h-[340px] flex-[1.3]"><RiskMap villages={villages} safeZones={safeZones} selectedVillageId={selectedVillageId} onSelectVillage={onSelectVillage} /></div>
        <div className="min-h-[280px] flex-1 overflow-hidden rounded-2xl border border-theme bg-bg-card p-5 shadow-card"><VillagePanel village={selectedVillage} onFindSafeZone={onFindSafeZone} isLoadingRecommendation={isLoadingRecommendation} /></div>
      </div>
      <div className="flex min-h-0 flex-col rounded-2xl border border-theme bg-bg-card p-5 shadow-card overflow-y-auto">
        <RelocationPanel priorityList={[...villages].filter(v => v.relocation_required).sort((a, b) => b.relocation_priority_score - a.relocation_priority_score)} recommendation={recommendation} onSelectVillage={onSelectVillage} />
      </div>
    </div>
  )
}
