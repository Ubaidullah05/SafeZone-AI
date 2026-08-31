/**
 * SafeLink-AI Service Worker
 * ==========================
 * Full offline support with cache-first strategy.
 * Caches app shell, static assets, and API responses.
 * Supports background sync for SOS submissions.
 */

const CACHE_NAME = 'safelink-v3'
const STATIC_CACHE = 'safelink-static-v3'
const API_CACHE = 'safelink-api-v3'

// App shell files to pre-cache
const APP_SHELL = [
  '/',
  '/index.html',
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
          .filter((key) => key !== STATIC_CACHE && key !== API_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
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
          // Cache successful GET responses
          if (request.method === 'GET' && response.ok) {
            const clone = response.clone()
            caches.open(API_CACHE).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() => {
          // Offline: try cache
          return caches.match(request).then((cached) => {
            if (cached) return cached
            // Return offline JSON for key endpoints
            if (url.pathname.includes('/mesh/')) {
              return new Response(JSON.stringify({ nodes: [], health: {}, messages: [] }), {
                headers: { 'Content-Type': 'application/json' },
              })
            }
            return new Response(JSON.stringify({ error: 'offline' }), {
              headers: { 'Content-Type': 'application/json' },
              status: 503,
            })
          })
        })
    )
    return
  }

  // Static assets: stale-while-revalidate (serve cached, fetch fresh in background)
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone))
        }
        return response
      }).catch(() => {
        // Offline fallback for navigation
        if (request.mode === 'navigate') {
          return caches.match('/index.html')
        }
        return new Response('', { status: 408 })
      })
      return cached || fetchPromise
    })
  )
})

// Background sync for SOS submissions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-sos') {
    event.waitUntil(syncOfflineSOS())
  }
})

async function syncOfflineSOS() {
  // Open IndexedDB and get pending SOS
  const db = await openDB()
  const tx = db.transaction('sos_queue', 'readonly')
  const store = tx.objectStore('sos_queue')
  const request = store.getAll()

  return new Promise((resolve) => {
    request.onsuccess = async () => {
      const reports = request.result
      for (const report of reports) {
        try {
          await fetch('/api/sos/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(report),
          })
          // Remove from queue
          const deleteTx = db.transaction('sos_queue', 'readwrite')
          deleteTx.objectStore('sos_queue').delete(report.id)
        } catch {
          // Will retry on next sync
        }
      }
      resolve()
    }
    request.onerror = () => resolve()
  })
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('safelink-mesh', 1)
    request.onerror = () => reject(request.error)
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
