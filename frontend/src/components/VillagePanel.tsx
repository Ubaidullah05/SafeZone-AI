import { MapPin, Users, TriangleAlert, Compass } from 'lucide-react'
import RiskBreakdown from './RiskBreakdown'
import { riskColor, fmtNumber } from '../utils'
import type { VillageResult } from '../types'

interface VillagePanelProps {
  village: VillageResult | null
  onFindSafeZone: (id: string) => void
  isLoadingRecommendation: boolean
}

export default function VillagePanel({ village, onFindSafeZone, isLoadingRecommendation }: VillagePanelProps) {
  if (!village) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-violet-500/20 p-8 text-center text-surface-500">
        <MapPin size={28} className="text-violet-400/40" />
        <p className="text-base text-surface-400">Select a village on the map or from the list to see its danger level.</p>
      </div>
    )
  }

  const color = riskColor(village.risk_level)

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pr-1 scrollbar-thin">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">{village.name}</h3>
          <span
            className="rounded-full px-3 py-1 font-mono text-xs font-semibold uppercase tracking-wide"
            style={{ color, background: `${color}18`, border: `1px solid ${color}44` }}
          >
            {village.risk_level}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-3 text-sm text-surface-400">
          <span className="flex items-center gap-1"><Users size={14} /> {fmtNumber(village.population)} residents</span>
          <span className="flex items-center gap-1"><MapPin size={14} /> {village.latitude.toFixed(3)}, {village.longitude.toFixed(3)}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-theme bg-panel p-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-surface-500">Danger Score</p>
            <p className="text-3xl font-bold" style={{ color }}>{village.risk_score}<span className="text-base text-surface-500">/100</span></p>
          </div>
          <div className="text-right">
            <p className="font-mono text-xs uppercase tracking-widest text-surface-500">Vulnerability</p>
            <p className="text-xl font-semibold text-surface-300">{village.vulnerability_score}</p>
          </div>
        </div>
      </div>

      <RiskBreakdown breakdown={village.risk_breakdown} />

      <div className="rounded-2xl border border-theme bg-panel p-4">
        <p className="mb-2 flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-surface-500">
          <TriangleAlert size={14} /> Why is this village {village.risk_level.toLowerCase()}?
        </p>
        <ul className="space-y-1.5 text-sm text-surface-400">
          {village.explanation.map((reason) => (
            <li key={reason} className="flex gap-1.5"><span className="text-surface-600">–</span>{reason}</li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border p-4" style={{ borderColor: `${color}44`, background: `${color}08` }}>
        <p className="mb-2 font-mono text-xs uppercase tracking-widest" style={{ color }}>What / Why / Action</p>
        <div className="space-y-1.5 text-sm text-surface-400">
          <p><strong className="text-white">WHAT:</strong> {village.risk_level} risk — {village.risk_score}/100</p>
          <p><strong className="text-white">WHY:</strong> {village.explanation.join(', ').toLowerCase()}</p>
          <p>
            <strong className="text-white">ACTION:</strong>{' '}
            {village.relocation_required
              ? `Immediate evacuation check for ${fmtNumber(village.people_requiring_relocation)} residents`
              : 'Continue watching — no evacuation needed at current danger level'}
          </p>
        </div>
      </div>

      {village.relocation_required && (
        <button
          onClick={() => onFindSafeZone(village.id)}
          disabled={isLoadingRecommendation}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-golden to-amber-500 px-5 py-3 font-semibold text-surface-950 transition hover:brightness-110 disabled:opacity-60 shadow-lg shadow-golden/20 text-base"
        >
          <Compass size={18} />
          {isLoadingRecommendation ? 'Finding best shelter…' : 'Find Best Shelter'}
        </button>
      )}
    </div>
  )
}