import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { fetchGroundReality, fetchOperationalPriority } from '../services/api';

/* ── Inline demo data fallback ── */
const DEMO_GROUND_REALITY = [
  {
    village_id: 'V008', village_name: 'Amrapur', latitude: 30.203, longitude: 78.46, population: 3890,
    predicted_risk_score: 92.4, predicted_risk_level: 'CRITICAL',
    sos_intensity: 100.0, report_density: 86.2, severity_aggregate: 100.0, medical_urgency: 25.0,
    ground_reality_score: 84.2, operational_priority: 'IMMEDIATE',
    total_sos_reports: 3, active_sos_reports: 3, people_affected_by_sos: 3928, medical_emergencies: 1,
    emergency_types: ['FLOOD', 'TRAPPED'],
    explanation: ['High hazard severity', 'Critical accessibility risk'],
  },
  {
    village_id: 'V011', village_name: 'Bhairavgarh', latitude: 30.219, longitude: 78.495, population: 1850,
    predicted_risk_score: 78.6, predicted_risk_level: 'HIGH',
    sos_intensity: 90.0, report_density: 72.8, severity_aggregate: 80.0, medical_urgency: 100.0,
    ground_reality_score: 76.5, operational_priority: 'URGENT',
    total_sos_reports: 2, active_sos_reports: 2, people_affected_by_sos: 241, medical_emergencies: 1,
    emergency_types: ['MEDICAL', 'FLOOD'],
    explanation: ['High hazard severity', 'Medical emergency reported'],
  },
  {
    village_id: 'V001', village_name: 'Sundarpur', latitude: 30.121, longitude: 78.451, population: 2100,
    predicted_risk_score: 85.3, predicted_risk_level: 'CRITICAL',
    sos_intensity: 80.0, report_density: 64.3, severity_aggregate: 70.0, medical_urgency: 0.0,
    ground_reality_score: 68.4, operational_priority: 'HIGH',
    total_sos_reports: 3, active_sos_reports: 2, people_affected_by_sos: 156, medical_emergencies: 0,
    emergency_types: ['FLOOD'],
    explanation: ['Critical hazard severity', 'Multiple flood reports'],
  },
  {
    village_id: 'V006', village_name: 'Nandagaon', latitude: 30.188, longitude: 78.418, population: 1500,
    predicted_risk_score: 72.1, predicted_risk_level: 'HIGH',
    sos_intensity: 70.0, report_density: 55.4, severity_aggregate: 80.0, medical_urgency: 100.0,
    ground_reality_score: 65.3, operational_priority: 'HIGH',
    total_sos_reports: 2, active_sos_reports: 2, people_affected_by_sos: 121, medical_emergencies: 1,
    emergency_types: ['ROAD_BLOCKED', 'MEDICAL'],
    explanation: ['Road blocked', 'Medical evacuation needed'],
  },
  {
    village_id: 'V009', village_name: 'Lakshmangarh', latitude: 30.132, longitude: 78.398, population: 1200,
    predicted_risk_score: 68.5, predicted_risk_level: 'HIGH',
    sos_intensity: 70.0, report_density: 48.7, severity_aggregate: 60.0, medical_urgency: 0.0,
    ground_reality_score: 55.8, operational_priority: 'HIGH',
    total_sos_reports: 2, active_sos_reports: 2, people_affected_by_sos: 43, medical_emergencies: 0,
    emergency_types: ['FLOOD', 'TRAPPED'],
    explanation: ['Moderate hazard', 'Trapped people reported'],
  },
  {
    village_id: 'V004', village_name: 'Kailashpur', latitude: 30.162, longitude: 78.505, population: 980,
    predicted_risk_score: 58.2, predicted_risk_level: 'MODERATE',
    sos_intensity: 40.0, report_density: 25.3, severity_aggregate: 60.0, medical_urgency: 100.0,
    ground_reality_score: 44.1, operational_priority: 'MODERATE',
    total_sos_reports: 1, active_sos_reports: 1, people_affected_by_sos: 1, medical_emergencies: 1,
    emergency_types: ['MEDICAL'],
    explanation: ['Medical emergency', 'Moderate risk'],
  },
  {
    village_id: 'V002', village_name: 'Ganganagar', latitude: 30.145, longitude: 78.472, population: 2500,
    predicted_risk_score: 74.8, predicted_risk_level: 'HIGH',
    sos_intensity: 30.0, report_density: 40.6, severity_aggregate: 60.0, medical_urgency: 0.0,
    ground_reality_score: 43.6, operational_priority: 'MODERATE',
    total_sos_reports: 1, active_sos_reports: 1, people_affected_by_sos: 800, medical_emergencies: 0,
    emergency_types: ['WATER_SHORTAGE'],
    explanation: ['Water shortage', 'High population exposure'],
  },
  {
    village_id: 'V012', village_name: 'Manikpur', latitude: 30.088, longitude: 78.47, population: 800,
    predicted_risk_score: 52.3, predicted_risk_level: 'MODERATE',
    sos_intensity: 30.0, report_density: 22.1, severity_aggregate: 60.0, medical_urgency: 0.0,
    ground_reality_score: 37.2, operational_priority: 'MODERATE',
    total_sos_reports: 1, active_sos_reports: 1, people_affected_by_sos: 14, medical_emergencies: 0,
    emergency_types: ['TRAPPED'],
    explanation: ['Trapped people', 'Moderate accessibility risk'],
  },
  {
    village_id: 'V003', village_name: 'Rishikot', latitude: 30.098, longitude: 78.433, population: 1100,
    predicted_risk_score: 48.7, predicted_risk_level: 'MODERATE',
    sos_intensity: 10.0, report_density: 18.5, severity_aggregate: 40.0, medical_urgency: 0.0,
    ground_reality_score: 29.3, operational_priority: 'LOW',
    total_sos_reports: 1, active_sos_reports: 0, people_affected_by_sos: 0, medical_emergencies: 0,
    emergency_types: ['WATER_SHORTAGE'],
    explanation: ['Resolved water shortage'],
  },
  {
    village_id: 'V010', village_name: 'Champawali', latitude: 30.055, longitude: 78.445, population: 650,
    predicted_risk_score: 35.4, predicted_risk_level: 'MODERATE',
    sos_intensity: 0.0, report_density: 0.0, severity_aggregate: 0.0, medical_urgency: 0.0,
    ground_reality_score: 12.4, operational_priority: 'LOW',
    total_sos_reports: 0, active_sos_reports: 0, people_affected_by_sos: 0, medical_emergencies: 0,
    emergency_types: [],
    explanation: ['No active reports'],
  },
  {
    village_id: 'V007', village_name: 'Shivpuri', latitude: 30.109, longitude: 78.52, population: 750,
    predicted_risk_score: 42.1, predicted_risk_level: 'MODERATE',
    sos_intensity: 10.0, report_density: 12.3, severity_aggregate: 40.0, medical_urgency: 0.0,
    ground_reality_score: 22.8, operational_priority: 'LOW',
    total_sos_reports: 1, active_sos_reports: 0, people_affected_by_sos: 0, medical_emergencies: 0,
    emergency_types: ['ROAD_BLOCKED'],
    explanation: ['Resolved road blockage'],
  },
  {
    village_id: 'V005', village_name: 'Devigram', latitude: 30.075, longitude: 78.489, population: 550,
    predicted_risk_score: 38.9, predicted_risk_level: 'MODERATE',
    sos_intensity: 0.0, report_density: 0.0, severity_aggregate: 0.0, medical_urgency: 0.0,
    ground_reality_score: 13.6, operational_priority: 'LOW',
    total_sos_reports: 0, active_sos_reports: 0, people_affected_by_sos: 0, medical_emergencies: 0,
    emergency_types: [],
    explanation: ['No active reports'],
  },
];

