import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMeshWebSocket } from '../hooks/useWebSocket';
import { fetchMeshNodes, fetchMeshMessages, fetchMeshHealth, fetchMeshRelayPaths } from '../services/api';

const NODE_COLORS = {
  GATEWAY: { fill: '#A78BFA', stroke: '#C4B5FD', glow: 'rgba(167,139,250,0.5)' },
  VOLUNTEER: { fill: '#F59E0B', stroke: '#FCD34D', glow: 'rgba(245,158,11,0.5)' },
  RESCUE: { fill: '#EF4444', stroke: '#FCA5A5', glow: 'rgba(239,68,68,0.5)' },
  CIVILIAN: { fill: '#6366F1', stroke: '#A5B4FC', glow: 'rgba(99,102,241,0.5)' },
};

const TYPE_LABELS = {
  GATEWAY: '📡 Gateway',
  VOLUNTEER: '🤝 Volunteer',
  RESCUE: '🚑 Rescue',
  CIVILIAN: '📱 Civilian',
};

/* ── Inline demo data (used when backend is unreachable) ── */
const DEMO_NODES = [
  { id: 'NODE001', device_name: 'Amrapur School Tablet', device_type: 'CIVILIAN', village_name: 'Amrapur', battery_level: 35, status: 'ACTIVE', latitude: 30.203, longitude: 78.460, messages_relayed: 3, signal_strength: 78, latency_ms: 120 },
  { id: 'NODE002', device_name: "Rajesh's Phone", device_type: 'VOLUNTEER', village_name: 'Sundarpur', battery_level: 72, status: 'ACTIVE', latitude: 30.121, longitude: 78.451, messages_relayed: 8, signal_strength: 85, latency_ms: 80 },
  { id: 'NODE003', device_name: 'Relief Camp Gateway', device_type: 'GATEWAY', village_name: 'Amrapur', battery_level: 98, status: 'ACTIVE', latitude: 30.200, longitude: 78.475, messages_relayed: 25, signal_strength: 98, latency_ms: 45 },
  { id: 'NODE004', device_name: "Dr. Sharma's Phone", device_type: 'RESCUE', village_name: 'Bhairavgarh', battery_level: 88, status: 'ACTIVE', latitude: 30.219, longitude: 78.495, messages_relayed: 5, signal_strength: 90, latency_ms: 60 },
  { id: 'NODE005', device_name: 'Nandagaon Panchayat Phone', device_type: 'CIVILIAN', village_name: 'Nandagaon', battery_level: 45, status: 'ACTIVE', latitude: 30.188, longitude: 78.418, messages_relayed: 6, signal_strength: 72, latency_ms: 150 },
  { id: 'NODE006', device_name: "Harish's Phone", device_type: 'VOLUNTEER', village_name: 'Sundarpur', battery_level: 18, status: 'ACTIVE', latitude: 30.125, longitude: 78.455, messages_relayed: 12, signal_strength: 65, latency_ms: 200 },
  { id: 'NODE007', device_name: 'Bhairavgarh Temple Tablet', device_type: 'CIVILIAN', village_name: 'Bhairavgarh', battery_level: 60, status: 'ACTIVE', latitude: 30.221, longitude: 78.497, messages_relayed: 4, signal_strength: 75, latency_ms: 110 },
  { id: 'NODE008', device_name: 'Dehradun Control Room', device_type: 'GATEWAY', village_name: 'District HQ', battery_level: 100, status: 'ACTIVE', latitude: 30.250, longitude: 78.440, messages_relayed: 42, signal_strength: 100, latency_ms: 30 },
  { id: 'NODE009', device_name: 'Lakshmangarh PHC Phone', device_type: 'RESCUE', village_name: 'Lakshmangarh', battery_level: 55, status: 'RELAYING', latitude: 30.132, longitude: 78.398, messages_relayed: 7, signal_strength: 68, latency_ms: 180 },
  { id: 'NODE010', device_name: 'Kailashpur Shop Phone', device_type: 'CIVILIAN', village_name: 'Kailashpur', battery_level: 82, status: 'ACTIVE', latitude: 30.162, longitude: 78.505, messages_relayed: 1, signal_strength: 82, latency_ms: 90 },
  { id: 'NODE011', device_name: 'Ganganagar Power Station', device_type: 'CIVILIAN', village_name: 'Ganganagar', battery_level: 5, status: 'INACTIVE', latitude: 30.145, longitude: 78.472, messages_relayed: 2, signal_strength: 20, latency_ms: 500 },
  { id: 'NODE012', device_name: 'Champawali Temple Phone', device_type: 'VOLUNTEER', village_name: 'Champawali', battery_level: 90, status: 'ACTIVE', latitude: 30.055, longitude: 78.445, messages_relayed: 0, signal_strength: 88, latency_ms: 70 },
  { id: 'NODE013', device_name: 'Manikpur Bus Stand Phone', device_type: 'CIVILIAN', village_name: 'Manikpur', battery_level: 28, status: 'ACTIVE', latitude: 30.088, longitude: 78.470, messages_relayed: 3, signal_strength: 60, latency_ms: 220 },
  { id: 'NODE014', device_name: 'Shivpuri Gram Panchayat', device_type: 'CIVILIAN', village_name: 'Shivpuri', battery_level: 65, status: 'INACTIVE', latitude: 30.109, longitude: 78.520, messages_relayed: 1, signal_strength: 30, latency_ms: 400 },
  { id: 'NODE015', device_name: 'Rajpur Relief Ops Center', device_type: 'GATEWAY', village_name: 'Rajpur Relief Center', battery_level: 100, status: 'ACTIVE', latitude: 30.200, longitude: 78.510, messages_relayed: 38, signal_strength: 95, latency_ms: 35 },
  { id: 'NODE016', device_name: 'Rishikot Volunteer Phone', device_type: 'VOLUNTEER', village_name: 'Rishikot', battery_level: 40, status: 'RELAYING', latitude: 30.098, longitude: 78.433, messages_relayed: 2, signal_strength: 70, latency_ms: 140 },
  { id: 'NODE017', device_name: 'Devigram Community Center', device_type: 'CIVILIAN', village_name: 'Devigram', battery_level: 55, status: 'INACTIVE', latitude: 30.075, longitude: 78.489, messages_relayed: 0, signal_strength: 25, latency_ms: 450 },
];

