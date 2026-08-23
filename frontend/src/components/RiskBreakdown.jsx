const FACTORS = [
  { key: 'hazard_severity', label: 'Hazard Severity' },
  { key: 'slope_risk', label: 'Slope / Elevation' },
  { key: 'population_exposure', label: 'Population Exposure' },
  { key: 'accessibility_risk', label: 'Accessibility Risk' },
  { key: 'facility_access_risk', label: 'Facility Access Risk' },
  { key: 'historical_event_risk', label: 'Historical Event Risk' },
]

function barColor(value) {
  if (value >= 80) return '#F5384C'
  if (value >= 60) return '#F5793A'
  if (value >= 30) return '#F5B942'
  return '#2FD180'
}

export default function RiskBreakdown({ breakdown }) {
  return (
    <div className="space-y-2.5">
      <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Risk Contributors</p>
      {FACTORS.map(({ key, label }) => {
        const value = breakdown[key] ?? 0
        return (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-slate-300">{label}</span>
              <span className="font-mono text-slate-400">{Math.round(value)}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-base-700">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${value}%`, background: barColor(value) }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
