/**
 * SafeZone-AI Service Worker
 * ==========================
 * Offline support for the evacuation app.
 *
 * Strategies
 *   navigation  -> network-first, fall back to the cached app shell
 *   /api/ GET   -> network-first, fall back to the last good response
 *   map tiles   -> cache-first, so a region you already viewed stays visible
 *                  with no connectivity
 *   other GET   -> stale-while-revalidate
 *   non-GET     -> never intercepted; always goes to the network
 *
 * CACHE_VERSION and PRECACHE_MANIFEST are rewritten after `vite build` by
 * scripts/generate-sw.mjs, which injects the hashed asset list so a fresh
 * build always evicts the previous cache. The literals below are the
 * dev/unbuilt fallback and are perfectly valid on their own.
 */

const CACHE_VERSION = 'dev'; // __SW_BUILD_ID__
const PRECACHE_MANIFEST = []; // __SW_PRECACHE__

const STATIC_CACHE = `safezone-static-${CACHE_VERSION}`
const API_CACHE = `safezone-api-${CACHE_VERSION}`
const TILE_CACHE = `safezone-tiles-${CACHE_VERSION}`
const CURRENT_CACHES = new Set([STATIC_CACHE, API_CACHE, TILE_CACHE])
// Both prefixes are purged: 'safelink-' is the pre-rename prefix, so a
// returning user still gets their old stale caches deleted.
const CACHE_PREFIXES = ['safezone-', 'safelink-']

// Always present, even in dev where PRECACHE_MANIFEST is empty.
const CORE_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
]

// Cap the tile cache so a long session cannot fill the device's storage.
const MAX_TILE_ENTRIES = 600

const TILE_HOST_PATTERN = /(^|\.)tile\.openstreetmap\.org$/

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE)
      const assets = [...new Set([...CORE_ASSETS, ...PRECACHE_MANIFEST])]
      // Individually, so one bad URL cannot void the whole install.
      const results = await Promise.allSettled(
        assets.map((url) => cache.add(new Request(url, { cache: 'reload' }))),
      )
      const failed = results
        .map((r, i) => (r.status === 'rejected' ? assets[i] : null))
        .filter(Boolean)
      if (failed.length) {
        console.warn('[sw] Could not precache:', failed)
      }
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter(
            (key) =>
              CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)) &&
              !CURRENT_CACHES.has(key),
          )
          .map((key) => caches.delete(key)),
      )
      if ('navigationPreload' in self.registration) {
        await self.registration.navigationPreload.enable()
      }
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isTileRequest(url) {
  return url.hostname === 'tile.openstreetmap.org' || TILE_HOST_PATTERN.test(url.hostname)
}

/**
 * Cache lookup that ignores Vary.
 *
 * Vite serves assets with `Vary: Origin`, but the precache requests are
 * issued from the service worker (no Origin header) while the page's module
 * and stylesheet requests do send one. A default caches.match() honours Vary,
 * compares those two, finds them different, and MISSES - so a fully
 * precached app still fails to boot offline. ignoreVary is the standard fix
 * for app-shell precaching.
 */
function matchCache(request) {
  return caches.match(request, { ignoreVary: true })
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  if (keys.length <= maxEntries) return
  // Cache keys are returned in insertion order, so the head is oldest.
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((k) => cache.delete(k)))
}

async function cacheFirst(request, cacheName) {
  const cached = await matchCache(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok || response.type === 'opaque') {
    const cache = await caches.open(cacheName)
    await cache.put(request, response.clone())
    trimCache(cacheName, MAX_TILE_ENTRIES)
  }
  return response
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      await cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    const cached = await matchCache(request)
    if (cached) return cached
    throw error
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cached = await matchCache(request)
  const network = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(cacheName)
        await cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => undefined)
  return cached || (await network) || Response.error()
}

