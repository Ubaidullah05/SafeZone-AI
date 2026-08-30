import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { fetchGroundReality, fetchOperationalPriority } from '../services/api';

export default function GroundRealityPanel() {
  const [groundData, setGroundData] = useState([]);
  const [priorityData, setPriorityData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [gr, op] = await Promise.all([fetchGroundReality(), fetchOperationalPriority()]);
      setGroundData(gr);
      setPriorityData(op);
    } catch (e) {
      console.error('Failed to load ground reality data:', e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">🧠 Ground Reality Engine</h2>
          <p className="text-sm text-surface-400 mt-1">Combined predicted risk + real-time citizen reports</p>
        </div>
      </div>

      {/* Ground Reality Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {groundData.map((item, i) => (
          <motion.div
            key={item.village}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="rounded-2xl bg-panel border border-theme p-5 hover:bg-panel transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-white">{item.village}</h3>
              <span className={`text-xs px-2.5 py-1 rounded-full border ${
                item.ground_score >= 70 ? 'bg-red-500/20 text-red-400 border-red-500/20' :
                item.ground_score >= 40 ? 'bg-amber-500/20 text-amber-400 border-amber-500/20' :
                'bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
              }`}>
                {item.ground_score >= 70 ? 'CRITICAL' : item.ground_score >= 40 ? 'HIGH' : 'MODERATE'}
              </span>
            </div>

            {/* Score Comparison Bar */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-3">
                <span className="text-xs text-surface-400 w-20">Predicted</span>
                <div className="flex-1 h-2.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${item.predicted_risk}%` }}
                    transition={{ duration: 0.8, delay: i * 0.1 }}
                    className="h-full bg-gradient-to-r from-violet-600 to-violet-400 rounded-full"
                  />
                </div>
                <span className="text-xs text-violet-400 w-10 text-right font-mono">{item.predicted_risk}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-surface-400 w-20">Ground</span>
                <div className="flex-1 h-2.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${item.ground_score}%` }}
                    transition={{ duration: 0.8, delay: i * 0.1 + 0.2 }}
                    className="h-full bg-gradient-to-r from-golden to-amber-500 rounded-full"
                  />
                </div>
                <span className="text-xs text-golden w-10 text-right font-mono">{item.ground_score?.toFixed(1)}</span>
              </div>
            </div>

            {/* Component Breakdown */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-surface-400">
                <span>SOS Intensity</span>
                <span className="text-white">{item.components?.sos_intensity?.toFixed(1)}</span>
              </div>
              <div className="flex justify-between text-surface-400">
                <span>Report Density</span>
                <span className="text-white">{item.components?.report_density?.toFixed(1)}</span>
              </div>
              <div className="flex justify-between text-surface-400">
                <span>Severity</span>
                <span className="text-white">{item.components?.severity_aggregate?.toFixed(1)}</span>
              </div>
              <div className="flex justify-between text-surface-400">
                <span>Medical Urgency</span>
                <span className="text-white">{item.components?.medical_urgency?.toFixed(1)}</span>
              </div>
            </div>

            {/* Recommended Action */}
            <div className="mt-3 p-2.5 rounded-xl bg-golden/10 border border-golden/20">
              <span className="text-xs text-golden font-medium">⚡ {item.recommended_action}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Operational Priority Table */}
      {priorityData.length > 0 && (
        <div className="rounded-2xl bg-panel border border-theme p-5">
          <h3 className="text-lg font-bold text-white mb-4">📊 Operational Priority Queue</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-theme">
                  <th className="text-left py-3 px-4 text-surface-400 font-medium">Rank</th>
                  <th className="text-left py-3 px-4 text-surface-400 font-medium">Village</th>
                  <th className="text-left py-3 px-4 text-surface-400 font-medium">Score</th>
                  <th className="text-left py-3 px-4 text-surface-400 font-medium">Active SOS</th>
                  <th className="text-left py-3 px-4 text-surface-400 font-medium">Critical</th>
                  <th className="text-left py-3 px-4 text-surface-400 font-medium">Risk Delta</th>
                  <th className="text-left py-3 px-4 text-surface-400 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {priorityData.map((item, i) => (
                  <motion.tr
                    key={item.village}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="border-b border-theme hover:bg-panel transition-colors"
                  >
                    <td className="py-3 px-4">
                      <span className="w-7 h-7 rounded-lg bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs font-bold">
                        {item.rank}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-white font-medium">{item.village}</td>
                    <td className="py-3 px-4">
                      <span className="text-golden font-mono font-bold">{item.priority_score?.toFixed(1)}</span>
                    </td>
                    <td className="py-3 px-4 text-white">{item.active_sos}</td>
                    <td className="py-3 px-4">
                      {item.critical_sos > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-bold">
                          {item.critical_sos}
                        </span>
                      ) : (
                        <span className="text-surface-500">0</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`font-mono text-xs ${
                        item.risk_delta > 0 ? 'text-red-400' : item.risk_delta < 0 ? 'text-emerald-400' : 'text-surface-400'
                      }`}>
                        {item.risk_delta > 0 ? '+' : ''}{item.risk_delta?.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-1 rounded-lg border ${
                        item.priority_score >= 50 ? 'bg-red-500/20 text-red-400 border-red-500/20' :
                        item.priority_score >= 30 ? 'bg-amber-500/20 text-amber-400 border-amber-500/20' :
                        'bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
                      }`}>
                        {item.recommended_action?.replace(/_/g, ' ')}
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
  );
}
