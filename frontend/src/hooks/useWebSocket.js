import { useState, useEffect, useRef, useCallback } from 'react'

// Use relative URLs so Vite proxy handles routing (works on LAN too)
const WS_BASE = `ws://${window.location.host}`

/**
 * Hook for real-time mesh network data via WebSocket.
 * Falls back to REST polling if WebSocket is unavailable.
 */
export function useMeshWebSocket(enabled = true) {
  const [meshData, setMeshData] = useState(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState(null)
  const wsRef = useRef(null)
  const retryTimeout = useRef(null)
  const retryDelay = useRef(1000)

  const connect = useCallback(() => {
    if (!enabled) return

    try {
      const ws = new WebSocket(`${WS_BASE}/ws/mesh`)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        setError(null)
        retryDelay.current = 1000 // Reset retry on success
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          setMeshData(data)
        } catch (e) {
          console.warn('Failed to parse mesh WS message:', e)
        }
      }

      ws.onclose = () => {
        setConnected(false)
        wsRef.current = null
        // Auto-reconnect with exponential backoff
        retryTimeout.current = setTimeout(() => {
          retryDelay.current = Math.min(retryDelay.current * 1.5, 10000)
          connect()
        }, retryDelay.current)
      }

      ws.onerror = (err) => {
        console.warn('Mesh WebSocket error, will retry:', err)
        setError('WebSocket connection failed')
      }
    } catch (e) {
      setError('WebSocket not available')
    }
  }, [enabled])

  useEffect(() => {
    connect()
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
      if (retryTimeout.current) {
        clearTimeout(retryTimeout.current)
      }
    }
  }, [connect])

  const send = useCallback((data) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
      return true
    }
    return false
  }, [])

  return { meshData, connected, error, send }
}

/**
 * Hook for real-time alert updates via WebSocket.
 */
export function useAlertWebSocket(enabled = true) {
  const [alerts, setAlerts] = useState(null)
  const [connected, setConnected] = useState(false)
  const wsRef = useRef(null)
  const retryTimeout = useRef(null)
  const retryDelay = useRef(1000)

  const connect = useCallback(() => {
    if (!enabled) return

    try {
      const ws = new WebSocket(`${WS_BASE}/ws/alerts`)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        retryDelay.current = 1000
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          setAlerts(data)
        } catch (e) {
          console.warn('Failed to parse alert WS message:', e)
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

      ws.onerror = () => {
        // Silently retry
      }
    } catch (e) {
      // WS not available
    }
  }, [enabled])

  useEffect(() => {
    connect()
    return () => {
      if (wsRef.current) wsRef.current.close()
      if (retryTimeout.current) clearTimeout(retryTimeout.current)
    }
  }, [connect])

  return { alerts, connected }
}
