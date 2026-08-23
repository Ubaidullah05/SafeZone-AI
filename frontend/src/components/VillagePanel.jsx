import { MapPin, Users, TriangleAlert, Compass } from 'lucide-react'
import RiskBreakdown from './RiskBreakdown'
import { riskColor, fmtNumber } from '../utils'

export default function VillagePanel({ village, onFindSafeZone, isLoadingRecommendation }) {
  if (!village) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-base-600 p-6 text-center text-slate-500">
        <MapPin size={22} />
        <p className="text-sm">Select a habitation on the map or from the list to view its risk profile.</p>
      </div>
    )
  }

  const color = riskColor(village.risk_level)

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pr-1">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-white">{village.name}</h3>
          <span
            className="rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide"
            style={{ color, background: `${color}22`, border: `1px solid ${color}55` }}
          >
            {village.risk_level}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1"><Users size={12} /> {fmtNumber(village.population)} residents</span>
          <span className="flex items-center gap-1"><MapPin size={12} /> {village.latitude.toFixed(3)}, {village.longitude.toFixed(3)}</span>
        </div>
      </div>

      <div className="rounded-lg border border-base-700 bg-base-850 p-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Risk Score</p>
            <p className="font-display text-3xl font-bold" style={{ color }}>{village.risk_score}<span className="text-base text-slate-500">/100</span></p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Vulnerability</p>
            <p className="font-display text-xl font-semibold text-slate-200">{village.vulnerability_score}</p>
          </div>
        </div>
      </div>

      <RiskBreakdown breakdown={village.risk_breakdown} />

      <div className="rounded-lg border border-base-700 bg-base-850 p-3">
        <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-slate-500">
          <TriangleAlert size={12} /> Why is this village {village.risk_level.toLowerCase()}?
        </p>
        <ul className="space-y-1 text-xs text-slate-300">
          {village.explanation.map((reason) => (
            <li key={reason} className="flex gap-1.5"><span className="text-slate-600">–</span>{reason}</li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border p-3" style={{ borderColor: `${color}55`, background: `${color}0D` }}>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest" style={{ color }}>What / Why / Action</p>
        <div className="space-y-1.5 text-xs text-slate-300">
          <p><strong className="text-slate-100">WHAT:</strong> {village.risk_level} risk — {village.risk_score}/100</p>
          <p><strong className="text-slate-100">WHY:</strong> {village.explanation.join(', ').toLowerCase()}</p>
          <p>
            <strong className="text-slate-100">ACTION:</strong>{' '}
            {village.relocation_required
              ? `Immediate relocation assessment for ${fmtNumber(village.people_requiring_relocation)} residents`
              : 'Continue routine monitoring — no relocation trigger at current risk level'}
          </p>
        </div>
      </div>

      {village.relocation_required && (
        <button
          onClick={() => onFindSafeZone(village.id)}
          disabled={isLoadingRecommendation}
          className="flex items-center justify-center gap-2 rounded-lg bg-signal-zone px-4 py-2.5 font-medium text-base-950 transition hover:brightness-110 disabled:opacity-60"
        >
          <Compass size={16} />
          {isLoadingRecommendation ? 'Finding best safe zone…' : 'Find Best Safe Zone'}
        </button>
      )}
    </div>
  )
}