const DEMO_MESSAGES = {
  in_transit: [],
  delivered: [
    { id: 'MSG001', source: 'NODE002', destination: 'NODE003', status: 'DELIVERED', hops: 2, via_path: ['NODE002', 'NODE001', 'NODE003'] },
    { id: 'MSG002', source: 'NODE005', destination: 'NODE008', status: 'DELIVERED', hops: 3, via_path: ['NODE005', 'NODE003', 'NODE008'] },
    { id: 'MSG003', source: 'NODE010', destination: 'NODE009', status: 'DELIVERED', hops: 1, via_path: ['NODE010', 'NODE009'] },
    { id: 'MSG004', source: 'NODE013', destination: 'NODE015', status: 'DELIVERED', hops: 4, via_path: ['NODE013', 'NODE009', 'NODE004', 'NODE015'] },
    { id: 'MSG005', source: 'NODE006', destination: 'NODE008', status: 'DELIVERED', hops: 3, via_path: ['NODE006', 'NODE005', 'NODE003', 'NODE008'] },
  ],
  relay_log: [],
};

function buildDemoHealth(nodes) {
  const total = nodes.length;
  const active = nodes.filter(n => n.status === 'ACTIVE' || n.is_active).length;
  const inactive = nodes.filter(n => n.status === 'INACTIVE' || n.is_active === false).length;
  const relaying = nodes.filter(n => n.status === 'RELAYING' || n.is_relaying).length;
  const gateways = nodes.filter(n => (n.type || n.device_type) === 'GATEWAY').length;
  const civilians = nodes.filter(n => (n.type || n.device_type) === 'CIVILIAN').length;
  const volunteers = nodes.filter(n => (n.type || n.device_type) === 'VOLUNTEER').length;
  const rescue = nodes.filter(n => (n.type || n.device_type) === 'RESCUE').length;
  const avg_battery = total > 0 ? nodes.reduce((s, n) => s + (n.battery ?? n.battery_level ?? 50), 0) / total : 0;
  const total_relayed = nodes.reduce((s, n) => s + (n.messages_relayed || 0), 0);

  return {
    total_nodes: total,
    active_nodes: active,
    inactive_nodes: inactive,
    relay_nodes: relaying,
    gateway_nodes: gateways,
    civilian_nodes: civilians,
    volunteer_nodes: volunteers,
    rescue_nodes: rescue,
    avg_battery: Math.round(avg_battery * 10) / 10,
    total_messages_relayed: total_relayed,
    messages_in_transit: 0,
    messages_delivered: DEMO_MESSAGES.delivered.length,
    messages_buffered: 0,
    network_coverage_pct: total > 0 ? Math.round((active / total) * 100 * 10) / 10 : 0,
    avg_signal_strength: total > 0 ? Math.round(nodes.reduce((s, n) => s + (n.signal_strength || 80), 0) / total) : 80,
    avg_latency_ms: total > 0 ? Math.round(nodes.reduce((s, n) => s + (n.latency_ms || 100), 0) / total) : 100,
    active_clusters: gateways + rescue,
    tick_count: 42,
    clusters: {
      'Cluster-1 (Amrapur)': { members: ['NODE001', 'NODE002', 'NODE003', 'NODE005'], coverage_km: 12.3, avg_range: 6000 },
      'Cluster-2 (Bhairavgarh)': { members: ['NODE004', 'NODE007', 'NODE008', 'NODE009'], coverage_km: 15.1, avg_range: 8000 },
      'Cluster-3 (Rajpur)': { members: ['NODE015', 'NODE016', 'NODE002'], coverage_km: 18.5, avg_range: 7500 },
    },
  };
}

