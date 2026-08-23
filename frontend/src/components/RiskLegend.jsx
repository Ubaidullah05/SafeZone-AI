import { RISK_COLORS, RISK_LABELS } from '../utils'

export default function RiskLegend() {
  return (
    <div className="absolute bottom-4 left-4 z-[500] rounded-lg border border-base-600 bg-base-900/90 px-3 py-2.5 shadow-panel backdrop-blur">
      <p className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-slate-500">Risk Legend</p>
      <div className="flex flex-col gap-1">
        {Object.entries(RISK_LABELS).map(([level, label]) => (
          <div key={level} className="flex items-center gap-2 text-xs text-slate-300">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: RISK_COLORS[level] }} />
            {label}
          </div>
        ))}
        <div className="mt-1 flex items-center gap-2 border-t border-base-700 pt-1 text-xs text-slate-300">
          <span className="h-2.5 w-2.5 rounded-sm bg-signal-zone" />
          Safe Zone / Shelter
        </div>
      </div>
    </div>
  )
}
