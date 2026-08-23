import { Home } from 'lucide-react'
import { fmtNumber } from '../utils'

export default function ShelterPanel({ safeZones }) {
  if (!safeZones?.length) {
    return <p className="text-sm text-slate-500">No safe zone data available.</p>
  }

  return (
    <div className="space-y-2.5 overflow-y-auto pr-1">
      {safeZones.map((sz) => {
        const utilization = sz.capacity > 0 ? Math.round((sz.allocated_population / sz.capacity) * 100) : 0
        return (
          <div key={sz.id} className="rounded-lg border border-base-700 bg-base-850 p-3">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-sm font-medium text-slate-100">
                <Home size={13} className="text-signal-zone" /> {sz.name}
              </p>
              <span className="font-mono text-xs text-slate-400">{utilization}% full</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-base-700">
              <div
                className="h-full rounded-full bg-signal-zone transition-all duration-500"
                style={{ width: `${Math.min(utilization, 100)}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between font-mono text-[11px] text-slate-500">
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
