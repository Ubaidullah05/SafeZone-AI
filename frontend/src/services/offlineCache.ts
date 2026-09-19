/**
 * Offline Data Cache
 * ==================
 * IndexedDB-backed cache for offline capability.
 * Stores village data, SOS reports, ground reality, and the user session.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { AuthSession, GroundRealityResult, OperationalPriorityItem, SafeZoneResult, SOSReport, VillageResult } from '../types'

interface CacheDb extends DBSchema {
  villages: { key: string; value: VillageResult }
  safeZones: { key: string; value: SafeZoneResult }
  sosReports: { key: string; value: SOSReport }
  operationalPriority: { key: string; value: OperationalPriorityItem }
  groundReality: { key: string; value: GroundRealityResult }
  session: { key: string; value: AuthSession }
  meta: { key: string; value: { timestamp: number } }
}

const DB_NAME = 'safezone-ai-db'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<CacheDb>> | null = null

function getDB(): Promise<IDBPDatabase<CacheDb>> {
  if (!dbPromise) {
    dbPromise = openDB<CacheDb>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('villages')) db.createObjectStore('villages', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('safeZones')) db.createObjectStore('safeZones', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('sosReports')) db.createObjectStore('sosReports', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('operationalPriority')) db.createObjectStore('operationalPriority', { keyPath: 'village_id' })
        if (!db.objectStoreNames.contains('groundReality')) db.createObjectStore('groundReality', { keyPath: 'village_id' })
        if (!db.objectStoreNames.contains('session')) db.createObjectStore('session')
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta')
      },
    })
  }
  return dbPromise
}

// ---- Village data ----
export async function cacheVillages(villages: VillageResult[]) {
  const db = await getDB()
  const tx = db.transaction('villages', 'readwrite')
  for (const v of villages) tx.store.put(v)
  await tx.done
}

export async function getCachedVillages(): Promise<VillageResult[]> {
  const db = await getDB()
  return db.getAll('villages')
}

// ---- Safe zones ----
export async function cacheSafeZones(zones: SafeZoneResult[]) {
  const db = await getDB()
  const tx = db.transaction('safeZones', 'readwrite')
  for (const z of zones) tx.store.put(z)
  await tx.done
}

export async function getCachedSafeZones(): Promise<SafeZoneResult[]> {
  const db = await getDB()
  return db.getAll('safeZones')
}

// ---- SOS Reports ----
export async function cacheSOSReports(reports: SOSReport[]) {
  const db = await getDB()
  const tx = db.transaction('sosReports', 'readwrite')
  await tx.store.clear()
  for (const r of reports) tx.store.put(r)
  await tx.done
}

export async function getCachedSOSReports(): Promise<SOSReport[]> {
  const db = await getDB()
  return db.getAll('sosReports')
}

export async function addCachedSOSReport(report: SOSReport) {
  const db = await getDB()
  await db.put('sosReports', report)
}

// ---- Ground reality ----
export async function cacheGroundReality(data: GroundRealityResult[]) {
  const db = await getDB()
  const tx = db.transaction('groundReality', 'readwrite')
  await tx.store.clear()
  for (const item of data) tx.store.put(item)
  await tx.done
}

export async function getCachedGroundReality(): Promise<GroundRealityResult[]> {
  const db = await getDB()
  return db.getAll('groundReality')
}

// ---- Operational priority ----
export async function cacheOperationalPriority(data: OperationalPriorityItem[]) {
  const db = await getDB()
  const tx = db.transaction('operationalPriority', 'readwrite')
  await tx.store.clear()
  for (const item of data) tx.store.put(item)
  await tx.done
}

export async function getCachedOperationalPriority(): Promise<OperationalPriorityItem[]> {
  const db = await getDB()
  return db.getAll('operationalPriority')
}

// ---- Session ----
export async function cacheSession(token: string, user: AuthSession['user']) {
  const db = await getDB()
  await db.put('session', { token, user, cachedAt: Date.now() })
}

export async function getCachedSession(): Promise<AuthSession | undefined> {
  const db = await getDB()
  return db.get('session', 'auth')
}

export async function clearSession() {
  const db = await getDB()
  await db.clear('session')
}

// ---- Meta (timestamp tracking) ----
export async function setCacheTimestamp(key: string) {
  const db = await getDB()
  await db.put('meta', { timestamp: Date.now() }, key)
}

export async function getCacheTimestamp(key: string): Promise<number> {
  const db = await getDB()
  const meta = await db.get('meta', key)
  return meta?.timestamp || 0
}

// ---- Bulk cache from offline manifest ----
export interface OfflineManifest {
  villages: VillageResult[]
  safe_zones: SafeZoneResult[]
  sos_reports: SOSReport[]
  ground_reality: GroundRealityResult[]
  operational_priority: OperationalPriorityItem[]
}

export async function cacheOfflineManifest(manifest: Partial<OfflineManifest>): Promise<boolean> {
  try {
    if (manifest.villages) await cacheVillages(manifest.villages)
    if (manifest.safe_zones) await cacheSafeZones(manifest.safe_zones)
    if (manifest.sos_reports) await cacheSOSReports(manifest.sos_reports)
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
export async function isCacheStale(maxAgeMs = 5 * 60 * 1000): Promise<boolean> {
  const lastSync = await getCacheTimestamp('last_manifest_sync')
  return Date.now() - lastSync > maxAgeMs
}