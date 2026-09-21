import { useState, useMemo, useEffect, useCallback, lazy, Suspense } from 'react'
import { Building2, TriangleAlert, Users, MoveRight, Home, AlertOctagon, WifiOff, type LucideIcon } from 'lucide-react'
import Sidebar from './Sidebar'
import Header from './Header'
import AlertBanner from './AlertBanner'
import VillagePanel from './VillagePanel'
import ShelterPanel from './ShelterPanel'
import RelocationPanel from './RelocationPanel'
import ScenarioSimulator from './ScenarioSimulator'
import SOSPanel from './SOSPanel'
import GroundRealityPanel from './GroundRealityPanel'
import OperationalPriorityTable from './OperationalPriorityTable'
import AccountsPanel from './AccountsPanel'
import { riskColor, fmtNumber } from '../utils'
import * as api from '../services/api'
import { useAuth } from '../auth/AuthContext'
import { useAlertWebSocket } from '../hooks/useWebSocket'
import { useAlertToasts } from './Toast'
import type {
  RecommendationResult,
  RiskSummary,
  SafeZoneResult,
  ScenarioAdjustments,
  ScenarioComparison,
  SOSStats,
  VillageResult,
} from '../types'

const RiskMap = lazy(() => import('./RiskMap'))

function KpiCard({ icon: Icon, label, value, accent, delay = 0 }: { icon: LucideIcon; label: string; value: string | number; accent: string; delay?: number }) {
  return (
    <div className="card-hover flex items-center gap-3 rounded-2xl border border-theme bg-bg-card px-4 py-3 shadow-card animate-fade-in-up sm:gap-4 sm:px-5 sm:py-4" style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12" style={{ background: `${accent}15`, color: accent }}>
        <Icon size={18} strokeWidth={1.8} />
      </div>
      <div className="min-w-0">
        <p className="truncate font-mono text-2xs uppercase tracking-widest text-muted sm:text-xs">{label}</p>
        <p className="font-display text-xl font-bold text-primary sm:text-2xl">{value}</p>
      </div>
    </div>
  )
}

interface DashboardProps {
  villages: VillageResult[]
  safeZones: SafeZoneResult[]
  riskSummary: RiskSummary
  selectedVillage: VillageResult | null
  selectedVillageId: string | null
  onSelectVillage: (id: string) => void
  onFindSafeZone: (id: string) => void
  isLoadingRecommendation: boolean
  recommendation: RecommendationResult | null
  onRunScenario: (params: ScenarioAdjustments) => void
  scenarioComparison: ScenarioComparison | null
  isRunningScenario: boolean
  isDemoMode: boolean
}

