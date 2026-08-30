import { CheckCircle2, ArrowRight } from 'lucide-react'
import { riskColor, fmtNumber } from '../utils'

export default function RelocationPanel({ priorityList, recommendation, onSelectVillage }) {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pr-1 scrollbar-thin">
      {recommendation && (
        <div className="rounded-2xl border border-golden/20 bg-golden/5 p-4">
          <p className="font-mono text-xs uppercase tracking-widest text-golden">
            Recommended Safe Zone — {recommendation.village_name}
          </p>

          {recommendation.recommended ? (
            <>
              <p className="mt-2 text-lg font-bold text-white">
                {recommendation.recommended.safe_zone_name}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-sm text-surface-400 sm:grid-cols-3">
                <p>Distance: <strong className="text-white">{recommendation.recommended.distance_km} km</strong></p>
                <p>Travel: <strong className="text-white">{recommendation.recommended.estimated_travel_time_minutes} min</strong></p>
                <p>Capacity: <strong className="text-white">{fmtNumber(recommendation.recommended.available_capacity)}</strong></p>
                <p>Safety: <strong className="text-white">{recommendation.recommended.safety_score}</strong></p>
                <p>Medical: <strong className="text-white">{recommendation.recommended.medical_access}</strong></p>
                <p>Road access: <strong className="text-white">{recommendation.recommended.road_accessibility}</strong></p>
              </div>
              <p className="mt-3 font-mono text-sm text-surface-400">
                Overall Destination Score: <strong className="text-golden">{recommendation.recommended.destination_score}/100</strong>
              </p>

              <p className="mt-4 mb-2 text-sm font-medium text-surface-300">Why was this safe zone recommended?</p>
              <ul className="space-y-1.5 text-sm text-surface-400">
                {recommendation.recommended.reasons.map((reason) => (
                  <li key={reason} className="flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-400" /> {reason}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-2 text-sm text-surface-400">No feasible safe zone could be identified from current data.</p>
          )}

          <p className="mt-3 border-t border-golden/20 pt-2 text-sm italic text-surface-500">{recommendation.summary}</p>
        </div>
      )}

      <div>
        <p className="mb-3 font-mono text-xs uppercase tracking-widest text-surface-500">Relocation Priority</p>
        {priorityList.length === 0 ? (
          <p className="text-sm text-surface-500">No habitations currently require relocation.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-theme">
            <table className="w-full text-left text-sm">
              <thead className="bg-panel">
                <tr>
                  <th className="px-3 py-3 font-mono font-normal text-surface-500">#</th>
                  <th className="px-3 py-3 font-mono font-normal text-surface-500">Village</th>
                  <th className="px-3 py-3 font-mono font-normal text-surface-500">Risk</th>
                  <th className="px-3 py-3 font-mono font-normal text-surface-500">To Relocate</th>
                  <th className="px-3 py-3 font-mono font-normal text-surface-500">Safe Zone</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {priorityList.map((v, idx) => (
                  <tr
                    key={v.id}
                    className="cursor-pointer transition hover:bg-panel"
                    onClick={() => onSelectVillage(v.id)}
                  >
                    <td className="px-3 py-2.5 font-mono text-surface-400">{idx + 1}</td>
                    <td className="px-3 py-2.5 font-medium text-white">{v.name}</td>
                    <td className="px-3 py-2.5">
                      <span className="font-mono" style={{ color: riskColor(v.risk_level) }}>{v.risk_score}</span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-surface-400">{fmtNumber(v.people_requiring_relocation)}</td>
                    <td className="px-3 py-2.5 text-surface-400">{v.recommended_safe_zone_name || '—'}</td>
                    <td className="px-3 py-2.5 text-violet-400"><ArrowRight size={14} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
