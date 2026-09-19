import { RISK_COLORS, RISK_LABELS } from '../utils'

export default function RiskLegend() {
  return (
    <div className="absolute bottom-4 left-4 z-[500] rounded-2xl border border-theme bg-sidebar px-4 py-3 backdrop-blur-xl shadow-xl">
      <p className="mb-2 font-mono text-xs uppercase tracking-widest text-surface-500">Risk Levels</p>
      <div className="flex flex-col gap-1.5">
        {(Object.entries(RISK_LABELS) as [string, string][]).map(([level, label]) => (
          <div key={level} className="flex items-center gap-2.5 text-sm text-surface-300">
            <span className="h-3 w-3 rounded-full" style={{ background: RISK_COLORS[level as keyof typeof RISK_COLORS] }} />
            {label}
          </div>
        ))}
        <div className="mt-1.5 flex items-center gap-2.5 border-t border-theme pt-2 text-sm text-surface-300">
          <span className="h-3 w-3 rounded-sm bg-violet-500" />
          Shelter
        </div>
      </div>
    </div>
  )
}