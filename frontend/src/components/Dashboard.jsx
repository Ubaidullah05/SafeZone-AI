import { useMemo, useState } from 'react'
import { Building2, TriangleAlert, Users, MoveRight, Home, AlertOctagon } from 'lucide-react'
import RiskMap from './RiskMap'
import VillagePanel from './VillagePanel'
import ShelterPanel from './ShelterPanel'
import RelocationPanel from './RelocationPanel'
import ScenarioSimulator from './ScenarioSimulator'
import { riskColor, fmtNumber } from '../utils'

function KpiCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-base-700 bg-base-900 px-4 py-3 shadow-panel">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: `${accent}18`, color: accent }}>
        <Icon size={17} />
      </div>
      <div className="min-w-0">
        <p className="truncate font-mono text-[10px] uppercase tracking-widest text-slate-500">{label}</p>
        <p className="font-display text-xl font-bold text-slate-800">{value}</p>
      </div>
    </div>
  )
}

const TABS = [
  { id: 'relocation', label: 'Relocation' },
  { id: 'shelters', label: 'Safe Zones' },
  { id: 'scenario', label: 'What-If' },
]

export default function Dashboard({
  villages,
  safeZones,
  riskSummary,
  selectedVillage,
  selectedVillageId,
  onSelectVillage,
  onFindSafeZone,
  isLoadingRecommendation,
  recommendation,
  onRunScenario,
  scenarioComparison,
  isRunningScenario,
}) {
  const [activeTab, setActiveTab] = useState('relocation')
  const [search, setSearch] = useState('')

  const filteredVillages = useMemo(() => {
    const sorted = [...villages].sort((a, b) => b.risk_score - a.risk_score)
    if (!search.trim()) return sorted
    return sorted.filter((v) => v.name.toLowerCase().includes(search.toLowerCase()))
  }, [villages, search])

  const priorityList = useMemo(
    () =>
      [...villages]
        .filter((v) => v.relocation_required)
        .sort((a, b) => b.relocation_priority_score - a.relocation_priority_score),
    [villages]
  )

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard icon={Building2} label="Total Habitations" value={riskSummary.total_habitations} accent="#2563EB" />
        <KpiCard icon={AlertOctagon} label="High / Critical" value={riskSummary.high_or_critical} accent="#EA580C" />
        <KpiCard icon={TriangleAlert} label="Population at Risk" value={fmtNumber(riskSummary.population_at_risk)} accent="#DC2626" />
        <KpiCard icon={MoveRight} label="Relocation Required" value={fmtNumber(riskSummary.relocation_required_population)} accent="#D97706" />
        <KpiCard icon={Home} label="Available Safe Capacity" value={fmtNumber(riskSummary.available_safe_capacity)} accent="#16A34A" />
        <KpiCard icon={Users} label="Capacity Gap" value={fmtNumber(riskSummary.capacity_gap)} accent="#DC2626" />
      </div>

      {/* Main grid */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[280px_1fr_360px]">
        {/* Village list */}
        <div className="flex min-h-0 flex-col rounded-xl border border-base-700 bg-base-900 p-3 shadow-panel">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search habitations…"
            className="mb-2.5 rounded-lg border border-base-700 bg-base-850 px-3 py-1.5 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-signal-zone focus:ring-1 focus:ring-signal-zone/30"
          />
          <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
            {filteredVillages.map((v) => {
              const isSelected = v.id === selectedVillageId
              return (
                <button
                  key={v.id}
                  onClick={() => onSelectVillage(v.id)}
                  className={`flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-left transition ${
                    isSelected ? 'border-signal-zone bg-signal-zone/10' : 'border-transparent hover:bg-base-850'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-slate-700">{v.name}</p>
                    <p className="font-mono text-[10px] text-slate-500">{fmtNumber(v.population)} residents</p>
                  </div>
                  <span
                    className="ml-2 shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-semibold"
                    style={{ color: riskColor(v.risk_level), background: `${riskColor(v.risk_level)}18` }}
                  >
                    {v.risk_score}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Map + village details */}
        <div className="flex min-h-0 flex-col gap-4">
          <div className="flex-[1.3] min-h-0">
            <RiskMap
              villages={villages}
              safeZones={safeZones}
              selectedVillageId={selectedVillageId}
              onSelectVillage={onSelectVillage}
            />
          </div>
          <div className="flex-1 min-h-0 overflow-hidden rounded-xl border border-base-700 bg-base-900 p-4 shadow-panel">
            <VillagePanel
              village={selectedVillage}
              onFindSafeZone={onFindSafeZone}
              isLoadingRecommendation={isLoadingRecommendation}
            />
          </div>
        </div>

        {/* Tabs: relocation / shelters / scenario */}
        <div className="flex min-h-0 flex-col rounded-xl border border-base-700 bg-base-900 p-4 shadow-panel">
          <div className="mb-3 flex gap-1 rounded-lg border border-base-700 bg-base-850 p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex-1 rounded-md py-1.5 font-mono text-[11px] uppercase tracking-wide transition ${
                  activeTab === t.id ? 'bg-signal-zone text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1">
            {activeTab === 'relocation' && (
              <RelocationPanel priorityList={priorityList} recommendation={recommendation} onSelectVillage={onSelectVillage} />
            )}
            {activeTab === 'shelters' && <ShelterPanel safeZones={safeZones} />}
            {activeTab === 'scenario' && (
              <ScenarioSimulator onRunScenario={onRunScenario} comparison={scenarioComparison} isRunning={isRunningScenario} />
            )}
          </div>
        </div>
      </div>

      <p className="text-center font-mono text-[10px] text-slate-400">
        SAFEZONE-AI provides analytical decision support. Final evacuation and relocation decisions must be made by
        authorized disaster-management officials using verified operational data. Pilot District Demonstration — sample data.
      </p>
    </div>
  )
}
