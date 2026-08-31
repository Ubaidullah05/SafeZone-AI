import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { fetchRelocationPriority } from '../services/api';

export default function OperationalPriorityTable() {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const data = await fetchRelocationPriority();
      setRecommendations(data);
    } catch (e) {
      console.error('Failed to load relocation data:', e);
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
      <div>
        <h2 className="text-xl font-bold text-white">📊 Relocation & Priority</h2>
        <p className="text-sm text-surface-400 mt-1">Village-level relocation recommendations and operational priority</p>
      </div>

      <div className="rounded-2xl bg-panel border border-theme overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-theme bg-panel">
                <th className="text-left py-4 px-5 text-surface-400 font-medium">Priority</th>
                <th className="text-left py-4 px-5 text-surface-400 font-medium">Village</th>
                <th className="text-left py-4 px-5 text-surface-400 font-medium">Population</th>
                <th className="text-left py-4 px-5 text-surface-400 font-medium">Risk Score</th>
                <th className="text-left py-4 px-5 text-surface-400 font-medium">Recommended</th>
                <th className="text-left py-4 px-5 text-surface-400 font-medium">Capacity</th>
                <th className="text-left py-4 px-5 text-surface-400 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {recommendations.map((item, i) => (
                <motion.tr
                  key={item.village}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="border-b border-theme hover:bg-panel transition-colors"
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
                  <td className="py-3 px-5 text-white font-medium">{item.village}</td>
                  <td className="py-3 px-5 text-surface-300 font-mono">{item.population?.toLocaleString()}</td>
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
                      <span className="text-white font-mono text-xs">{item.risk_score}</span>
                    </div>
                  </td>
                  <td className="py-3 px-5">
                    <span className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                      item.action === 'EVACUATE_NOW' ? 'bg-red-500/20 text-red-400 border-red-500/20' :
                      item.action === 'RELOCATE' ? 'bg-amber-500/20 text-amber-400 border-amber-500/20' :
                      item.action === 'MONITOR' ? 'bg-violet-500/20 text-violet-400 border-violet-500/20' :
                      'bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
                    }`}>
                      {item.action?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-5">
                    <span className="text-surface-300 font-mono text-xs">
                      {item.capacity?.toLocaleString() || '—'}
                    </span>
                  </td>
                  <td className="py-3 px-5">
                    <span className={`px-2.5 py-1 rounded-full text-xs ${
                      item.status === 'EVACUATED' ? 'bg-emerald-500/20 text-emerald-400' :
                      item.status === 'PARTIAL' ? 'bg-amber-500/20 text-amber-400' :
                      item.status === 'PENDING' ? 'bg-white/10 text-surface-400' :
                      'bg-violet-500/20 text-violet-400'
                    }`}>
                      {item.status || 'MONITORING'}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
