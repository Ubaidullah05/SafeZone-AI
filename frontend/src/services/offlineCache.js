/**
 * Offline Data Cache
 * ==================
 * IndexedDB-backed cache for offline capability.
 * Stores village data, SOS reports, mesh nodes, and user session.
 */
import { openDB } from 'idb'

const DB_NAME = 'safezone-ai-db'
const DB_VERSION = 1

const STORES = {
  VILLAGES: 'villages',
  SAFE_ZONES: 'safeZones',
  SOS_REPORTS: 'sosReports',
  MESH_DATA: 'meshData',
  OPERATIONAL_PRIORITY: 'operationalPriority',
  GROUND_REALITY: 'groundReality',
  SESSION: 'session',
  META: 'meta',
}

let dbPromise = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORES.VILLAGES)) {
          db.createObjectStore(STORES.VILLAGES, { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains(STORES.SAFE_ZONES)) {
          db.createObjectStore(STORES.SAFE_ZONES, { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains(STORES.SOS_REPORTS)) {
          db.createObjectStore(STORES.SOS_REPORTS, { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains(STORES.MESH_DATA)) {
          db.createObjectStore(STORES.MESH_DATA)
        }
        if (!db.objectStoreNames.contains(STORES.OPERATIONAL_PRIORITY)) {
          db.createObjectStore(STORES.OPERATIONAL_PRIORITY, { keyPath: 'village_id' })
        }
        if (!db.objectStoreNames.contains(STORES.GROUND_REALITY)) {
          db.createObjectStore(STORES.GROUND_REALITY, { keyPath: 'village_id' })
        }
        if (!db.objectStoreNames.contains(STORES.SESSION)) {
          db.createObjectStore(STORES.SESSION)
        }
        if (!db.objectStoreNames.contains(STORES.META)) {
          db.createObjectStore(STORES.META)
        }
      },
    })
  }
  return dbPromise
}

// Generic helpers
async function putItem(storeName, key, value) {
  const db = await getDB()
  await db.put(storeName, value, key)
}

async function getItem(storeName, key) {
  const db = await getDB()
  return db.get(storeName, key)
}

async function getAllItems(storeName) {
  const db = await getDB()
  return db.getAll(storeName)
}

async function clearStore(storeName) {
  const db = await getDB()
  await db.clear(storeName)
}

// ---- Village data ----
export async function cacheVillages(villages) {
  const db = await getDB()
  const tx = db.transaction(STORES.VILLAGES, 'readwrite')
  for (const v of villages) {
    tx.store.put(v)
  }
  await tx.done
}

export async function getCachedVillages() {
  return getAllItems(STORES.VILLAGES)
}

// ---- Safe zones ----
export async function cacheSafeZones(zones) {
  const db = await getDB()
  const tx = db.transaction(STORES.SAFE_ZONES, 'readwrite')
  for (const z of zones) {
    tx.store.put(z)
  }
  await tx.done
}

export async function getCachedSafeZones() {
  return getAllItems(STORES.SAFE_ZONES)
}

// ---- SOS Reports ----
export async function cacheSOSReports(reports) {
  const db = await getDB()
  const tx = db.transaction(STORES.SOS_REPORTS, 'readwrite')
  await tx.store.clear()
  for (const r of reports) {
    tx.store.put(r)
  }
  await tx.done
}

export async function getCachedSOSReports() {
  return getAllItems(STORES.SOS_REPORTS)
}

export async function addCachedSOSReport(report) {
  await putItem(STORES.SOS_REPORTS, report.id, report)
}

// ---- Mesh data ----
export async function cacheMeshData(data) {
  await putItem(STORES.MESH_DATA, 'current', data)
}

export async function getCachedMeshData() {
  return getItem(STORES.MESH_DATA, 'current')
}

// ---- Ground reality ----
export async function cacheGroundReality(data) {
  const db = await getDB()
  const tx = db.transaction(STORES.GROUND_REALITY, 'readwrite')
  await tx.store.clear()
  for (const item of data) {
    tx.store.put(item)
  }
  await tx.done
}

export async function getCachedGroundReality() {
  return getAllItems(STORES.GROUND_REALITY)
}

// ---- Operational priority ----
export async function cacheOperationalPriority(data) {
  const db = await getDB()
  const tx = db.transaction(STORES.OPERATIONAL_PRIORITY, 'readwrite')
  await tx.store.clear()
  for (const item of data) {
    tx.store.put(item)
  }
  await tx.done
}

export async function getCachedOperationalPriority() {
  return getAllItems(STORES.OPERATIONAL_PRIORITY)
}

// ---- Session ----
export async function cacheSession(token, user) {
  await putItem(STORES.SESSION, 'auth', { token, user, cachedAt: Date.now() })
}

export async function getCachedSession() {
  return getItem(STORES.SESSION, 'auth')
}

export async function clearSession() {
  await clearStore(STORES.SESSION)
}

// ---- Meta (timestamp tracking) ----
export async function setCacheTimestamp(key) {
  await putItem(STORES.META, key, { timestamp: Date.now() })
}

export async function getCacheTimestamp(key) {
  const meta = await getItem(STORES.META, key)
  return meta?.timestamp || 0
}

// ---- Bulk cache from offline manifest ----
export async function cacheOfflineManifest(manifest) {
  try {
    if (manifest.villages) await cacheVillages(manifest.villages)
    if (manifest.safe_zones) await cacheSafeZones(manifest.safe_zones)
    if (manifest.sos_reports) await cacheSOSReports(manifest.sos_reports)
    if (manifest.mesh_nodes) {
      await cacheMeshData({
        nodes: manifest.mesh_nodes,
        health: manifest.mesh_health || {},
      })
    }
    if (manifest.ground_reality) await cacheGroundReality(manifest.ground_reality)
    if (manifest.operational_priority) await cacheOperationalPriority(manifest.operational_priority)
    await setCacheTimestamp('last_manifest_sync')
    return true
  } catch (e) {
    console.error('Failed to cache offline manifest:', e)
    return false
  }
}

// ---- Check if cache is stale (>5 minutes old) ----
export async function isCacheStale(maxAgeMs = 5 * 60 * 1000) {
  const lastSync = await getCacheTimestamp('last_manifest_sync')
  return Date.now() - lastSync > maxAgeMs
}

export default {
  cacheVillages,
  getCachedVillages,
  cacheSafeZones,
  getCachedSafeZones,
  cacheSOSReports,
  getCachedSOSReports,
  addCachedSOSReport,
  cacheMeshData,
  getCachedMeshData,
  cacheGroundReality,
  getCachedGroundReality,
  cacheOperationalPriority,
  getCachedOperationalPriority,
  cacheSession,
  getCachedSession,
  clearSession,
  cacheOfflineManifest,
  isCacheStale,
}