function buildDemoRelayPaths(nodes) {
  const paths = [];
  const connections = [
    ['NODE001', 'NODE002'], ['NODE001', 'NODE003'], ['NODE001', 'NODE005'],
    ['NODE002', 'NODE003'], ['NODE002', 'NODE007'],
    ['NODE003', 'NODE004'], ['NODE003', 'NODE005'], ['NODE003', 'NODE008'],
    ['NODE004', 'NODE009'],
    ['NODE005', 'NODE006'],
    ['NODE006', 'NODE007'],
    ['NODE007', 'NODE008'],
    ['NODE009', 'NODE010'], ['NODE009', 'NODE013'],
    ['NODE015', 'NODE002'], ['NODE015', 'NODE005'], ['NODE015', 'NODE008'],
    ['NODE016', 'NODE015'],
  ];
  const nodeMap = {};
  nodes.forEach(n => { nodeMap[n.id] = n; });

  connections.forEach(([a, b]) => {
    const na = nodeMap[a], nb = nodeMap[b];
    if (!na || !nb) return;
    if (na.status === 'INACTIVE' && nb.status === 'INACTIVE') return;
    paths.push({
      from_id: a, from_name: na.device_name, from_lat: na.latitude, from_lng: na.longitude, from_type: na.device_type,
      to_id: b, to_name: nb.device_name, to_lat: nb.latitude, to_lng: nb.longitude, to_type: nb.device_type,
      source_node: a,
      target_node: b,
      active: na.status !== 'INACTIVE' && nb.status !== 'INACTIVE',
      distance_m: Math.round(Math.random() * 8000 + 1000),
      signal_strength: Math.round(Math.random() * 40 + 60),
    });
  });
  return paths;
}

