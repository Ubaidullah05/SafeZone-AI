import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, Clock, Activity, Heart, Filter, RefreshCw, Phone, MapPin, Users, Wifi, WifiOff } from 'lucide-react'
import * as api from '../services/api'
import { useAlertWebSocket } from '../hooks/useWebSocket'
import { fmtNumber } from '../utils'

const SEV = { 5: { bg: 'bg-danger/10', text: 'text-danger-light', border: 'border-danger/20', label: 'CRITICAL' }, 4: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20', label: 'SEVERE' }, 3: { bg: 'bg-gold-400/10', text: 'text-gold-400', border: 'border-gold-400/20', label: 'MODERATE' }, 2: { bg: 'bg-violet-500/10', text: 'text-violet-300', border: 'border-violet-500/20', label: 'LOW' }, 1: { bg: 'bg-safe/10', text: 'text-safe', border: 'border-safe/20', label: 'MINIMAL' } }
const ST = { NEW: 'bg-danger/15 text-danger-light', ACKNOWLEDGED: 'bg-gold-400/15 text-gold-400', IN_PROGRESS: 'bg-violet-500/15 text-violet-300', RESOLVED: 'bg-safe/15 text-safe', PENDING_SYNC: 'bg-gold-400/15 text-gold-400' }
const EMOJI = { FLOOD: '🌊', EARTHQUAKE: '🏚️', TRAPPED: '🚧', MEDICAL: '🏥', ROAD_BLOCKED: '🛤️', WATER_SHORTAGE: '💧', FIRE: '🔥', OTHER: '⚠️' }

export default function SOSPanel({ onShowForm }) {
  const [reports, setReports] = useState([])
  const [stats, setStats] = useState(null)
  const [filter, setFilter] = useState({ status: '', severity: '' })
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [newFlash, setNewFlash] = useState(null)
  const { alerts, connected: wsConnected } = useAlertWebSocket(true)

  const loadData = useCallback(async () => { setLoading(true); try { const [r, s] = await Promise.all([api.fetchSOSReports(), api.fetchSOSStats()]); setReports(r); setStats(s) } catch {} finally { setLoading(false) } }, [])
  useEffect(() => { loadData() }, [loadData])
  useEffect(() => { if (alerts?.type === 'sos_update') { loadData(); if (alerts.new_reports > 0) { setNewFlash(Date.now()); setTimeout(() => setNewFlash(null), 4000) } } }, [alerts, loadData])
  useEffect(() => { if (!wsConnected) { const i = setInterval(loadData, 5000); return () => clearInterval(i) } }, [wsConnected, loadData])

  const handleStatusUpdate = async (id, status) => { try { await api.updateSOSReport(id, { status }); loadData(); setSelected(null) } catch {} }
  const filtered = reports.filter(r => (!filter.status || r.status === filter.status) && (!filter.severity || r.severity === Number(filter.severity)))

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-5">
      <div className="flex items-center gap-3 animate-fade-in">
        <div className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium border ${wsConnected ? 'bg-safe/10 text-safe border-safe/20' : 'bg-gold-400/10 text-gold-400 border-gold-400/20'}`}>
          {wsConnected ? <Wifi size={13} /> : <WifiOff size={13} />}
          {wsConnected ? 'Live — Real-time Alerts' : 'Polling — Auto-refresh'}
        </div>
        {newFlash && <span className="animate-notification-in rounded-xl bg-danger/10 border border-danger/20 px-4 py-2 text-sm font-medium text-danger-light">🚨 New SOS received!</span>}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ['Total', stats?.total_reports || 0, '#F43F5E', 0],
          ['Active', stats?.active_reports || 0, '#FBBF24', 50],
          ['Medical', stats?.medical_emergencies || 0, '#FB923C', 100],
          ['Affected', fmtNumber(stats?.total_people_affected || 0), '#C084FC', 150],
        ].map(([l, v, c, d]) => (
          <div key={l} className="card-hover flex items-center gap-4 rounded-2xl border border-theme bg-bg-card px-5 py-4 shadow-card animate-fade-in-up" style={{ animationDelay: `${d}ms`, animationFillMode: 'both' }}>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: `${c}15`, color: c }}><AlertTriangle size={18} /></div>
            <div><p className="font-mono text-xs uppercase tracking-widest text-violet-300/40">{l}</p><p className="font-display text-2xl font-bold text-white">{v}</p></div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex rounded-xl border border-theme bg-bg-card p-1.5">
          <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))} className="rounded-lg bg-transparent px-3 py-2 font-mono text-sm text-violet-200 outline-none">
            <option value="">All Status</option>
            <option value="NEW">New</option><option value="ACKNOWLEDGED">Acknowledged</option><option value="IN_PROGRESS">In Progress</option><option value="RESOLVED">Resolved</option><option value="PENDING_SYNC">Pending Sync</option>
          </select>
          <select value={filter.severity} onChange={e => setFilter(f => ({ ...f, severity: e.target.value }))} className="rounded-lg bg-transparent px-3 py-2 font-mono text-sm text-violet-200 outline-none">
            <option value="">All Severity</option>
            <option value="5">Critical</option><option value="4">Severe</option><option value="3">Moderate</option><option value="2">Low</option><option value="1">Minimal</option>
          </select>
        </div>
        <div className="flex gap-3">
          <button onClick={loadData} className="flex items-center gap-2 rounded-xl border border-theme bg-bg-card px-4 py-2.5 text-sm font-medium text-violet-300/60 transition hover:bg-violet-500/5 hover:text-white"><RefreshCw size={13} /> Refresh</button>
          <button onClick={onShowForm} className="flex items-center gap-2 rounded-xl bg-danger px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-danger-light hover:shadow-glow-r active:scale-[0.98]">🚨 Submit SOS</button>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-[1fr_420px]">
        <div className="space-y-3 overflow-y-auto pr-1">
          {loading ? <div className="flex justify-center py-12"><div className="h-7 w-7 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" /></div>
          : filtered.length === 0 ? <div className="py-12 text-center text-base text-violet-300/40">No reports match filters.</div>
          : filtered.map((r, i) => <Card key={r.id} r={r} sel={selected?.id === r.id} onClick={() => setSelected(r)} delay={i * 30} />)}
        </div>
        <div className="hidden lg:block">
          {selected ? <Detail r={selected} onUpdate={handleStatusUpdate} onClose={() => setSelected(null)} />
          : <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-theme bg-bg-card/50 p-8 text-center text-violet-300/30"><Filter size={28} /><p className="mt-3 text-base">Select a report</p></div>}
        </div>
      </div>
    </div>
  )
}

function Card({ r, sel, onClick, delay }) {
  const s = SEV[r.severity] || SEV[1]
  return <button onClick={onClick} className={`w-full rounded-2xl border p-5 text-left transition-all animate-fade-in-up ${sel ? 'border-violet-500/25 bg-violet-500/8 shadow-glow-v' : r.severity === 5 ? 'border-danger/10 bg-bg-card hover:border-danger/20 urgency-pulse' : 'border-theme bg-bg-card hover:border-violet-500/15 hover:shadow-card'}`} style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}>
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{EMOJI[r.emergency_type] || '⚠️'}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-base font-semibold text-white">{r.village_name}</p>
            <span className={`rounded-lg border px-2.5 py-1 font-mono text-xs font-bold ${s.bg} ${s.text} ${s.border}`}>{s.label}</span>
            {r.medical_emergency && <span className="rounded-lg bg-danger/10 px-2.5 py-1 font-mono text-xs font-bold text-danger-light">🏥 MEDICAL</span>}
          </div>
          <p className="mt-1.5 truncate text-sm text-violet-200/50">{r.description}</p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <span className={`rounded-lg px-3 py-1 font-mono text-xs font-bold ${ST[r.status] || 'bg-white/5 text-violet-200/50'}`}>{r.status.replace('_', ' ')}</span>
        <span className="font-mono text-xs text-violet-300/30">P{r.priority_score}</span>
      </div>
    </div>
    <div className="mt-3.5 flex items-center gap-5 text-sm text-violet-300/40">
      <span className="flex items-center gap-1.5"><Users size={13} /> {fmtNumber(r.people_affected)}</span>
      <span className="flex items-center gap-1.5"><Clock size={13} /> {new Date(r.timestamp).toLocaleTimeString()}</span>
      <span className="flex items-center gap-1.5"><MapPin size={13} /> {r.relay_hops} hops</span>
    </div>
  </button>
}

function Detail({ r, onUpdate, onClose }) {
  const s = SEV[r.severity] || SEV[1]
  return <div className="flex h-full flex-col rounded-2xl border border-theme bg-bg-card p-6 shadow-card animate-slide-in-right">
    <div className="flex items-start justify-between">
      <div><span className="text-3xl">{EMOJI[r.emergency_type] || '⚠️'}</span><h3 className="mt-1 font-display text-lg font-semibold text-white">{r.village_name}</h3><p className="font-mono text-xs text-violet-300/40">{r.id} · {r.emergency_type}</p></div>
      <button onClick={onClose} className="rounded-lg p-2 text-violet-400/30 transition hover:bg-white/5 hover:text-white">✕</button>
    </div>
    <div className="mt-5 space-y-4">
      <div className="flex gap-2">
        <span className={`rounded-lg border px-3 py-1.5 font-mono text-xs font-bold ${s.bg} ${s.text} ${s.border}`}>Severity {r.severity}/5</span>
        <span className={`rounded-lg px-3 py-1.5 font-mono text-xs font-bold ${ST[r.status]}`}>{r.status.replace('_', ' ')}</span>
      </div>
      <div className="rounded-xl border border-theme bg-bg-light p-4"><p className="text-sm text-violet-100/80 leading-relaxed">{r.description}</p></div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border border-theme bg-bg-light p-3.5"><p className="font-mono text-xs uppercase text-violet-300/30">Reporter</p><p className="mt-1 font-medium text-white">{r.reporter_name}</p>{r.reporter_phone && <p className="flex items-center gap-1 text-violet-200/50"><Phone size={11} /> {r.reporter_phone}</p>}</div>
        <div className="rounded-xl border border-theme bg-bg-light p-3.5"><p className="font-mono text-xs uppercase text-violet-300/30">People Affected</p><p className="mt-1 font-display text-xl font-bold text-white">{fmtNumber(r.people_affected)}</p></div>
      </div>
      {r.medical_emergency && <div className="rounded-xl border border-danger/20 bg-danger/5 p-4"><p className="font-mono text-xs uppercase tracking-widest text-danger-light font-bold">Medical Emergency</p><p className="mt-1.5 text-sm text-violet-200/60">{r.medical_details || 'Medical assistance required'}</p></div>}
      {r.status !== 'RESOLVED' && <div className="flex gap-3 border-t border-theme pt-5">
        {r.status === 'NEW' && <button onClick={() => onUpdate(r.id, 'ACKNOWLEDGED')} className="flex-1 rounded-xl bg-gold-400 py-3 text-sm font-semibold text-bg transition-all hover:bg-gold-300 active:scale-[0.98]">Acknowledge</button>}
        {(r.status === 'NEW' || r.status === 'ACKNOWLEDGED') && <button onClick={() => onUpdate(r.id, 'IN_PROGRESS')} className="flex-1 rounded-xl bg-violet-500 py-3 text-sm font-semibold text-white transition-all hover:bg-violet-400 active:scale-[0.98]">Dispatch Team</button>}
        <button onClick={() => onUpdate(r.id, 'RESOLVED')} className="flex-1 rounded-xl bg-safe py-3 text-sm font-semibold text-bg transition-all hover:bg-safe-light active:scale-[0.98]">Resolve</button>
      </div>}
    </div>
  </div>
}
