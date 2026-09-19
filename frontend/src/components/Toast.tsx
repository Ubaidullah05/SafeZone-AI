'use client'

import { useState, useEffect, useCallback, createContext, useContext, useRef, type ReactNode } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import type { SosAlert } from '../hooks/useWebSocket'

type ToastType = 'critical' | 'warning' | 'success' | 'info'

interface ToastInput {
  type?: ToastType
  title: string
  message?: string
  duration?: number
  icon?: string
}

interface ToastItem extends Required<Pick<ToastInput, 'type' | 'title'>> {
  id: number
  message?: string
  icon?: string
  exiting: boolean
}

interface ToastContextValue {
  addToast: (input: ToastInput) => number
  removeToast: (id: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)
let toastId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timeoutsRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  const removeToast = useCallback((id: number) => {
    if (timeoutsRef.current[id]) { clearTimeout(timeoutsRef.current[id]); delete timeoutsRef.current[id] }
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300)
  }, [])

  const addToast = useCallback(({ type = 'info', title, message, duration = 5000, icon }: ToastInput) => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, type, title, message, icon, exiting: false }])
    if (duration > 0) { timeoutsRef.current[id] = setTimeout(() => removeToast(id), duration) }
    return id
  }, [removeToast])

  useEffect(() => () => Object.values(timeoutsRef.current).forEach(clearTimeout), [])

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="toast-container">
        {toasts.map(toast => <Toast key={toast.id} toast={toast} onRemove={removeToast} />)}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

interface ToastStyle {
  border: string
  accent: string
  iconColor: string
  glow: string
}

function Toast({ toast, onRemove }: { toast: ToastItem; onRemove: (id: number) => void }) {
  const { id, type, title, message, icon, exiting } = toast
  const s: ToastStyle = {
    critical: { border: 'border-danger/20', accent: 'bg-danger', iconColor: 'text-danger-light', glow: 'shadow-glow-r' },
    warning: { border: 'border-gold-400/20', accent: 'bg-gold-400', iconColor: 'text-gold-400', glow: 'shadow-glow-g' },
    success: { border: 'border-safe/20', accent: 'bg-safe', iconColor: 'text-safe', glow: '' },
    info: { border: 'border-violet-400/20', accent: 'bg-violet-500', iconColor: 'text-violet-300', glow: 'shadow-glow-v' },
  }[type] || { border: 'border-violet-400/20', accent: 'bg-violet-500', iconColor: 'text-violet-300', glow: 'shadow-glow-v' }

  return (
    <div className={`flex items-start gap-3 rounded-2xl border ${s.border} bg-bg-card ${s.glow} p-4 backdrop-blur-xl ${exiting ? 'animate-notification-out' : 'animate-notification-in'}`} style={{ width: 400, maxWidth: '90vw' }}>
      <div className={`h-full w-1 min-h-[40px] rounded-full ${s.accent}`} />
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5">
        {icon ? <span className="text-lg">{icon}</span> : <AlertTriangle size={16} className={s.iconColor} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-white">{title}</p>
        {message && <p className="mt-1 text-sm text-violet-200/60 leading-relaxed">{message}</p>}
      </div>
      <button onClick={() => onRemove(id)} className="mt-0.5 shrink-0 rounded-lg p-1.5 text-violet-400/30 transition hover:bg-white/5 hover:text-white"><X size={15} /></button>
    </div>
  )
}

export function useAlertToasts(alerts: SosAlert | null) {
  const { addToast } = useToast()
  const lastCountRef = useRef<number | null>(null)
  useEffect(() => {
    if (!alerts || alerts.type !== 'sos_update') return
    const activeCount = alerts.active_count || 0
    if (lastCountRef.current !== null && activeCount > lastCountRef.current) {
      const diff = activeCount - lastCountRef.current
      const latest = alerts.latest?.[0]
      addToast({ type: 'critical', title: `🚨 ${diff} New SOS Report${diff > 1 ? 's' : ''}`, message: `${latest ? `${latest.village_name} · ${latest.emergency_type}. ` : ''}${activeCount} active reports. Check the SOS tab.`, icon: '🚨', duration: 8000 })
    }
    lastCountRef.current = activeCount
  }, [alerts, addToast])
}