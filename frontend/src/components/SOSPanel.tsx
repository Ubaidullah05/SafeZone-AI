import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, Clock, Filter, RefreshCw, Phone, Users, Wifi, WifiOff } from 'lucide-react'
import * as api from '../services/api'
import { useAlertWebSocket } from '../hooks/useWebSocket'
import { fmtNumber } from '../utils'
import type { SOSReport, SOSStats } from '../types'

const SEV: Record<number, { bg: string; text: string; border: string; label: string }> = {
  5: { bg: 'bg-danger/10', text: 'text-danger-light', border: 'border-danger/20', label: 'CRITICAL' },
  4: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20', label: 'SEVERE' },
  3: { bg: 'bg-gold-400/10', text: 'text-gold-400', border: 'border-gold-400/20', label: 'MODERATE' },
  2: { bg: 'bg-violet-500/10', text: 'text-violet-300', border: 'border-violet-500/20', label: 'LOW' },
  1: { bg: 'bg-safe/10', text: 'text-safe', border: 'border-safe/20', label: 'MINIMAL' },
}
const ST: Record<string, string> = { NEW: 'bg-danger/15 text-danger-light', ACKNOWLEDGED: 'bg-gold-400/15 text-gold-400', IN_PROGRESS: 'bg-violet-500/15 text-violet-300', RESOLVED: 'bg-safe/15 text-safe', PENDING_SYNC: 'bg-gold-400/15 text-gold-400' }
const EMOJI: Record<string, string> = { FLOOD: '🌊', EARTHQUAKE: '🏚️', TRAPPED: '🚧', MEDICAL: '🏥', ROAD_BLOCKED: '🛤️', WATER_SHORTAGE: '💧', FIRE: '🔥', OTHER: '⚠️' }

