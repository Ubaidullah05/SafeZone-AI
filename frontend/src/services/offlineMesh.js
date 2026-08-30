/**
 * Offline Mesh Messaging Engine
 * =============================
 * Full mesh network simulation that runs entirely in the browser.
 * Uses IndexedDB for persistent storage. No backend needed.
 * 
 * Features:
 * - Multi-hop message relay simulation
 * - Store-and-forward when no route exists
 * - Battery drain simulation
 * - Signal strength simulation
 * - Auto-delivery when route becomes available
 * - Offline SOS submission and queue
 */

const DB_NAME = 'safelink-mesh'
const DB_VERSION = 1

// ---- Demo mesh nodes ----
const DEMO_NODES = [
  { id: 'NODE001', type: 'GATEWAY', owner_name: 'Rajesh Kumar', village: 'Amrapur', village_id: 'VIL001', latitude: 30.15, longitude: 78.46, battery: 85, signal_strength: -45, is_active: true, is_relaying: false },
  { id: 'NODE002', type: 'GATEWAY', owner_name: 'Priya Singh', village: 'Ganganagar', village_id: 'VIL002', latitude: 30.18, longitude: 78.52, battery: 72, signal_strength: -52, is_active: true, is_relaying: false },
  { id: 'NODE003', type: 'GATEWAY', owner_name: 'Amit Verma', village: 'Bhairavgarh', village_id: 'VIL003', latitude: 30.12, longitude: 78.48, battery: 68, signal_strength: -48, is_active: true, is_relaying: false },
  { id: 'NODE004', type: 'VOLUNTEER', owner_name: 'Sunita Devi', village: 'Nandagaon', village_id: 'VIL004', latitude: 30.20, longitude: 78.44, battery: 45, signal_strength: -60, is_active: true, is_relaying: false },
  { id: 'NODE005', type: 'VOLUNTEER', owner_name: 'Vikram Patel', village: 'Sundarpur', village_id: 'VIL005', latitude: 30.08, longitude: 78.50, battery: 52, signal_strength: -58, is_active: true, is_relaying: false },
  { id: 'NODE006', type: 'VOLUNTEER', owner_name: 'Geeta Sharma', village: 'Lakshmangarh', village_id: 'VIL006', latitude: 30.22, longitude: 78.55, battery: 38, signal_strength: -65, is_active: true, is_relaying: false },
  { id: 'NODE007', type: 'VOLUNTEER', owner_name: 'Ravi Gupta', village: 'Kailashpur', village_id: 'VIL007', latitude: 30.10, longitude: 78.42, battery: 60, signal_strength: -55, is_active: true, is_relaying: false },
  { id: 'NODE008', type: 'RESCUE', owner_name: 'Dr. Anita Rao', village: 'Manikpur', village_id: 'VIL008', latitude: 30.25, longitude: 78.58, battery: 90, signal_strength: -42, is_active: true, is_relaying: false },
  { id: 'NODE009', type: 'RESCUE', owner_name: 'Fire Chief Mohan', village: 'Shivpuri', village_id: 'VIL009', latitude: 30.05, longitude: 78.55, battery: 88, signal_strength: -44, is_active: true, is_relaying: false },
  { id: 'NODE010', type: 'CIVILIAN', owner_name: 'Ramesh Yadav', village: 'Rishikot', village_id: 'VIL010', latitude: 30.16, longitude: 78.60, battery: 35, signal_strength: -70, is_active: true, is_relaying: false },
  { id: 'NODE011', type: 'CIVILIAN', owner_name: 'Kamla Devi', village: 'Devigram', village_id: 'VIL011', latitude: 30.07, longitude: 78.38, battery: 28, signal_strength: -72, is_active: true, is_relaying: false },
  { id: 'NODE012', type: 'CIVILIAN', owner_name: 'Suresh Jain', village: 'Champawali', village_id: 'VIL012', latitude: 30.28, longitude: 78.40, battery: 15, signal_strength: -78, is_active: false, is_relaying: false },
  { id: 'NODE013', type: 'CIVILIAN', owner_name: 'Meena Kumari', village: 'Amrapur', village_id: 'VIL001', latitude: 30.14, longitude: 78.45, battery: 42, signal_strength: -68, is_active: true, is_relaying: false },
  { id: 'NODE014', type: 'CIVILIAN', owner_name: 'Deepak Singh', village: 'Ganganagar', village_id: 'VIL002', latitude: 30.19, longitude: 78.53, battery: 55, signal_strength: -55, is_active: true, is_relaying: false },
  { id: 'NODE015', type: 'CIVILIAN', owner_name: 'Ashok Kumar', village: 'Bhairavgarh', village_id: 'VIL003', latitude: 30.11, longitude: 78.49, battery: 62, signal_strength: -50, is_active: true, is_relaying: false },
  { id: 'NODE016', type: 'CIVILIAN', owner_name: 'Sita Ram', village: 'Nandagaon', village_id: 'VIL004', latitude: 30.21, longitude: 78.43, battery: 48, signal_strength: -62, is_active: true, is_relaying: false },
  { id: 'NODE017', type: 'CIVILIAN', owner_name: 'Lakshmi Bai', village: 'Sundarpur', village_id: 'VIL005', latitude: 30.09, longitude: 78.51, battery: 70, signal_strength: -48, is_active: true, is_relaying: false },
]