export default function MeshNetworkView() {
  const { meshData, connected: isWsConnected } = useMeshWebSocket();
  const [nodes, setNodes] = useState(DEMO_NODES);
  const [messages, setMessages] = useState([]);
  const [relayPaths, setRelayPaths] = useState(() => buildDemoRelayPaths(DEMO_NODES));
  const [health, setHealth] = useState(() => buildDemoHealth(DEMO_NODES));
  const [selectedNode, setSelectedNode] = useState(null);
  const [messageFlow, setMessageFlow] = useState(DEMO_MESSAGES.delivered);
  const [isLive, setIsLive] = useState(false);
  const svgRef = useRef(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (meshData) {
      if (meshData.nodes && meshData.nodes.length > 0) {
        const normalizedNodes = meshData.nodes.map(n => ({
          ...n,
          type: n.type || n.device_type || 'CIVILIAN',
          battery: n.battery ?? n.battery_level ?? 50,
          village: n.village || n.village_name || '',
          owner_name: n.owner_name || n.device_name || 'Unknown',
          is_relaying: n.is_relaying ?? n.status === 'RELAYING',
          is_active: n.is_active ?? n.status !== 'INACTIVE',
          battery_level: n.battery_level ?? n.battery ?? 50,
          signal_strength: n.signal_strength ?? 80,
        }));
        setNodes(normalizedNodes);
      }
      if (meshData.health) setHealth(meshData.health);
      if (meshData.relay_paths) {
        const normalizedPaths = meshData.relay_paths.map(p => ({
          ...p,
          source_node: p.source_node || p.from_id,
          target_node: p.target_node || p.to_id,
          active: p.active ?? true,
        }));
        setRelayPaths(normalizedPaths);
      }
      if (meshData.messages && Array.isArray(meshData.messages)) {
        setMessageFlow(prev => {
          const newMsgs = meshData.messages.filter(m =>
            !prev.some(p => p.id === m.id)
          );
          return [...newMsgs, ...prev].slice(0, 20);
        });
      }
      setIsLive(true);
    }
  }, [meshData]);

  async function loadData() {
    try {
      const [nodesData, msgsData, healthData, relayData] = await Promise.all([
        fetchMeshNodes(),
        fetchMeshMessages(),
        fetchMeshHealth(),
        fetchMeshRelayPaths(),
      ]);

      if (nodesData && nodesData.length > 0) {
        const normalizedNodes = nodesData.map(n => ({
          ...n,
          type: n.type || n.device_type || 'CIVILIAN',
          battery: n.battery ?? n.battery_level ?? 50,
          village: n.village || n.village_name || '',
          owner_name: n.owner_name || n.device_name || 'Unknown',
          is_relaying: n.is_relaying ?? n.status === 'RELAYING',
          is_active: n.is_active ?? n.status !== 'INACTIVE',
          battery_level: n.battery_level ?? n.battery ?? 50,
          signal_strength: n.signal_strength ?? 80,
        }));
        setNodes(normalizedNodes);
        setHealth(healthData || buildDemoHealth(normalizedNodes));
      }

      if (relayData && relayData.length > 0) {
        const normalizedPaths = relayData.map(p => ({
          ...p,
          source_node: p.source_node || p.from_id,
          target_node: p.target_node || p.to_id,
          active: p.active ?? true,
        }));
        setRelayPaths(normalizedPaths);
      }

      if (msgsData) {
        setMessages(msgsData);
        const delivered = msgsData.delivered || [];
        if (delivered.length > 0) {
          const normalizedMsgs = delivered.map(m => ({
            id: m.id,
            source: m.source || m.source_node || '',
            destination: m.destination || m.target_node || '',
            status: m.status || 'DELIVERED',
            hops: m.hops || m.relay_hops || 0,
            via_path: m.via_path || m.route || [],
          }));
          setMessageFlow(normalizedMsgs);
        }
      }
      setIsLive(true);
    } catch (e) {
      console.warn('Backend offline — using demo data:', e.message);
      setIsLive(false);
    }
  }

  function getNodePos(node) {
    const lngs = nodes.map(n => n.longitude || 78.45);
    const lats = nodes.map(n => n.latitude || 30.15);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const padX = 60, padY = 40, w = 900, h = 420;
    const x = minLng === maxLng ? w / 2 : padX + (((node.longitude || 78.45) - minLng) / (maxLng - minLng || 1)) * (w - 2 * padX);
    const y = minLat === maxLat ? h / 2 : padY + ((maxLat - (node.latitude || 30.15)) / (maxLat - minLat || 1)) * (h - 2 * padY);
    return { x, y };
  }

  const liveActive = isLive || isWsConnected;

  return (
    <div className="space-y-5">
      {/* Health Metrics */}
      {health && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Active Nodes', value: health.active_nodes ?? 0, icon: '📡', color: 'text-golden' },
            { label: 'Total Nodes', value: health.total_nodes ?? 0, icon: '🌐', color: 'text-violet-400' },
            { label: 'Avg Battery', value: `${(health.avg_battery ?? 0).toFixed(0)}%`, icon: '🔋', color: 'text-emerald-400' },
            { label: 'Messages Relayed', value: health.total_messages_relayed || health.messages_relayed || 0, icon: '📨', color: 'text-amber-400' },
          ].map((metric, i) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="rounded-2xl bg-panel border border-theme p-5"
            >
              <div className="text-sm text-surface-400 mb-1">{metric.icon} {metric.label}</div>
              <div className={`text-2xl font-bold ${metric.color}`}>{metric.value}</div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Extended Health Stats */}
      {health && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Avg Signal', value: `${health.avg_signal_strength || 0} dBm`, icon: '📶', color: 'text-blue-400' },
            { label: 'Avg Latency', value: `${health.avg_latency_ms || 0}ms`, icon: '⏱️', color: 'text-pink-400' },
            { label: 'Network Coverage', value: `${health.network_coverage_pct || 0}%`, icon: '🗺️', color: 'text-emerald-400' },
            { label: 'Active Clusters', value: health.active_clusters || 0, icon: '🔗', color: 'text-cyan-400' },
          ].map((metric, i) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 + 0.3 }}
              className="rounded-2xl bg-panel border border-theme p-5"
            >
              <div className="text-sm text-surface-400 mb-1">{metric.icon} {metric.label}</div>
              <div className={`text-2xl font-bold ${metric.color}`}>{metric.value}</div>
            </motion.div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* SVG Topology */}
        <div className="xl:col-span-2 rounded-2xl bg-panel border border-theme p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-primary">🌐 Network Topology</h3>
            <div className="flex items-center gap-2">
              {liveActive ? (
                <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
                  LIVE
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs text-amber-400">
                  <span className="w-2 h-2 bg-amber-400 rounded-full" />
                  DEMO
                </span>
              )}
              <button onClick={loadData} className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                ↻ Refresh
              </button>
            </div>
          </div>
          <svg
            ref={svgRef}
            viewBox="0 0 900 500"
            className="w-full rounded-xl bg-panel border border-theme"
          >
            {/* Connection Lines */}
            {relayPaths.map((path, i) => {
              const src = nodes.find(n => n.id === path.source_node || n.id === path.from_id);
              const dst = nodes.find(n => n.id === path.target_node || n.id === path.to_id);
              if (!src || !dst) return null;
              const p1 = getNodePos(src);
              const p2 = getNodePos(dst);
              return (
                <g key={`path-${i}`}>
                  <line
                    x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                    stroke={path.active !== false ? 'rgba(139,92,246,0.3)' : 'rgba(139,92,246,0.08)'}
                    strokeWidth={path.active !== false ? 1.5 : 0.8}
                    strokeDasharray={path.active === false ? '4 4' : 'none'}
                  />
                  {path.active !== false && (
                    <circle r="3" fill="#8B5CF6">
                      <animateMotion
                        dur={`${1.5 + Math.random()}s`}
                        repeatCount="indefinite"
                        path={`M${p1.x},${p1.y} L${p2.x},${p2.y}`}
                      />
                    </circle>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {nodes.map((node) => {
              const pos = getNodePos(node);
              const type = node.type || node.device_type || 'CIVILIAN';
              const colors = NODE_COLORS[type] || NODE_COLORS.CIVILIAN;
              const battery = node.battery ?? node.battery_level ?? 50;
              const isSelected = selectedNode?.id === node.id;
              const isRelaying = node.is_relaying || node.status === 'RELAYING';
              const isActive = node.is_active ?? node.status !== 'INACTIVE';
              return (
                <g
                  key={node.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedNode(node)}
                  opacity={isActive ? 1 : 0.35}
                >
                  {/* Glow */}
                  <circle cx={pos.x} cy={pos.y} r="18" fill={colors.glow} opacity={isRelaying ? 0.6 : 0.2}>
                    {isRelaying && (
                      <animate attributeName="r" values="18;28;18" dur="1s" repeatCount="indefinite" />
                    )}
                  </circle>
                  {/* Battery ring */}
                  <circle
                    cx={pos.x} cy={pos.y} r="14"
                    fill="none"
                    stroke={colors.stroke}
                    strokeWidth="2"
                    strokeDasharray={`${(battery / 100) * 88} 88`}
                    strokeLinecap="round"
                    opacity="0.5"
                    transform={`rotate(-90 ${pos.x} ${pos.y})`}
                  />
                  {/* Node circle */}
                  <circle
                    cx={pos.x} cy={pos.y} r="10"
                    fill={isSelected ? colors.stroke : colors.fill}
                    stroke={isSelected ? '#fff' : colors.stroke}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                  />
                  {/* Node label */}
                  <text
                    x={pos.x} y={pos.y + 24}
                    textAnchor="middle"
                    fontSize="9"
                    fill="rgba(255,255,255,0.6)"
                    fontFamily="sans-serif"
                  >
                    {node.id.replace('NODE', 'N')}
                  </text>
                  {/* Battery text */}
                  <text
                    x={pos.x} y={pos.y - 20}
                    textAnchor="middle"
                    fontSize="7"
                    fill={battery > 50 ? '#A78BFA' : battery > 20 ? '#F59E0B' : '#EF4444'}
                    fontFamily="sans-serif"
                  >
                    {battery.toFixed(0)}%
                  </text>
                </g>
              );
            })}

            {/* Legend */}
            <g transform="translate(15, 440)">
              {Object.entries(TYPE_LABELS).map(([type, label], i) => (
                <g key={type} transform={`translate(${i * 150}, 0)`}>
                  <circle cx="8" cy="8" r="5" fill={NODE_COLORS[type].fill} />
                  <text x="18" y="12" fontSize="10" fill="rgba(255,255,255,0.5)" fontFamily="sans-serif">{label}</text>
                </g>
              ))}
            </g>
          </svg>
        </div>

        {/* Side Panel */}
        <div className="space-y-4">
          {/* Selected Node Detail */}
          <AnimatePresence mode="wait">
            {selectedNode && (
              <motion.div
                key={selectedNode.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="rounded-2xl bg-panel border border-theme p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-base font-bold text-primary">{selectedNode.id}</h4>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/20">
                    {TYPE_LABELS[selectedNode.type || selectedNode.device_type]?.split(' ')[0]} {selectedNode.type || selectedNode.device_type}
                  </span>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-surface-400">Device</span>
                    <span className="text-primary">{selectedNode.owner_name || selectedNode.device_name || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-400">Village</span>
                    <span className="text-primary">{selectedNode.village || selectedNode.village_name || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-400">Battery</span>
                    <span className={`font-mono ${(selectedNode.battery ?? selectedNode.battery_level ?? 50) > 50 ? 'text-emerald-400' : (selectedNode.battery ?? selectedNode.battery_level ?? 50) > 20 ? 'text-amber-400' : 'text-red-400'}`}>
                      {(selectedNode.battery ?? selectedNode.battery_level ?? 50).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-400">Signal</span>
                    <span className="text-violet-400 font-mono">{(selectedNode.signal_strength ?? 80).toFixed(1)} dBm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-400">Latency</span>
                    <span className="text-cyan-400 font-mono">{selectedNode.latency_ms || 100}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-400">Status</span>
                    <span className={(selectedNode.is_active ?? selectedNode.status !== 'INACTIVE') ? 'text-emerald-400' : 'text-red-400'}>
                      {(selectedNode.is_active ?? selectedNode.status !== 'INACTIVE') ? '● Active' : '○ Inactive'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-400">Relaying</span>
                    <span className={selectedNode.is_relaying || selectedNode.status === 'RELAYING' ? 'text-golden' : 'text-surface-500'}>
                      {selectedNode.is_relaying || selectedNode.status === 'RELAYING' ? '⚡ Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-400">Msgs Relayed</span>
                    <span className="text-amber-400 font-mono">{selectedNode.messages_relayed || 0}</span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="mt-3 w-full text-xs text-surface-400 hover:text-primary py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all"
                >
                  Close
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Message Flow */}
          <div className="rounded-2xl bg-panel border border-theme p-5">
            <h4 className="text-base font-semibold text-primary mb-3">📨 Message Flow</h4>
            <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin pr-1">
              {messageFlow.length === 0 && (
                <p className="text-sm text-surface-500">No messages yet...</p>
              )}
              {messageFlow.map((msg, i) => (
                <motion.div
                  key={msg.id || i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-xs p-3 rounded-xl bg-panel border border-theme"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-violet-300 font-mono">{msg.source} → {msg.destination}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      msg.status === 'DELIVERED' ? 'bg-emerald-500/20 text-emerald-400' :
                      msg.status === 'IN_TRANSIT' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-white/10 text-surface-400'
                    }`}>
                      {msg.status}
                    </span>
                  </div>
                  <div className="text-surface-400">
                    Hops: <span className="text-golden">{msg.hops}</span> | {' '}
                    {(msg.via_path || []).join(' → ')}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Clusters */}
          <div className="rounded-2xl bg-panel border border-theme p-5">
            <h4 className="text-base font-semibold text-primary mb-3">🔗 Clusters</h4>
            <div className="space-y-2">
              {Object.entries(health?.clusters || {}).map(([name, info]) => (
                <div key={name} className="text-sm p-3 rounded-xl bg-panel border border-theme">
                  <div className="flex justify-between items-center">
                    <span className="text-primary font-medium">{name}</span>
                    <span className="text-violet-400 text-xs">{info.members?.length} nodes</span>
                  </div>
                  <div className="text-surface-400 text-xs mt-1">
                    Coverage: {info.coverage_km?.toFixed(1)}km | Range: {info.avg_range?.toFixed(0)}m
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