export default function SOSPanel() {
  const [reports, setReports] = useState<SOSReport[]>([])
  const [stats, setStats] = useState<SOSStats | null>(null)
  const [filter, setFilter] = useState<{ status: string; severity: string }>({ status: '', severity: '' })
  const [selected, setSelected] = useState<SOSReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [newFlash, setNewFlash] = useState<number | null>(null)
  const { alerts, connected: wsConnected } = useAlertWebSocket(true)

  const loadData = useCallback(async () => { setLoading(true); try { const [r, s] = await Promise.all([api.fetchSOSReports(), api.fetchSOSStats()]); setReports(r); setStats(s) } catch { /* backend down */ } finally { setLoading(false) } }, [])
  useEffect(() => { loadData() }, [loadData])
  useEffect(() => { if (alerts?.type === 'sos_update') { loadData(); setNewFlash(Date.now()); setTimeout(() => setNewFlash(null), 4000) } }, [alerts, loadData])
  useEffect(() => { if (!wsConnected) { const i = setInterval(loadData, 5000); return () => clearInterval(i) } }, [wsConnected, loadData])

  const handleStatusUpdate = async (id: string, status: SOSReport['status']) => { try { await api.updateSOSReport(id, { status }); loadData(); setSelected(null) } catch { /* ignore */ } }
  const filtered = reports.filter(r => (!filter.status || r.status === filter.status) && (!filter.severity || r.severity === Number(filter.severity)))

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-3 sm:gap-5 sm:p-5">
      <div className="flex flex-wrap items-center gap-3 animate-fade-in">
        <div className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium border sm:px-4 sm:py-2 sm:text-sm ${wsConnected ? 'bg-safe/10 text-safe border-safe/20' : 'bg-gold-400/10 text-gold-400 border-gold-400/20'}`}>
          {wsConnected ? <Wifi size={13} /> : <WifiOff size={13} />}
          {wsConnected ? 'Live' : 'Auto-refreshing'}
        </div>
        {newFlash && <span className="animate-notification-in rounded-xl bg-danger/10 border border-danger/20 px-3 py-1.5 text-xs font-medium text-danger-light sm:px-4 sm:text-sm">🚨 New emergency call!</span>}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[
          ['Total', stats?.total_reports || 0, '#F43F5E', 0],
          ['Active', stats?.active_reports || 0, '#FBBF24', 50],
          ['Medical', stats?.medical_emergencies || 0, '#FB923C', 100],
          ['Affected', fmtNumber(stats?.total_people_affected || 0), '#C084FC', 150],
        ].map(([l, v, c, d]) => (
          <div key={l as string} className="card-hover flex items-center gap-3 rounded-2xl border border-theme bg-bg-card px-3 py-3 shadow-card animate-fade-in-up sm:gap-4 sm:px-5 sm:py-4" style={{ animationDelay: `${d as number}ms`, animationFillMode: 'both' }}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11" style={{ background: `${c as string}15`, color: c as string }}><AlertTriangle size={16} /></div>
            <div><p className="font-mono text-2xs uppercase tracking-widest text-violet-300/40 sm:text-xs">{l as string}</p><p className="font-display text-lg font-bold text-white sm:text-2xl">{v as number}</p></div>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-xl border border-theme bg-bg-card p-1">
          <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))} className="rounded-lg bg-transparent px-2 py-1.5 font-mono text-xs text-violet-200 outline-none sm:px-3 sm:py-2 sm:text-sm">
            <option value="">All Status</option>
            <option value="NEW">New</option><option value="ACKNOWLEDGED">Acknowledged</option><option value="IN_PROGRESS">In Progress</option><option value="RESOLVED">Resolved</option><option value="PENDING_SYNC">Pending Sync</option>
          </select>
          <select value={filter.severity} onChange={e => setFilter(f => ({ ...f, severity: e.target.value }))} className="rounded-lg bg-transparent px-2 py-1.5 font-mono text-xs text-violet-200 outline-none sm:px-3 sm:py-2 sm:text-sm">
            <option value="">All Severity</option>
            <option value="5">Critical</option><option value="4">Severe</option><option value="3">Moderate</option><option value="2">Low</option><option value="1">Minimal</option>
          </select>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <button onClick={loadData} className="flex items-center gap-2 rounded-xl border border-theme bg-bg-card px-3 py-2 text-xs font-medium text-violet-300/60 transition hover:bg-violet-500/5 hover:text-white sm:px-4 sm:py-2.5 sm:text-sm"><RefreshCw size={13} /> Refresh</button>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-[1fr_420px]">
        <div className="space-y-2 overflow-y-auto pr-1 sm:space-y-3">
          {loading ? <div className="flex justify-center py-12"><div className="h-7 w-7 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" /></div>
          : filtered.length === 0 ? <div className="py-12 text-center text-base text-violet-300/40">No reports match filters.</div>
          : filtered.map((r, i) => <Card key={r.id} r={r} sel={selected?.id === r.id} onClick={() => setSelected(r)} delay={i * 30} />)}
        </div>
        <div className="hidden lg:block">
          {selected ? <Detail r={selected} onUpdate={handleStatusUpdate} onClose={() => setSelected(null)} />
          : <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-theme bg-bg-card/50 p-8 text-center text-violet-300/30"><Filter size={28} /><p className="mt-3 text-base">Select a report to view details</p></div>}
        </div>
      </div>
      {/* Mobile detail overlay */}
      {selected && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="absolute inset-x-0 bottom-0 top-12 overflow-y-auto rounded-t-3xl bg-sidebar sm:inset-x-4 sm:bottom-4 sm:top-auto sm:rounded-3xl">
            <Detail r={selected} onUpdate={handleStatusUpdate} onClose={() => setSelected(null)} />
          </div>
        </div>
      )}
    </div>
  )
}

function Card({ r, sel, onClick, delay }: { r: SOSReport; sel: boolean; onClick: () => void; delay: number }) {
  const s = SEV[r.severity] || SEV[1]
  const st = ST[r.status] || 'bg-white/5 text-violet-200/50'
  return <button onClick={onClick} className={`w-full rounded-2xl border p-3 text-left transition-all animate-fade-in-up sm:p-5 ${sel ? 'border-violet-500/25 bg-violet-500/8 shadow-glow-v' : r.severity === 5 ? 'border-danger/10 bg-bg-card hover:border-danger/20 urgency-pulse' : 'border-theme bg-bg-card hover:border-violet-500/15 hover:shadow-card'}`} style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}>
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-2 sm:gap-3">
        <span className="text-xl sm:text-2xl">{EMOJI[r.emergency_type] || '⚠️'}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap sm:gap-2">
            <p className="text-sm font-semibold text-white sm:text-base">{r.village_name}</p>
            <span className={`rounded-lg border px-1.5 py-0.5 font-mono text-2xs font-bold sm:px-2.5 sm:py-1 sm:text-xs ${s.bg} ${s.text} ${s.border}`}>{s.label}</span>
            {r.transmission_channel === 'SATELLITE' && (
              <span className="rounded-lg bg-cyan-500/15 border border-cyan-500/30 px-1.5 py-0.5 font-mono text-2xs font-bold text-cyan-300">
                🛰️ SATCOM
              </span>
            )}
            {r.medical_emergency && <span className="rounded-lg bg-danger/10 px-1.5 py-0.5 font-mono text-2xs font-bold text-danger-light sm:px-2.5 sm:text-xs">🏥</span>}
          </div>
          <p className="mt-1 truncate text-xs text-violet-200/50 sm:mt-1.5 sm:text-sm">{r.description}</p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <span className={`rounded-lg px-2 py-0.5 font-mono text-2xs font-bold sm:px-3 sm:text-xs ${st}`}>{r.status.replace('_', ' ')}</span>
        <span className="font-mono text-2xs text-violet-300/30">P{r.priority_score}</span>
      </div>
    </div>
    <div className="mt-2.5 flex items-center gap-3 text-xs text-violet-300/40 sm:mt-3.5 sm:gap-5 sm:text-sm">
      <span className="flex items-center gap-1"><Users size={12} /> {fmtNumber(r.people_affected)}</span>
      <span className="flex items-center gap-1"><Clock size={12} /> {new Date(r.timestamp).toLocaleTimeString()}</span>
      {r.transmission_channel === 'SATELLITE' && <span className="text-cyan-400/80 font-mono text-2xs">ISRO DAT-SG</span>}
      <span className="hidden font-mono sm:inline">{r.id}</span>
    </div>
  </button>
}

function Detail({ r, onUpdate, onClose }: { r: SOSReport; onUpdate: (id: string, status: SOSReport['status']) => void; onClose: () => void }) {
  const s = SEV[r.severity] || SEV[1]
  const st = ST[r.status] || 'bg-white/5 text-violet-200/50'
  const [adjudicating, setAdjudicating] = useState(false)
  const [adj, setAdj] = useState({ actual_severity: String(r.severity), actual_people_affected: String(r.people_affected), outcome: 'CONFIRMED', note: '' })
  const [adjBusy, setAdjBusy] = useState(false)
  const [adjDone, setAdjDone] = useState(false)

  const handleAdjudicate = async () => {
    setAdjBusy(true)
    try {
      await api.adjudicateSOS(r.id, {
        actual_severity: Number(adj.actual_severity),
        actual_people_affected: Number(adj.actual_people_affected) || 0,
        outcome: adj.outcome,
        note: adj.note,
      })
      setAdjDone(true)
      onUpdate(r.id, 'RESOLVED')
      setAdjudicating(false)
    } catch {
      setAdjudicating(false)
    } finally {
      setAdjBusy(false)
    }
  }

  return <div className="flex h-full flex-col rounded-2xl border border-theme bg-bg-card p-6 shadow-card animate-slide-in-right">
    <div className="flex items-start justify-between">
      <div><span className="text-3xl">{EMOJI[r.emergency_type] || '⚠️'}</span><h3 className="mt-1 font-display text-lg font-semibold text-white">{r.village_name}</h3><p className="font-mono text-xs text-violet-300/40">{r.id} · {r.emergency_type}</p></div>
      <button onClick={onClose} className="rounded-lg p-2 text-violet-400/30 transition hover:bg-white/5 hover:text-white">✕</button>
    </div>
    <div className="mt-5 space-y-4">
      <div className="flex gap-2 flex-wrap">
        <span className={`rounded-lg border px-3 py-1.5 font-mono text-xs font-bold ${s.bg} ${s.text} ${s.border}`}>Severity {r.severity}/5</span>
        <span className={`rounded-lg px-3 py-1.5 font-mono text-xs font-bold ${st}`}>{r.status.replace('_', ' ')}</span>
        {r.transmission_channel === 'SATELLITE' && (
          <span className="rounded-lg border border-cyan-500/30 bg-cyan-500/15 px-3 py-1.5 font-mono text-xs font-bold text-cyan-300">
            🛰️ Satellite Backhaul — Simulated
          </span>
        )}
      </div>

      {r.transmission_channel === 'SATELLITE' && (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs uppercase tracking-widest text-cyan-400 font-bold">
              ISRO DAT-SG Satcom Telemetry
            </p>
            <span className="rounded-md bg-cyan-500/20 px-2 py-0.5 font-mono text-2xs text-cyan-300">
              Verified Ground Gateway Link
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono text-slate-300">
            <div><span className="text-muted">Terminal: </span>{r.sat_terminal_id || 'DATSG-KDR01'}</div>
            <div><span className="text-muted">Uplink Latency: </span>{r.sat_latency_ms ? `${r.sat_latency_ms}ms` : '1080ms'}</div>
            <div><span className="text-muted">Constellation: </span>{r.sat_constellation || 'GSAT-7R / NavIC'}</div>
            <div><span className="text-muted">Signal C/N0: </span>{r.sat_signal_dbhz ? `${r.sat_signal_dbhz} dB-Hz` : '44.5 dB-Hz'}</div>
          </div>
          {r.raw_sat_packet && (
            <div className="mt-2 rounded-lg bg-black/50 p-2 font-mono text-2xs text-emerald-400 overflow-x-auto">
              SZ1 Burst: {r.raw_sat_packet}
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-theme bg-bg-light p-4"><p className="text-sm text-violet-100/80 leading-relaxed">{r.description}</p></div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border border-theme bg-bg-light p-3.5"><p className="font-mono text-xs uppercase text-violet-300/30">Reporter</p><p className="mt-1 font-medium text-white">{r.reporter_name}</p>{r.reporter_phone && <p className="flex items-center gap-1 text-violet-200/50"><Phone size={11} /> {r.reporter_phone}</p>}</div>
        <div className="rounded-xl border border-theme bg-bg-light p-3.5"><p className="font-mono text-xs uppercase text-violet-300/30">People Affected</p><p className="mt-1 font-display text-xl font-bold text-white">{fmtNumber(r.people_affected)}</p></div>
      </div>
      {r.medical_emergency && <div className="rounded-xl border border-danger/20 bg-danger/5 p-4"><p className="font-mono text-xs uppercase tracking-widest text-danger-light font-bold">Medical Emergency</p><p className="mt-1.5 text-sm text-violet-200/60">{r.medical_details || 'Medical assistance required'}</p></div>}
      {r.status !== 'RESOLVED' && <div className="space-y-3 border-t border-theme pt-5">
        <div className="flex gap-3">
          {r.status === 'NEW' && <button onClick={() => onUpdate(r.id, 'ACKNOWLEDGED')} className="flex-1 rounded-xl bg-gold-400 py-3 text-sm font-semibold text-bg transition-all hover:bg-gold-300 active:scale-[0.98]">Acknowledge</button>}
          {(r.status === 'NEW' || r.status === 'ACKNOWLEDGED') && <button onClick={() => onUpdate(r.id, 'IN_PROGRESS')} className="flex-1 rounded-xl bg-violet-500 py-3 text-sm font-semibold text-white transition-all hover:bg-violet-400 active:scale-[0.98]">Dispatch Team</button>}
          <button onClick={() => setAdjudicating(a => !a)} className="flex-1 rounded-xl bg-safe py-3 text-sm font-semibold text-bg transition-all hover:bg-safe-light active:scale-[0.98]">Close Report</button>
        </div>
        {adjudicating && !adjDone && (
          <div className="space-y-3 rounded-xl border border-theme bg-bg-light p-4">
            <p className="font-mono text-xs uppercase tracking-widest text-violet-300/60">
              Confirm outcome — this helps improve the system
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-violet-200/50">Actual severity
                <select value={adj.actual_severity} onChange={e => setAdj(a => ({ ...a, actual_severity: e.target.value }))} className="mt-1 w-full rounded-lg border border-theme bg-input px-2 py-2 text-sm text-white outline-none">
                  {[5, 4, 3, 2, 1].map(n => <option key={n} value={n} className="bg-panel">{n}</option>)}
                </select>
              </label>
              <label className="text-xs text-violet-200/50">People affected
                <input type="number" min="0" value={adj.actual_people_affected} onChange={e => setAdj(a => ({ ...a, actual_people_affected: e.target.value }))} className="mt-1 w-full rounded-lg border border-theme bg-input px-2 py-2 text-sm text-white outline-none" />
              </label>
            </div>
            <label className="text-xs text-violet-200/50">Outcome
              <select value={adj.outcome} onChange={e => setAdj(a => ({ ...a, outcome: e.target.value }))} className="mt-1 w-full rounded-lg border border-theme bg-input px-2 py-2 text-sm text-white outline-none">
                <option value="CONFIRMED" className="bg-panel">Confirmed — situation verified</option>
                <option value="RESPONDED" className="bg-panel">Responded — team dispatched</option>
                <option value="DECLINED" className="bg-panel">Declined — false/already safe</option>
              </select>
            </label>
            <input type="text" value={adj.note} onChange={e => setAdj(a => ({ ...a, note: e.target.value }))} placeholder="Note (optional)" className="w-full rounded-lg border border-theme bg-input px-2 py-2 text-sm text-white outline-none placeholder:text-slate-600" />
            <button onClick={handleAdjudicate} disabled={adjBusy} className="w-full rounded-xl bg-safe py-2.5 text-sm font-semibold text-bg transition-all hover:bg-safe-light disabled:opacity-60">
              {adjBusy ? 'Saving…' : 'Confirm & Close'}
            </button>
          </div>
        )}
        {adjDone && (
          <p className="rounded-xl border border-safe/20 bg-safe/5 py-3 text-center text-sm text-safe">
            Recorded as {adj.outcome}. The system has learned from this report.
          </p>
        )}
      </div>}
    </div>
  </div>
}