export default function Dashboard({
  villages, safeZones, riskSummary, selectedVillage, selectedVillageId,
  onSelectVillage, onFindSafeZone, isLoadingRecommendation, recommendation,
  onRunScenario, scenarioComparison, isRunningScenario, isDemoMode,
}: DashboardProps) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('risk')
  const [search, setSearch] = useState('')
  const [sosStats, setSosStats] = useState<SOSStats | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  const [tabKey, setTabKey] = useState(0)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const { alerts, connected: wsConnected } = useAlertWebSocket(true)
  useAlertToasts(alerts)

  const loadStats = useCallback(() => { api.fetchSOSStats().then(setSosStats).catch(() => { }) }, [])
  useEffect(() => { loadStats() }, [loadStats])
  useEffect(() => { if (alerts?.type === 'sos_update') loadStats() }, [alerts, loadStats])
  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    setIsOnline(navigator.onLine)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  useEffect(() => { if (!wsConnected) { const i = setInterval(loadStats, 10000); return () => clearInterval(i) } }, [wsConnected, loadStats])

  const handleTabChange = useCallback((tab: string) => { setActiveTab(tab); setTabKey(p => p + 1) }, [])
  const filteredVillages = useMemo(() => { const s = [...villages].sort((a, b) => b.risk_score - a.risk_score); return search.trim() ? s.filter(v => v.name.toLowerCase().includes(search.toLowerCase())) : s }, [villages, search])
  const priorityList = useMemo(() => [...villages].filter(v => v.relocation_required).sort((a, b) => b.relocation_priority_score - a.relocation_priority_score), [villages])
  const criticalCount = riskSummary?.risk_distribution?.CRITICAL || 0

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ backgroundColor: 'var(--bg-body)' }}>
      <Header isDemoMode={isDemoMode} sosActiveCount={sosStats?.active_reports || 0} onOpenMobileSidebar={() => setMobileSidebarOpen(true)} />
      <AlertBanner criticalCount={criticalCount} sosStats={sosStats} />
      {!isOnline && (
        <div className="flex items-center justify-center gap-2 border-b border-gold-400/15 bg-gold-400/8 px-4 py-2 animate-fade-in-down sm:px-6 sm:py-2.5">
          <WifiOff size={15} className="text-gold-400" />
          <span className="text-xs font-medium text-gold-300 sm:text-sm">You are offline — showing saved data.</span>
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <Sidebar activeTab={activeTab} onTabChange={handleTabChange} sosCount={sosStats?.new_reports || 0} role={user?.role} mobileOpen={mobileSidebarOpen} onMobileClose={() => setMobileSidebarOpen(false)} />
        <main className="flex min-h-0 flex-1 flex-col">
          {activeTab === 'risk' && (
            <div className="grid grid-cols-2 gap-3 p-3 pb-0 sm:grid-cols-3 sm:gap-4 sm:p-5 sm:pb-0 lg:grid-cols-6">
              <KpiCard icon={Building2} label="Villages" value={riskSummary.total_habitations} accent="var(--surface-400)" delay={0} />
              <KpiCard icon={AlertOctagon} label="High / Critical" value={riskSummary.high_or_critical} accent="#FB923C" delay={50} />
              <KpiCard icon={TriangleAlert} label="People in Danger" value={fmtNumber(riskSummary.population_at_risk)} accent="#F43F5E" delay={100} />
              <KpiCard icon={MoveRight} label="To Evacuate" value={fmtNumber(riskSummary.relocation_required_population)} accent="#FBBF24" delay={150} />
              <KpiCard icon={Home} label="Shelter Space" value={fmtNumber(riskSummary.available_safe_capacity)} accent="#34D399" delay={200} />
              <KpiCard icon={Users} label="Shelter Shortage" value={fmtNumber(riskSummary.capacity_gap)} accent="#F43F5E" delay={250} />
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
            <div key={tabKey} className="animate-tab-change">
              {activeTab === 'risk' && <RiskMapTab villages={filteredVillages} safeZones={safeZones} selectedVillageId={selectedVillageId} onSelectVillage={onSelectVillage} selectedVillage={selectedVillage} onFindSafeZone={onFindSafeZone} isLoadingRecommendation={isLoadingRecommendation} recommendation={recommendation} search={search} onSearch={setSearch} />}
              {activeTab === 'sos' && <SOSPanel />}
              {activeTab === 'ground' && <GroundRealityPanel />}
              {activeTab === 'accounts' && user?.role === 'ADMIN' && <AccountsPanel />}
              {activeTab === 'scenario' && <ScenarioSimulator onRunScenario={onRunScenario} comparison={scenarioComparison} isRunning={isRunningScenario} />}
              {activeTab === 'relocation' && <div className="space-y-5"><RelocationPanel priorityList={priorityList} recommendation={recommendation} onSelectVillage={onSelectVillage} /><OperationalPriorityTable onSelectVillage={onSelectVillage} /></div>}
              {activeTab === 'shelters' && <ShelterPanel safeZones={safeZones} />}
            </div>
          </div>
          <div className="hidden border-t border-theme px-6 py-3 text-center sm:block">
            <div className="flex items-center justify-center gap-5">
              <p className="font-mono text-xs text-muted">SafeLink-AI — Safety help. Evacuation decided by officials.</p>
              <div className="flex items-center gap-2">
                {wsConnected ? <><div className="h-2 w-2 rounded-full bg-safe animate-pulse" /><span className="font-mono text-xs text-safe font-medium">LIVE</span></> : <><div className="h-2 w-2 rounded-full bg-gold-400" /><span className="font-mono text-xs text-gold-400">OFFLINE</span></>}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

interface RiskMapTabProps {
  villages: VillageResult[]
  safeZones: SafeZoneResult[]
  selectedVillageId: string | null
  onSelectVillage: (id: string) => void
  selectedVillage: VillageResult | null
  onFindSafeZone: (id: string) => void
  isLoadingRecommendation: boolean
  recommendation: RecommendationResult | null
  search: string
  onSearch: (s: string) => void
}

function RiskMapTab({ villages, safeZones, selectedVillageId, onSelectVillage, selectedVillage, onFindSafeZone, isLoadingRecommendation, recommendation, search, onSearch }: RiskMapTabProps) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-[300px_1fr_380px]">
      <div className="flex min-h-0 flex-col rounded-2xl border border-theme bg-bg-card p-3 shadow-card sm:p-4">
        <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search villages…" className="mb-3 rounded-xl border border-theme bg-input px-3 py-2 text-sm text-primary outline-none placeholder:text-muted focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20 transition-all sm:px-4 sm:py-2.5" />
        <div className="max-h-[40vh] flex-1 space-y-1 overflow-y-auto pr-1 sm:max-h-none">
          {villages.map((v) => {
            const sel = v.id === selectedVillageId
            return (
              <button key={v.id} onClick={() => onSelectVillage(v.id)} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-all sm:px-4 sm:py-3 ${sel ? 'bg-violet-500/12 border border-violet-500/20' : 'border border-transparent hover:bg-violet-500/5'}`}>
                <div className="min-w-0">
                  <p className={`truncate text-sm font-medium ${sel ? 'text-golden' : 'text-primary'}`}>{v.name}</p>
                  <p className="font-mono text-2xs text-muted sm:text-xs">{fmtNumber(v.population)} residents</p>
                </div>
                <span className="ml-2 shrink-0 rounded-lg px-2 py-1 font-mono text-2xs font-bold sm:px-2.5 sm:text-xs" style={{ color: riskColor(v.risk_level), background: `${riskColor(v.risk_level)}15` }}>{v.risk_score}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex min-h-0 flex-col gap-4 sm:gap-5">
        <div className="min-h-[280px] flex-[1.3] sm:min-h-[340px]"><Suspense fallback={<div className="flex h-full w-full items-center justify-center rounded-2xl border border-theme bg-panel"><div className="h-7 w-7 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" /></div>}><RiskMap villages={villages} safeZones={safeZones} selectedVillageId={selectedVillageId} onSelectVillage={onSelectVillage} /></Suspense></div>
        <div className="min-h-[250px] flex-1 overflow-hidden rounded-2xl border border-theme bg-bg-card p-3 shadow-card sm:p-5"><VillagePanel village={selectedVillage} onFindSafeZone={onFindSafeZone} isLoadingRecommendation={isLoadingRecommendation} /></div>
      </div>
      <div className="flex min-h-0 flex-col rounded-2xl border border-theme bg-bg-card p-3 shadow-card overflow-y-auto sm:p-5">
        <RelocationPanel priorityList={[...villages].filter(v => v.relocation_required).sort((a, b) => b.relocation_priority_score - a.relocation_priority_score)} recommendation={recommendation} onSelectVillage={onSelectVillage} />
      </div>
    </div>
  )
}