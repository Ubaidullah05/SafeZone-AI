import type { RiskBreakdown as RiskBreakdownData } from '../types'

const FACTORS: { key: keyof RiskBreakdownData; label: string }[] = [
  { key: 'hazard_severity', label: 'Hazard Severity' },
  { key: 'slope_risk', label: 'Slope / Elevation' },
  { key: 'population_exposure', label: 'Population Exposure' },
  { key: 'accessibility_risk', label: 'Accessibility Risk' },
  { key: 'facility_access_risk', label: 'Facility Access Risk' },
  { key: 'historical_event_risk', label: 'Historical Event Risk' },
]

function barColor(value: number): string {
  if (value >= 80) return '#EF4444'
  if (value >= 60) return '#F59E0B'
  if (value >= 30) return '#EAB308'
  return '#10B981'
}

export default function RiskBreakdown({ breakdown }: { breakdown: RiskBreakdownData | null | undefined }) {
  return (
    <div className="space-y-3">
      <p className="font-mono text-xs uppercase tracking-widest text-surface-500">Risk Contributors</p>
      {FACTORS.map(({ key, label }) => {
        const value = breakdown?.[key] ?? 0
        return (
          <div key={key}>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="text-surface-400">{label}</span>
              <span className="font-mono text-violet-400">{Math.round(value)}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
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