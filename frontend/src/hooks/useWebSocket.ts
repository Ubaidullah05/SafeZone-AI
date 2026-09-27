import { useState, useEffect, useCallback } from 'react'

export interface SosAlert {
  type: string
  active_count: number
  total_reports: number
  latest: { id: string; village_name: string; emergency_type: string; severity: number; timestamp: string }[]
  timestamp: string
}

interface AlertSocket {
  alerts: SosAlert | null
  connected: boolean
  send: (data: unknown) => boolean
}

/**
 * WebSocket origin for the alert stream.
 *
 * This used to be derived from `window.location.host`, which only works when
 * the API and the frontend share an origin. On the deployed split setup the
 * frontend is a static Vercel host and the API is on Render, so the socket was
 * pointed at Vercel, failed on every attempt, and left the panels polling REST
 * every 5s forever. Resolve the API origin first and only fall back to the
 * page origin when no override is configured (local dev behind the Vite proxy).
 */
function wsBase(): string {
  if (typeof window === 'undefined') return ''
  const api = import.meta.env.VITE_API_URL
  if (api) {
    try {
      const { protocol, host } = new URL(api)
      return `${protocol === 'https:' ? 'wss' : 'ws'}://${host}`
    } catch {
      // Malformed override; fall through to the page origin.
    }
  }
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${protocol}://${window.location.host}`
}

/**
 * One shared socket per origin.
 *
 * The dashboard and the SOS panel both want the alert stream. Giving each its
 * own `new WebSocket(...)` meant one SOS woke up two independent connections,
 * which doubled the per-connection poll the server does and made a single
 * civilian alert surface twice. Subscribers now share a single connection,
 * opened on first use and closed when the last consumer unmounts.
 */
type Subscriber = (alert: SosAlert) => void

const subscribers = new Set<Subscriber>()
let sharedSocket: WebSocket | null = null
let sharedRetry: ReturnType<typeof setTimeout> | null = null
let sharedRetryDelay = 1000
let consumerCount = 0

function openSharedSocket() {
  if (sharedSocket || subscribers.size === 0) return
  const url = `${wsBase()}/ws/alerts`

  let ws: WebSocket
  try {
    ws = new WebSocket(url)
  } catch {
    scheduleSharedReconnect()
    return
  }
  sharedSocket = ws

  ws.onopen = () => {
    sharedRetryDelay = 1000
  }

  ws.onmessage = (event) => {
    let data: SosAlert
    try {
      data = JSON.parse(event.data as string) as SosAlert
    } catch {
      return
    }
    // Snapshot: a handler may unsubscribe while we iterate.
    [...subscribers].forEach((fn) => {
      try {
        fn(data)
      } catch (err) {
        console.error('[ws] subscriber failed', err)
      }
    })
  }

  ws.onclose = () => {
    if (sharedSocket === ws) sharedSocket = null
    scheduleSharedReconnect()
  }

  ws.onerror = () => {
    // `onclose` always follows; reconnect is scheduled there.
  }
}

function scheduleSharedReconnect() {
  if (sharedRetry || subscribers.size === 0) return
  sharedRetryDelay = Math.min(sharedRetryDelay * 1.5, 10000)
  sharedRetry = setTimeout(() => {
    sharedRetry = null
    openSharedSocket()
  }, sharedRetryDelay)
}

function releaseSharedSocket() {
  if (sharedRetry) {
    clearTimeout(sharedRetry)
    sharedRetry = null
  }
  sharedRetryDelay = 1000
  if (sharedSocket) {
    const ws = sharedSocket
    sharedSocket = null
    ws.onclose = null
    ws.onerror = null
    ws.onmessage = null
    ws.onopen = null
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close()
  }
}

/** Whether a shared connection is currently open, for indicators and polling. */
export function isAlertSocketConnected(): boolean {
  return sharedSocket?.readyState === WebSocket.OPEN
}

/**
 * Real-time SOS alert stream. Falls back to REST polling by callers whenever
 * the socket is unavailable.
 */
export function useAlertWebSocket(enabled = true): AlertSocket {
  const [alerts, setAlerts] = useState<SosAlert | null>(null)
  const [connected, setConnected] = useState(isAlertSocketConnected())

  useEffect(() => {
    if (!enabled) return

    const subscriber: Subscriber = (data) => setAlerts(data)
    subscribers.add(subscriber)
    consumerCount += 1
    openSharedSocket()
    setConnected(isAlertSocketConnected())

    // A single low-frequency probe tracks connection state for the indicators.
    // `open` does not notify subscribers directly, and polling this flag keeps
    // the "Live" / "Auto-refreshing" badge honest.
    const probe = setInterval(() => {
      setConnected(isAlertSocketConnected())
    }, 2000)

    return () => {
      clearInterval(probe)
      subscribers.delete(subscriber)
      consumerCount -= 1
      if (consumerCount <= 0) {
        consumerCount = 0
        subscribers.clear()
        releaseSharedSocket()
        setConnected(false)
      }
    }
  }, [enabled])

  const send = useCallback((data: unknown): boolean => {
    if (sharedSocket && sharedSocket.readyState === WebSocket.OPEN) {
      sharedSocket.send(JSON.stringify(data))
      return true
    }
    return false
  }, [])

  return { alerts, connected, send }
}