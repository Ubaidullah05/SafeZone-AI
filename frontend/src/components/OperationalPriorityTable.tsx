import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { fetchRelocationPriority } from '../services/api'
import type { VillageResult } from '../types'

interface OperationalPriorityTableProps {
  onSelectVillage: (id: string) => void
}

export default function OperationalPriorityTable({ onSelectVillage }: OperationalPriorityTableProps) {
  const [recommendations, setRecommendations] = useState<VillageResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const data = await fetchRelocationPriority()
      setRecommendations(data)
    } catch (e) {
      console.error('Failed to load relocation data:', e)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-primary">📊 Who Should Move & When</h2>
        <p className="text-sm text-surface-400 mt-1">Village-level evacuation plan and priority order</p>
      </div>

      <div className="rounded-2xl bg-panel border border-theme overflow-hidden">
        {recommendations.length === 0 ? (
          <p className="py-12 text-center text-sm text-surface-400">No evacuation data available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-theme bg-panel">
                  <th className="text-left py-4 px-5 text-surface-400 font-medium">Priority</th>
                  <th className="text-left py-4 px-5 text-surface-400 font-medium">Village</th>
                  <th className="text-left py-4 px-5 text-surface-400 font-medium">Population</th>
                  <th className="text-left py-4 px-5 text-surface-400 font-medium">Danger Score</th>
                  <th className="text-left py-4 px-5 text-surface-400 font-medium">Shelter</th>
                  <th className="text-left py-4 px-5 text-surface-400 font-medium">People to Move</th>
                </tr>
              </thead>
              <tbody>
                {recommendations.map((item, i) => (
                  <motion.tr
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => onSelectVillage(item.id)}
                    className="cursor-pointer border-b border-theme hover:bg-panel transition-colors"
                  >
                    <td className="py-3 px-5">
                      <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ${
                        i < 3 ? 'bg-red-500/20 text-red-400' :
                        i < 6 ? 'bg-amber-500/20 text-amber-400' :
                        'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-primary font-medium">{item.name}</td>
                    <td className="py-3 px-5 text-surface-300 font-mono">{item.population.toLocaleString()}</td>
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              item.risk_score >= 70 ? 'bg-red-500' :
                              item.risk_score >= 40 ? 'bg-amber-500' :
                              'bg-emerald-500'
                            }`}
                            style={{ width: `${item.risk_score}%` }}
                          />
                        </div>
                        <span className="text-primary font-mono text-xs">{item.risk_score}</span>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-surface-300 text-xs">
                      {item.recommended_safe_zone_name || '—'}
                    </td>
                    <td className="py-3 px-5">
                      <span className="text-surface-300 font-mono text-xs">
                        {item.people_requiring_relocation.toLocaleString() || '—'}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}