const DEMO_PRIORITY = [
  { village_id: 'V008', village_name: 'Amrapur', predicted_risk: 92.4, ground_reality_score: 84.2, operational_priority: 'IMMEDIATE', active_sos_reports: 3, people_affected: 3928, medical_emergencies: 1, population: 3890, rank: 1, priority_score: 84.2, risk_delta: -8.2, critical_sos: 1, recommended_action: 'IMMEDIATE_EVACUATION' },
  { village_id: 'V011', village_name: 'Bhairavgarh', predicted_risk: 78.6, ground_reality_score: 76.5, operational_priority: 'URGENT', active_sos_reports: 2, people_affected: 241, medical_emergencies: 1, population: 1850, rank: 2, priority_score: 76.5, risk_delta: -2.1, critical_sos: 1, recommended_action: 'MEDICAL_TEAM_DISPATCH' },
  { village_id: 'V001', village_name: 'Sundarpur', predicted_risk: 85.3, ground_reality_score: 68.4, operational_priority: 'HIGH', active_sos_reports: 2, people_affected: 156, medical_emergencies: 0, population: 2100, rank: 3, priority_score: 68.4, risk_delta: -16.9, critical_sos: 0, recommended_action: 'RESCUE_TEAM_DEPLOY' },
  { village_id: 'V006', village_name: 'Nandagaon', predicted_risk: 72.1, ground_reality_score: 65.3, operational_priority: 'HIGH', active_sos_reports: 2, people_affected: 121, medical_emergencies: 1, population: 1500, rank: 4, priority_score: 65.3, risk_delta: -6.8, critical_sos: 0, recommended_action: 'ROAD_CLEARANCE' },
  { village_id: 'V009', village_name: 'Lakshmangarh', predicted_risk: 68.5, ground_reality_score: 55.8, operational_priority: 'HIGH', active_sos_reports: 2, people_affected: 43, medical_emergencies: 0, population: 1200, rank: 5, priority_score: 55.8, risk_delta: -12.7, critical_sos: 0, recommended_action: 'RESCUE_TEAM_DEPLOY' },
];

