import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { fetchGroundReality, fetchOperationalPriority } from '../services/api'
import type { GroundRealityResult, OperationalPriorityItem } from '../types'

interface GroundRow extends GroundRealityResult {
  village?: string
  ground_score?: number
  predicted_risk?: number
  components?: { sos_intensity?: number; report_density?: number; severity_aggregate?: number; medical_urgency?: number }
}

interface OpRow extends OperationalPriorityItem {
  rank: number
  priority_score: number
  risk_delta: number
  critical_sos: number
  recommended_action: string
}

export default function GroundRealityPanel() {
  const [groundData, setGroundData] = useState<GroundRow[]>([])
  const [priorityData, setPriorityData] = useState<OpRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [gr, op] = await Promise.all([fetchGroundReality(), fetchOperationalPriority()])
      if (gr && gr.length > 0) {
        setGroundData(gr as GroundRow[])
      }
      if (op && op.length > 0) {
        setPriorityData(op as OpRow[])
      }
    } catch (e) {
      console.warn('Backend offline — data unavailable:', (e as Error).message)
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

  if (groundData.length === 0 && priorityData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-lg text-surface-400">No data available</p>
        <p className="text-sm text-surface-500 mt-1">Backend may be offline or no reports have been submitted yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-primary">🧠 What People Are Reporting</h2>
          <p className="text-sm text-secondary mt-1">Combined predicted danger + real-time citizen reports</p>
        </div>
      </div>

      {/* Ground Reality Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {groundData.map((item, i) => {
          const score = item.ground_reality_score ?? item.ground_score ?? 0
          const predicted = item.predicted_risk_score ?? item.predicted_risk ?? 0
          const village = item.village_name ?? item.village ?? 'Unknown'
          return (
            <motion.div
              key={item.village_id || i}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="rounded-2xl bg-panel border border-theme p-5 hover:bg-panel transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-primary">{village}</h3>
                <span className={`text-xs px-2.5 py-1 rounded-full border ${
                  score >= 70 ? 'bg-red-500/20 text-red-400 border-red-500/20' :
                  score >= 40 ? 'bg-amber-500/20 text-amber-400 border-amber-500/20' :
                  'bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
                }`}>
                  {score >= 70 ? 'CRITICAL' : score >= 40 ? 'HIGH' : 'MODERATE'}
                </span>
              </div>

              {/* Score Comparison Bar */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-secondary w-20">Predicted</span>
                  <div className="flex-1 h-2.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(predicted, 100)}%` }}
                      transition={{ duration: 0.8, delay: i * 0.1 }}
                      className="h-full bg-gradient-to-r from-violet-600 to-violet-400 rounded-full"
                    />
                  </div>
                  <span className="text-xs text-violet-400 w-10 text-right font-mono">{predicted.toFixed(0)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-secondary w-20">What People Say</span>
                  <div className="flex-1 h-2.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(score, 100)}%` }}
                      transition={{ duration: 0.8, delay: i * 0.1 + 0.2 }}
                      className="h-full bg-gradient-to-r from-golden to-amber-500 rounded-full"
                    />
                  </div>
                  <span className="text-xs text-golden w-10 text-right font-mono">{score.toFixed(1)}</span>
                </div>
              </div>

              {/* Component Breakdown */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-secondary">
                  <span>SOS Intensity</span>
                  <span className="text-primary">{(item.sos_intensity ?? item.components?.sos_intensity ?? 0).toFixed(1)}</span>
                </div>
                <div className="flex justify-between text-secondary">
                  <span>Report Density</span>
                  <span className="text-primary">{(item.report_density ?? item.components?.report_density ?? 0).toFixed(1)}</span>
                </div>
                <div className="flex justify-between text-secondary">
                  <span>Severity</span>
                  <span className="text-primary">{(item.severity_aggregate ?? item.components?.severity_aggregate ?? 0).toFixed(1)}</span>
                </div>
                <div className="flex justify-between text-secondary">
                  <span>Medical Urgency</span>
                  <span className="text-primary">{(item.medical_urgency ?? item.components?.medical_urgency ?? 0).toFixed(1)}</span>
                </div>
              </div>

              {/* Recommended Action */}
              <div className="mt-3 p-2.5 rounded-xl bg-golden/10 border border-golden/20">
                <span className="text-xs text-golden font-medium">⚡ {(item.operational_priority || 'REVIEW').replace(/_/g, ' ')}</span>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Operational Priority Queue */}
      {priorityData.length > 0 && (
        <div className="rounded-2xl bg-panel border border-theme p-5">
          <h3 className="text-lg font-bold text-primary mb-4">📊 Priority Action Queue</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-theme">
                  <th className="text-left py-3 px-4 text-secondary font-medium">Rank</th>
                  <th className="text-left py-3 px-4 text-secondary font-medium">Village</th>
                  <th className="text-left py-3 px-4 text-secondary font-medium">Score</th>
                  <th className="text-left py-3 px-4 text-secondary font-medium">Active Emergency Calls</th>
                  <th className="text-left py-3 px-4 text-secondary font-medium">Critical</th>
                  <th className="text-left py-3 px-4 text-secondary font-medium">People Affected</th>
                  <th className="text-left py-3 px-4 text-secondary font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {priorityData.map((item, i) => (
                  <motion.tr
                    key={item.village_id || item.village_name || i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="border-b border-theme hover:bg-panel transition-colors"
                  >
                    <td className="py-3 px-4">
                      <span className="w-7 h-7 rounded-lg bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs font-bold">
                        {item.rank ?? i + 1}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-primary font-medium">{item.village_name}</td>
                    <td className="py-3 px-4">
                      <span className="text-golden font-mono font-bold">{(item.priority_score ?? item.ground_reality_score).toFixed(1)}</span>
                    </td>
                    <td className="py-3 px-4 text-primary">{item.active_sos_reports}</td>
                    <td className="py-3 px-4">
                      {(item.critical_sos ?? item.medical_emergencies ?? 0) > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-bold">
                          {item.critical_sos ?? item.medical_emergencies ?? 0}
                        </span>
                      ) : (
                        <span className="text-surface-500">0</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-primary">{(item.people_affected ?? 0).toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-1 rounded-lg border ${
                        (item.priority_score ?? item.ground_reality_score) >= 50 ? 'bg-red-500/20 text-red-400 border-red-500/20' :
                        (item.priority_score ?? item.ground_reality_score) >= 30 ? 'bg-amber-500/20 text-amber-400 border-amber-500/20' :
                        'bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
                      }`}>
                        {(item.recommended_action || item.operational_priority || 'REVIEW').replace(/_/g, ' ')}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}