async function offlineShellResponse() {
  const cached = await matchCache('/')
  return (
    cached ||
    new Response(
      '<!doctype html><meta charset="utf-8"><title>Offline</title>' +
        '<body style="font:16px system-ui;background:#0C0A1A;color:#fff;' +
        'display:grid;place-items:center;height:100vh;margin:0;text-align:center">' +
        '<div><h1>You are offline</h1>' +
        '<p>SafeZone-AI has not finished caching this page yet.</p>' +
        '<p>Reconnect once to enable full offline use.</p></div>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  )
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Only reads are cacheable. Never intercept writes: a queued SOS must
  // reach the server, not be answered from a cache.
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Map tiles: cache-first so previously viewed areas survive going offline.
  if (isTileRequest(url)) {
    event.respondWith(
      cacheFirst(request, TILE_CACHE).catch(
        () => new Response('', { status: 504, statusText: 'Tile unavailable offline' }),
      ),
    )
    return
  }

  // Anything cross-origin that is not a tile: stay out of the way.
  if (url.origin !== self.location.origin) return

  // API reads: fresh data when online, last-known data when not.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      networkFirst(request, API_CACHE).catch(
        async () =>
          (await matchCache(request)) ||
          new Response(JSON.stringify({ error: 'offline', detail: 'No cached response available.' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    )
    return
  }

  // Client-side routes: always resolve to the app shell so deep links and
  // refreshes work offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const preload = await event.preloadResponse
          if (preload) return preload
          return await fetch(request)
        } catch {
          return offlineShellResponse()
        }
      })(),
    )
    return
  }

  event.respondWith(staleWhileRevalidate(request, STATIC_CACHE))
})

// ---------------------------------------------------------------------------
// Background sync for queued SOS reports
// ---------------------------------------------------------------------------

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-sos') {
    event.waitUntil(syncOfflineSOS())
  }
})

async function syncOfflineSOS() {
  const db = await openDB()
  const tx = db.transaction('sosReports', 'readonly')
  const store = tx.objectStore('sosReports')
  const request = store.getAll()

  return new Promise((resolve) => {
    request.onsuccess = async () => {
      const reports = request.result || []
      for (const report of reports) {
        if (report.status !== 'PENDING_SYNC') continue
        try {
          const payload = { ...report }
          delete payload.id
          delete payload.status
          delete payload.priority_score
          const res = await fetch('/api/sos/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          if (res.ok) {
            const deleteTx = db.transaction('sosReports', 'readwrite')
            await deleteTx.objectStore('sosReports').delete(report.id)
          }
        } catch {
          // Will retry on the next sync.
        }
      }
      resolve()
    }
    request.onerror = () => resolve()
  })
}

// Must match src/services/offlineCache.ts exactly: same DB name, same version,
// and the same set of object stores.
//
// onupgradeneeded only fires when the version increases, so whichever of the
// two opens the database first creates the schema for both. Creating only the
// two stores this file used to create left the other six missing for the
// lifetime of the database, which silently broke offline caching.
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('safezone-ai-db', 2)
    request.onerror = () => reject(request.error)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('villages')) db.createObjectStore('villages', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('safeZones')) db.createObjectStore('safeZones', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('sosReports')) db.createObjectStore('sosReports', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('operationalPriority')) db.createObjectStore('operationalPriority', { keyPath: 'village_id' })
      if (!db.objectStoreNames.contains('groundReality')) db.createObjectStore('groundReality', { keyPath: 'village_id' })
      if (!db.objectStoreNames.contains('session')) db.createObjectStore('session')
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta')
      if (!db.objectStoreNames.contains('keyValue')) db.createObjectStore('keyValue', { keyPath: 'key' })
    }
    request.onsuccess = () => resolve(request.result)
  })
}

// ---------------------------------------------------------------------------
// Push notifications
// ---------------------------------------------------------------------------

self.addEventListener('push', (event) => {
  if (!event.data) return
  let data = {}
  try {
    data = event.data.json()
  } catch {
    data = { body: event.data.text() }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'SafeZone-AI', {
      body: data.body || 'New emergency alert',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      tag: 'safezone-alert',
      data: { url: data.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url || '/'
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of all) {
        if (new URL(client.url).pathname === target && 'focus' in client) {
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    })(),
  )
})
