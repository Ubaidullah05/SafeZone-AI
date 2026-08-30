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

export default function MeshNetworkView() {
  const { meshData, connected: isConnected } = useMeshWebSocket();
  const [nodes, setNodes] = useState([]);
  const [messages, setMessages] = useState([]);
  const [relayPaths, setRelayPaths] = useState([]);
  const [health, setHealth] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [messageFlow, setMessageFlow] = useState([]);
  const svgRef = useRef(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (meshData) {
      if (meshData.nodes) setNodes(meshData.nodes);
      if (meshData.health) setHealth(meshData.health);
      if (meshData.relay_paths) setRelayPaths(meshData.relay_paths);
      if (meshData.messages && Array.isArray(meshData.messages)) {
        setMessageFlow(prev => {
          const newMsgs = meshData.messages.filter(m =>
            !prev.some(p => p.id === m.id)
          );
          return [...newMsgs, ...prev].slice(0, 20);
        });
      }
    }
  }, [meshData]);

  async function loadData() {
    try {
      const [nodesData, messagesData, healthData, relayData] = await Promise.all([
        fetchMeshNodes(),
        fetchMeshMessages(),
        fetchMeshHealth(),
        fetchMeshRelayPaths(),
      ]);
      setNodes(nodesData);
      setMessages(messagesData);
      setHealth(healthData);
      setRelayPaths(relayData);
    } catch (e) {
      console.error('Failed to load mesh data:', e);
    }
  }

  function getNodePos(node) {
    const x = ((node.longitude - 72.5) / 0.5) * 700 + 100;
    const y = ((node.latitude - 23.0) / 0.5) * 400 + 80;
    return { x, y };
  }

  return (
    <div className="space-y-5">
      {/* Health Metrics */}
      {health && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Active Nodes', value: health.active_nodes, icon: '📡', color: 'text-golden' },
            { label: 'Total Nodes', value: health.total_nodes, icon: '🌐', color: 'text-violet-400' },
            { label: 'Avg Battery', value: `${health.avg_battery?.toFixed(0)}%`, icon: '🔋', color: 'text-emerald-400' },
            { label: 'Messages Relayed', value: health.messages_relayed, icon: '📨', color: 'text-amber-400' },
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* SVG Topology */}
        <div className="xl:col-span-2 rounded-2xl bg-panel border border-theme p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white">🌐 Network Topology</h3>
            <div className="flex items-center gap-2">
              {isConnected && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
                  LIVE
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
              const src = nodes.find(n => n.id === path.source_node);
              const dst = nodes.find(n => n.id === path.target_node);
              if (!src || !dst) return null;
              const p1 = getNodePos(src);
              const p2 = getNodePos(dst);
              return (
                <g key={`path-${i}`}>
                  <line
                    x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                    stroke="rgba(139,92,246,0.15)"
                    strokeWidth="1"
                  />
                  {/* Animated data packet */}
                  {path.active && (
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
              const colors = NODE_COLORS[node.type] || NODE_COLORS.CIVILIAN;
              const isSelected = selectedNode?.id === node.id;
              return (
                <g
                  key={node.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedNode(node)}
                >
                  {/* Glow */}
                  <circle cx={pos.x} cy={pos.y} r="18" fill={colors.glow} opacity={node.is_relaying ? 0.6 : 0.2}>
                    {node.is_relaying && (
                      <animate attributeName="r" values="18;28;18" dur="1s" repeatCount="indefinite" />
                    )}
                  </circle>
                  {/* Battery ring */}
                  <circle
                    cx={pos.x} cy={pos.y} r="14"
                    fill="none"
                    stroke={colors.stroke}
                    strokeWidth="2"
                    strokeDasharray={`${(node.battery / 100) * 88} 88`}
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
                    fill={node.battery > 50 ? '#A78BFA' : node.battery > 20 ? '#F59E0B' : '#EF4444'}
                    fontFamily="sans-serif"
                  >
                    {node.battery?.toFixed(0)}%
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
                  <h4 className="text-base font-bold text-white">{selectedNode.id}</h4>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/20">
                    {TYPE_LABELS[selectedNode.type]?.split(' ')[0]} {selectedNode.type}
                  </span>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-surface-400">Owner</span>
                    <span className="text-white">{selectedNode.owner_name || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-400">Village</span>
                    <span className="text-white">{selectedNode.village}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-400">Battery</span>
                    <span className={`font-mono ${selectedNode.battery > 50 ? 'text-emerald-400' : selectedNode.battery > 20 ? 'text-amber-400' : 'text-red-400'}`}>
                      {selectedNode.battery?.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-400">Signal</span>
                    <span className="text-violet-400 font-mono">{selectedNode.signal_strength?.toFixed(1)} dBm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-400">Status</span>
                    <span className={selectedNode.is_active ? 'text-emerald-400' : 'text-red-400'}>
                      {selectedNode.is_active ? '● Active' : '○ Inactive'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-400">Relaying</span>
                    <span className={selectedNode.is_relaying ? 'text-golden' : 'text-surface-500'}>
                      {selectedNode.is_relaying ? '⚡ Yes' : 'No'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="mt-3 w-full text-xs text-surface-400 hover:text-white py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all"
                >
                  Close
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Message Flow */}
          <div className="rounded-2xl bg-panel border border-theme p-5">
            <h4 className="text-base font-semibold text-white mb-3">📨 Message Flow</h4>
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
                    {msg.via_path?.join(' → ')}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Clusters */}
          <div className="rounded-2xl bg-panel border border-theme p-5">
            <h4 className="text-base font-semibold text-white mb-3">🔗 Clusters</h4>
            <div className="space-y-2">
              {Object.entries(health?.clusters || {}).map(([name, info]) => (
                <div key={name} className="text-sm p-3 rounded-xl bg-panel border border-theme">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-medium">{name}</span>
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
