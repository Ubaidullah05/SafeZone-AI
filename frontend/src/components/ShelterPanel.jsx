import { Home } from 'lucide-react'
import { fmtNumber } from '../utils'

export default function ShelterPanel({ safeZones }) {
  if (!safeZones?.length) {
    return <p className="text-sm text-surface-500">No safe zone data available.</p>
  }

  return (
    <div className="space-y-3 overflow-y-auto pr-1 scrollbar-thin">
      {safeZones.map((sz) => {
        const utilization = sz.capacity > 0 ? Math.round((sz.allocated_population / sz.capacity) * 100) : 0
        return (
          <div key={sz.id} className="rounded-2xl border border-theme bg-panel p-4">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-base font-semibold text-white">
                <Home size={16} className="text-golden" /> {sz.name}
              </p>
              <span className="font-mono text-sm text-surface-400">{utilization}% full</span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(utilization, 100)}%`,
                  background: utilization > 80 ? '#EF4444' : utilization > 50 ? '#F59E0B' : '#A78BFA',
                }}
              />
            </div>
            <div className="mt-2.5 flex justify-between font-mono text-xs text-surface-400">
              <span>Allocated {fmtNumber(sz.allocated_population)}</span>
              <span>Remaining {fmtNumber(sz.remaining_capacity)}</span>
              <span>Capacity {fmtNumber(sz.capacity)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