// Communication ranges by type (meters)
const RANGES = { CIVILIAN: 2000, VOLUNTEER: 3500, RESCUE: 4000, GATEWAY: 8000 }

// ---- IndexedDB helpers ----
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('messages')) {
        db.createObjectStore('messages', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('sos_queue')) {
        db.createObjectStore('sos_queue', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('sync_log')) {
        db.createObjectStore('sync_log', { keyPath: 'id' })
      }
    }
  })
}

async function dbPut(store, data) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).put(data)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function dbGetAll(store) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const request = tx.objectStore(store).getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function dbDelete(store, id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ---- Distance calculation (Haversine) ----
function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ---- BFS multi-hop routing ----
function findRoute(nodes, sourceId, destId) {
  const activeNodes = nodes.filter(n => n.is_active && n.battery > 5)
  const source = activeNodes.find(n => n.id === sourceId)
  if (!source) return null

  const visited = new Set([sourceId])
  const queue = [[sourceId]]
  const neighbors = {}

  // Build adjacency list based on communication ranges
  for (const node of activeNodes) {
    neighbors[node.id] = []
    for (const other of activeNodes) {
      if (node.id === other.id) continue
      const dist = distanceMeters(node.latitude, node.longitude, other.latitude, other.longitude)
      const maxRange = Math.max(RANGES[node.type] || 2000, RANGES[other.type] || 2000)
      if (dist <= maxRange) {
        neighbors[node.id].push(other.id)
      }
    }
  }

  while (queue.length > 0) {
    const path = queue.shift()
    const current = path[path.length - 1]
    if (current === destId) return path

    for (const next of (neighbors[current] || [])) {
      if (!visited.has(next)) {
        visited.add(next)
        queue.push([...path, next])
      }
    }
  }

  return null // No route found
}

// ---- Find gateway (nearest active gateway) ----
function findGateway(nodes, nodeId) {
  const node = nodes.find(n => n.id === nodeId)
  if (!node) return null
  const gateways = nodes.filter(n => n.type === 'GATEWAY' && n.is_active && n.battery > 5)
  if (gateways.length === 0) return null
  return gateways.reduce((closest, gw) => {
    const d1 = distanceMeters(node.latitude, node.longitude, closest.latitude, closest.longitude)
    const d2 = distanceMeters(node.latitude, node.longitude, gw.latitude, gw.longitude)
    return d2 < d1 ? gw : closest
  })
}

// ---- Main engine ----
let _nodes = [...DEMO_NODES]
let _messages = []
let _tickCount = 0

// Initialize: load from IndexedDB
export async function initMeshEngine() {
  try {
    const stored = await dbGetAll('messages')
    _messages = stored.length > 0 ? stored : []
  } catch {
    _messages = []
  }
}

// Get current node states (with simulated battery drain)
export function getNodes() {
  return _nodes.map(n => ({
    ...n,
    battery: Math.max(0, n.battery - Math.random() * 0.05),
    signal_strength: n.signal_strength + (Math.random() * 4 - 2),
    is_relaying: _messages.some(m => m.status === 'IN_TRANSIT' && m.via_path?.includes(n.id)),
  }))
}

// Get health stats
export function getHealth() {
  const nodes = getNodes()
  const active = nodes.filter(n => n.is_active)
  const totalMessages = _messages.length
  const delivered = _messages.filter(m => m.status === 'DELIVERED').length

  const clusters = {}
  const gateways = nodes.filter(n => n.type === 'GATEWAY')
  gateways.forEach(gw => {
    const members = nodes.filter(n => {
      if (n.id === gw.id) return true
      const dist = distanceMeters(gw.latitude, gw.longitude, n.latitude, n.longitude)
      return dist <= RANGES.GATEWAY
    })
    clusters[gw.village] = {
      leader: gw.id,
      members: members.map(m => m.id),
      coverage_km: Math.round(RANGES.GATEWAY / 1000),
      avg_range: Math.round((RANGES.CIVILIAN + RANGES.VOLUNTEER) / 2),
    }
  })

  return {
    total_nodes: nodes.length,
    active_nodes: active.length,
    relaying_nodes: nodes.filter(n => n.is_relaying).length,
    gateways: nodes.filter(n => n.type === 'GATEWAY').length,
    avg_battery: active.reduce((s, n) => s + n.battery, 0) / (active.length || 1),
    messages_relayed: delivered,
    messages_in_transit: _messages.filter(m => m.status === 'IN_TRANSIT').length,
    clusters,
    tick: _tickCount,
  }
}

// Get relay paths for visualization
export function getRelayPaths() {
  const nodes = getNodes()
  const paths = []
  const activeNodes = nodes.filter(n => n.is_active)

  // Build all possible connections
  for (const node of activeNodes) {
    for (const other of activeNodes) {
      if (node.id >= other.id) continue
      const dist = distanceMeters(node.latitude, node.longitude, other.latitude, other.longitude)
      const maxRange = Math.max(RANGES[node.type] || 2000, RANGES[other.type] || 2000)
      if (dist <= maxRange) {
        const active = _messages.some(m =>
          m.status === 'IN_TRANSIT' && m.via_path?.includes(node.id) && m.via_path?.includes(other.id)
        )
        paths.push({
          source_node: node.id,
          target_node: other.id,
          distance_m: Math.round(dist),
          active,
          latency_ms: Math.round(100 + dist / 100),
        })
      }
    }
  }
  return paths
}

// Get message state
export function getMessages() {
  return {
    in_transit: _messages.filter(m => m.status === 'IN_TRANSIT'),
    delivered: _messages.filter(m => m.status === 'DELIVERED').slice(-20),
    relay_log: _messages.filter(m => m.status === 'DELIVERED').slice(-10).map(m => ({
      id: m.id,
      source: m.source,
      destination: m.destination,
      hops: m.hops,
      via_path: m.via_path,
      delivered_at: m.delivered_at,
    })),
  }
}

// Send a message through the mesh
export function sendMessage(sourceNodeId, destNodeId, payload, type = 'SOS') {
  const nodes = getNodes()
  const route = findRoute(nodes, sourceNodeId, destNodeId)

  const msg = {
    id: `MSG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    source: sourceNodeId,
    destination: destNodeId,
    payload,
    type,
    status: 'IN_TRANSIT',
    hops: 0,
    via_path: [],
    created_at: new Date().toISOString(),
    delivered_at: null,
  }

  if (route) {
    msg.via_path = route
    msg.hops = route.length - 1
    // Simulate relay: mark as delivered after delay based on hops
    const delay = 500 + msg.hops * 400
    setTimeout(() => {
      msg.status = 'DELIVERED'
      msg.delivered_at = new Date().toISOString()
      dbPut('messages', msg).catch(() => {})
    }, delay)
  } else {
    // No route — store and forward
    msg.status = 'STORED'
    msg.via_path = ['STORED']
    // Try to deliver later when nodes come online
    const retryInterval = setInterval(() => {
      const currentNodes = getNodes()
      const newRoute = findRoute(currentNodes, sourceNodeId, destNodeId)
      if (newRoute) {
        clearInterval(retryInterval)
        msg.via_path = newRoute
        msg.hops = newRoute.length - 1
        msg.status = 'IN_TRANSIT'
        setTimeout(() => {
          msg.status = 'DELIVERED'
          msg.delivered_at = new Date().toISOString()
          dbPut('messages', msg).catch(() => {})
        }, 500 + msg.hops * 400)
      }
    }, 5000)
  }

  _messages.push(msg)
  dbPut('messages', msg).catch(() => {})
  return msg
}

// Submit SOS through mesh (finds nearest node in same village)
export function submitOfflineSOS(sosData) {
  const nodes = getNodes()
  // Find a node in the same village
  let sourceNode = nodes.find(n => n.village_id === sosData.village_id && n.is_active)
  if (!sourceNode) sourceNode = nodes[0] // fallback to gateway

  // Find any gateway to route to
  const gateway = findGateway(nodes, sourceNode.id)
  const destId = gateway ? gateway.id : (nodes.find(n => n.type === 'GATEWAY')?.id || nodes[0].id)

  const msg = sendMessage(sourceNode.id, destId, {
    type: 'SOS',
    emergency_type: sosData.emergency_type,
    severity: sosData.severity,
    description: sosData.description,
    people_affected: sosData.people_affected,
    medical_emergency: sosData.medical_emergency,
    reporter_name: sosData.reporter_name,
    village: sosData.village_name,
    latitude: sosData.latitude,
    longitude: sosData.longitude,
  }, 'SOS')

  // Also store in SOS queue for sync
  const sosReport = {
    id: `SOS-${Date.now()}`,
    ...sosData,
    message_id: msg.id,
    relay_hops: msg.hops,
    relay_via: msg.via_path,
    status: 'NEW',
    priority_score: calculatePriority(sosData),
    timestamp: new Date().toISOString(),
  }

  dbPut('sos_queue', sosReport).catch(() => {})
  return { message: msg, report: sosReport }
}

// Calculate SOS priority
function calculatePriority(data) {
  let score = 0
  score += (data.severity || 3) * 15
  score += Math.min((data.people_affected || 1) / 100, 25)
  if (data.medical_emergency) score += 20
  const typeWeights = { FLOOD: 8, EARTHQUAKE: 10, TRAPPED: 12, MEDICAL: 9, FIRE: 11 }
  score += typeWeights[data.emergency_type] || 5
  return Math.round(Math.min(score, 100))
}

// Get all queued SOS reports
export async function getOfflineSOSQueue() {
  return dbGetAll('sos_queue')
}

// Clear delivered messages from queue
export async function clearDeliveredFromQueue() {
  const msgs = await dbGetAll('messages')
  for (const m of msgs) {
    if (m.status === 'DELIVERED') {
      await dbDelete('messages', m.id).catch(() => {})
    }
  }
}

// Sync offline SOS with server (when online)
export async function syncOfflineSOS() {
  if (!navigator.onLine) return { synced: 0 }
  const queue = await getOfflineSOSQueue()
  let synced = 0
  for (const report of queue) {
    try {
      const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
      await fetch(`${API_BASE}/api/sos/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      })
      await dbDelete('sos_queue', report.id)
      synced++
    } catch {
      // Will retry next time
    }
  }
  return { synced }
}

// Tick simulation (battery drain, signal fluctuation)
export function tick() {
  _tickCount++
  _nodes = _nodes.map(n => ({
    ...n,
    battery: Math.max(5, n.battery - Math.random() * 0.1),
    signal_strength: n.signal_strength + (Math.random() * 3 - 1.5),
  }))
}

// Start tick interval
let _tickInterval = null
export function startTick() {
  if (_tickInterval) return
  _tickInterval = setInterval(tick, 2000)
}

export function stopTick() {
  if (_tickInterval) {
    clearInterval(_tickInterval)
    _tickInterval = null
  }
}

export default {
  initMeshEngine,
  getNodes,
  getHealth,
  getRelayPaths,
  getMessages,
  sendMessage,
  submitOfflineSOS,
  getOfflineSOSQueue,
  syncOfflineSOS,
  startTick,
  stopTick,
}
