import { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react'
import { AlertTriangle, Bell, X } from 'lucide-react'

const ToastContext = createContext(null)
let toastId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timeoutsRef = useRef({})

  const addToast = useCallback(({ type = 'info', title, message, duration = 5000, icon }) => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, type, title, message, icon, exiting: false }])
    if (duration > 0) { timeoutsRef.current[id] = setTimeout(() => removeToast(id), duration) }
    return id
  }, [])

  const removeToast = useCallback((id) => {
    if (timeoutsRef.current[id]) { clearTimeout(timeoutsRef.current[id]); delete timeoutsRef.current[id] }
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300)
  }, [])

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

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

function Toast({ toast, onRemove }) {
  const { id, type, title, message, icon, exiting } = toast
  const s = {
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

export function useAlertToasts(alerts) {
  const { addToast } = useToast()
  const lastCountRef = useRef(null)
  useEffect(() => {
    if (!alerts || alerts.type !== 'sos_update') return
    const newCount = alerts.new_reports || 0
    if (lastCountRef.current !== null && newCount > lastCountRef.current) {
      const diff = newCount - lastCountRef.current
      addToast({ type: 'critical', title: `🚨 ${diff} New SOS Report${diff > 1 ? 's' : ''}`, message: `${alerts.total_reports} total reports. Check SOS tab.`, icon: '🚨', duration: 8000 })
    }
    lastCountRef.current = newCount
  }, [alerts, addToast])
}
