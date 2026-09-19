'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

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

// Same-origin WebSocket: the Next.js custom server proxies /ws to FastAPI.
// Derive wss:// automatically when served over HTTPS.
function wsBase(): string {
  if (typeof window === 'undefined') return ''
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${protocol}://${window.location.host}`
}

/**
 * Real-time SOS alert stream. Falls back to REST polling by callers whenever
 * the socket is unavailable.
 */
export function useAlertWebSocket(enabled = true): AlertSocket {
  const [alerts, setAlerts] = useState<SosAlert | null>(null)
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const retryTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryDelay = useRef(1000)

  const connect = useCallback(() => {
    if (!enabled) return

    try {
      const ws = new WebSocket(`${wsBase()}/ws/alerts`)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        retryDelay.current = 1000
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as SosAlert
          setAlerts(data)
        } catch {
          // ignore malformed frames
        }
      }

      ws.onclose = () => {
        setConnected(false)
        wsRef.current = null
        retryTimeout.current = setTimeout(() => {
          retryDelay.current = Math.min(retryDelay.current * 1.5, 10000)
          connect()
        }, retryDelay.current)
      }
    } catch {
      // WS unavailable; callers poll instead
    }
  }, [enabled])

  useEffect(() => {
    connect()
    return () => {
      if (wsRef.current) wsRef.current.close()
      if (retryTimeout.current) clearTimeout(retryTimeout.current)
    }
  }, [connect])

  const send = useCallback((data: unknown): boolean => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
      return true
    }
    return false
  }, [])

  return { alerts, connected, send }
}

export default useAlertWebSocket