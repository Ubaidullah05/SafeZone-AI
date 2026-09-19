/**
 * SafeLink-AI Service Worker
 * ==========================
 * Offline support with cache-first strategy for the app shell and
 * network-first (cache fallback) for API responses.
 * Background sync queues offline SOS submissions for replay when back online.
 */

const CACHE_NAME = 'safelink-v4'
const STATIC_CACHE = 'safelink-static-v4'
const API_CACHE = 'safelink-api-v4'

// App shell files to pre-cache
const APP_SHELL = [
  '/',
  '/login',
  '/manifest.json',
]

// Install: cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL))
  )
  self.skipWaiting()
})

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !key.endsWith('-v4'))
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  )
})

// Fetch: network-first for API, cache-first for static
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // API requests: network-first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (request.method === 'GET' && response.ok) {
            const clone = response.clone()
            caches.open(API_CACHE).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() =>
          caches.match(request).then((cached) => {
            if (cached) return cached
            return new Response(JSON.stringify({ error: 'offline' }), {
              headers: { 'Content-Type': 'application/json' },
              status: 503,
            })
          })
        )
    )
    return
  }

  // Static assets: stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone))
        }
        return response
      }).catch(() => {
        if (request.mode === 'navigate') {
          return caches.match('/')
        }
        return new Response('', { status: 408 })
      })
      return cached || fetchPromise
    })
  )
})

// Background sync builds up while offline and replays when back online.
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
          // Will retry on next sync
        }
      }
      resolve()
    }
    request.onerror = () => resolve()
  })
}

// Must match src/services/offlineCache.js (DB_NAME / SOS store name).
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('safezone-ai-db', 1)
    request.onerror = () => reject(request.error)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('sosReports')) {
        db.createObjectStore('sosReports', { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
  })
}

// Push notifications (future)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json()
    event.waitUntil(
      self.registration.showNotification(data.title || 'SafeLink-AI', {
        body: data.body || 'New emergency alert',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200],
        tag: 'safelink-alert',
      })
    )
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.openWindow('/')
  )
})