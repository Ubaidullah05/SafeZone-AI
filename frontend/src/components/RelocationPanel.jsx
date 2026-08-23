import { CheckCircle2, ArrowRight } from 'lucide-react'
import { riskColor, fmtNumber } from '../utils'

export default function RelocationPanel({ priorityList, recommendation, onSelectVillage }) {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pr-1">
      {recommendation && (
        <div className="rounded-lg border border-signal-zone/30 bg-signal-zone/8 p-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-signal-zone">
            Recommended Safe Zone — {recommendation.village_name}
          </p>

          {recommendation.recommended ? (
            <>
              <p className="mt-1.5 font-display text-lg font-semibold text-slate-800">
                {recommendation.recommended.safe_zone_name}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-xs text-slate-600 sm:grid-cols-3">
                <p>Distance: <strong className="text-slate-800">{recommendation.recommended.distance_km} km</strong></p>
                <p>Travel: <strong className="text-slate-800">{recommendation.recommended.estimated_travel_time_minutes} min</strong></p>
                <p>Capacity: <strong className="text-slate-800">{fmtNumber(recommendation.recommended.available_capacity)}</strong></p>
                <p>Safety: <strong className="text-slate-800">{recommendation.recommended.safety_score}</strong></p>
                <p>Medical: <strong className="text-slate-800">{recommendation.recommended.medical_access}</strong></p>
                <p>Road access: <strong className="text-slate-800">{recommendation.recommended.road_accessibility}</strong></p>
              </div>
              <p className="mt-2 font-mono text-[11px] text-slate-500">
                Overall Destination Score: <strong className="text-slate-700">{recommendation.recommended.destination_score}/100</strong>
              </p>

              <p className="mt-3 mb-1 text-xs font-medium text-slate-700">Why was this safe zone recommended?</p>
              <ul className="space-y-1 text-xs text-slate-600">
                {recommendation.recommended.reasons.map((reason) => (
                  <li key={reason} className="flex items-center gap-1.5">
                    <CheckCircle2 size={12} className="text-signal-safe" /> {reason}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-1.5 text-sm text-slate-600">No feasible safe zone could be identified from current data.</p>
          )}

          <p className="mt-3 border-t border-signal-zone/20 pt-2 text-xs italic text-slate-500">{recommendation.summary}</p>
        </div>
      )}

      <div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">Relocation Priority</p>
        {priorityList.length === 0 ? (
          <p className="text-sm text-slate-500">No habitations currently require relocation.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-base-700">
            <table className="w-full text-left text-xs">
              <thead className="bg-base-850 text-slate-500">
                <tr>
                  <th className="px-2.5 py-2 font-mono font-normal">#</th>
                  <th className="px-2.5 py-2 font-mono font-normal">Village</th>
                  <th className="px-2.5 py-2 font-mono font-normal">Risk</th>
                  <th className="px-2.5 py-2 font-mono font-normal">To Relocate</th>
                  <th className="px-2.5 py-2 font-mono font-normal">Safe Zone</th>
                  <th className="px-2.5 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-base-700">
                {priorityList.map((v, idx) => (
                  <tr
                    key={v.id}
                    className="cursor-pointer transition hover:bg-base-850"
                    onClick={() => onSelectVillage(v.id)}
                  >
                    <td className="px-2.5 py-2 font-mono text-slate-400">{idx + 1}</td>
                    <td className="px-2.5 py-2 font-medium text-slate-700">{v.name}</td>
                    <td className="px-2.5 py-2">
                      <span className="font-mono" style={{ color: riskColor(v.risk_level) }}>{v.risk_score}</span>
                    </td>
                    <td className="px-2.5 py-2 font-mono text-slate-600">{fmtNumber(v.people_requiring_relocation)}</td>
                    <td className="px-2.5 py-2 text-slate-500">{v.recommended_safe_zone_name || '—'}</td>
                    <td className="px-2.5 py-2 text-slate-400"><ArrowRight size={12} /></td>
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