export default function GroundRealityPanel() {
  const [groundData, setGroundData] = useState(DEMO_GROUND_REALITY);
  const [priorityData, setPriorityData] = useState(DEMO_PRIORITY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [gr, op] = await Promise.all([fetchGroundReality(), fetchOperationalPriority()]);
      if (gr && gr.length > 0) {
        setGroundData(gr);
      }
      if (op && op.length > 0) {
        setPriorityData(op);
      }
    } catch (e) {
      console.warn('Backend offline — using demo data:', e.message);
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
          <h2 className="text-xl font-bold text-primary">🧠 Ground Reality Engine</h2>
          <p className="text-sm text-secondary mt-1">Combined predicted risk + real-time citizen reports</p>
        </div>
      </div>

      {/* Ground Reality Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {groundData.map((item, i) => {
          const score = item.ground_reality_score ?? item.ground_score ?? 0;
          const predicted = item.predicted_risk_score ?? item.predicted_risk ?? 0;
          const village = item.village_name ?? item.village ?? 'Unknown';
          return (
            <motion.div
              key={item.village_id || item.village || i}
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
                  <span className="text-xs text-secondary w-20">Ground</span>
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
          );
        })}
      </div>

      {/* Operational Priority Table */}
      {priorityData.length > 0 && (
        <div className="rounded-2xl bg-panel border border-theme p-5">
          <h3 className="text-lg font-bold text-primary mb-4">📊 Operational Priority Queue</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-theme">
                  <th className="text-left py-3 px-4 text-secondary font-medium">Rank</th>
                  <th className="text-left py-3 px-4 text-secondary font-medium">Village</th>
                  <th className="text-left py-3 px-4 text-secondary font-medium">Score</th>
                  <th className="text-left py-3 px-4 text-secondary font-medium">Active SOS</th>
                  <th className="text-left py-3 px-4 text-secondary font-medium">Critical</th>
                  <th className="text-left py-3 px-4 text-secondary font-medium">People Affected</th>
                  <th className="text-left py-3 px-4 text-secondary font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {priorityData.map((item, i) => (
                  <motion.tr
                    key={item.village_id || item.village_name}
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
                      <span className="text-golden font-mono font-bold">{(item.priority_score ?? item.ground_reality_score ?? 0).toFixed(1)}</span>
                    </td>
                    <td className="py-3 px-4 text-primary">{item.active_sos_reports ?? item.active_sos ?? 0}</td>
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
                        (item.priority_score ?? item.ground_reality_score ?? 0) >= 50 ? 'bg-red-500/20 text-red-400 border-red-500/20' :
                        (item.priority_score ?? item.ground_reality_score ?? 0) >= 30 ? 'bg-amber-500/20 text-amber-400 border-amber-500/20' :
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
  );
}
