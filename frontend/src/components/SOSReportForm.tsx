import { useState } from 'react'
import { AlertTriangle, MapPin, Users, Heart, Send, X } from 'lucide-react'
import * as api from '../services/api'
import { RAW_VILLAGES } from '../data/fallbackData'

const EMERGENCY_TYPES = [
  { value: 'FLOOD', label: 'Flood', icon: '🌊' },
  { value: 'EARTHQUAKE', label: 'Earthquake', icon: '🏚️' },
  { value: 'TRAPPED', label: 'Trapped', icon: '🚧' },
  { value: 'MEDICAL', label: 'Medical', icon: '🏥' },
  { value: 'ROAD_BLOCKED', label: 'Road Blocked', icon: '🛤️' },
  { value: 'WATER_SHORTAGE', label: 'Water Shortage', icon: '💧' },
  { value: 'FIRE', label: 'Fire', icon: '🔥' },
  { value: 'OTHER', label: 'Other', icon: '⚠️' },
]

const SEVERITY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Minimal', color: 'text-emerald-400' },
  2: { label: 'Low', color: 'text-violet-400' },
  3: { label: 'Moderate', color: 'text-amber-400' },
  4: { label: 'Severe', color: 'text-orange-400' },
  5: { label: 'Critical', color: 'text-red-400' },
}

interface SOSForm {
  reporter_name: string
  reporter_phone: string
  village_id: string
  village_name: string
  emergency_type: string
  severity: number
  description: string
  people_affected: number
  medical_emergency: boolean
  medical_details: string
  latitude: number
  longitude: number
}

interface SOSReportFormProps {
  onSubmit?: () => void
  onClose: () => void
}

export default function SOSReportForm({ onSubmit, onClose }: SOSReportFormProps) {
  const [form, setForm] = useState<SOSForm>({
    reporter_name: '',
    reporter_phone: '',
    village_id: '',
    village_name: '',
    emergency_type: '',
    severity: 3,
    description: '',
    people_affected: 1,
    medical_emergency: false,
    medical_details: '',
    latitude: 30.15,
    longitude: 78.45,
  })
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleVillageChange = (villageId: string) => {
    const village = RAW_VILLAGES.find(v => v.id === villageId)
    if (village) {
      setForm(f => ({
        ...f,
        village_id: villageId,
        village_name: village.name,
        latitude: village.latitude,
        longitude: village.longitude,
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.emergency_type || !form.village_id || !form.reporter_name || !form.description) {
      setError('Please fill in all required fields.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const report = {
        ...form,
        timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      }
      await api.submitSOS(report)
      setSubmitted(true)
      if (onSubmit) onSubmit()
    } catch (err) {
      setError('Failed to submit SOS. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-3xl border border-theme bg-sidebar p-8 text-center shadow-2xl backdrop-blur-xl">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10">
            <svg className="h-8 w-8 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-white">SOS Report Submitted</h3>
          <p className="mt-2 text-sm text-surface-400">
            Your emergency report has been received and is being relayed to authorities.
          </p>
          <div className="mt-4 rounded-xl border border-golden/20 bg-golden/5 p-4">
            <p className="font-mono text-xs uppercase tracking-widest text-golden">What happens next</p>
            <ul className="mt-2 space-y-1.5 text-sm text-surface-400">
              <li>🏢 Report submitted to the authority control room</li>
              <li>🚑 Response is prioritized by type, severity, and people affected</li>
              <li>📶 If you were offline, the report is queued on this device and synced when a connection returns</li>
            </ul>
          </div>
          <button
            onClick={onClose}
            className="mt-6 w-full rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 py-3 font-semibold text-white transition-all hover:from-violet-500 hover:to-violet-400"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-theme bg-sidebar shadow-2xl backdrop-blur-xl scrollbar-thin">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-theme bg-sidebar px-6 py-4 backdrop-blur-xl z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
              <AlertTriangle size={20} className="text-red-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">🚨 Submit SOS Report</h2>
              <p className="text-xs text-surface-400">Sent to the district authority control room</p>
            </div>
          </div>
          <button onClick={onClose} className="text-surface-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          {/* Reporter info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm text-surface-400">Your Name *</label>
              <input
                type="text"
                value={form.reporter_name}
                onChange={(e) => setForm(f => ({ ...f, reporter_name: e.target.value }))}
                placeholder="Rajesh Kumar"
                required
                className="w-full rounded-xl border border-theme bg-input px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all placeholder:text-surface-600"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-surface-400">Phone</label>
              <input
                type="tel"
                value={form.reporter_phone}
                onChange={(e) => setForm(f => ({ ...f, reporter_phone: e.target.value }))}
                placeholder="+91-9876543210"
                className="w-full rounded-xl border border-theme bg-input px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all placeholder:text-surface-600"
              />
            </div>
          </div>

          {/* Village */}
          <div>
            <label className="mb-1.5 block text-sm text-surface-400">Village / Location *</label>
            <select
              value={form.village_id}
              onChange={(e) => handleVillageChange(e.target.value)}
              required
              className="w-full rounded-xl border border-theme bg-input px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all"
            >
              <option value="" className="bg-panel">Select affected village…</option>
              {RAW_VILLAGES.map(v => (
                <option key={v.id} value={v.id} className="bg-panel">{v.name}</option>
              ))}
            </select>
          </div>

          {/* Emergency type */}
          <div>
            <label className="mb-2 block text-sm text-surface-400">Emergency Type *</label>
            <div className="grid grid-cols-4 gap-2">
              {EMERGENCY_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, emergency_type: t.value }))}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all ${
                    form.emergency_type === t.value
                      ? 'border-red-500/40 bg-red-500/10 shadow-sm'
                      : 'border-theme bg-panel hover:border-theme hover:bg-white/[0.04]'
                  }`}
                >
                  <span className="text-xl">{t.icon}</span>
                  <span className="text-[10px] text-surface-400">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Severity */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm text-surface-400">Severity Level *</label>
              <span className={`text-sm font-semibold ${SEVERITY_LABELS[form.severity]?.color || 'text-surface-400'}`}>
                {form.severity}/5 — {SEVERITY_LABELS[form.severity]?.label || 'Unknown'}
              </span>
            </div>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, severity: s }))}
                  className={`flex-1 rounded-xl py-3 text-center text-lg font-bold transition-all ${
                    form.severity === s
                      ? s === 5 ? 'bg-red-500 text-white shadow-lg shadow-red-500/25' :
                        s === 4 ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25' :
                        s === 3 ? 'bg-amber-500 text-surface-950 shadow-lg shadow-amber-500/25' :
                        s === 2 ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/25' :
                        'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                      : 'border border-theme bg-panel text-surface-500 hover:text-white hover:border-theme'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* People affected & medical */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm text-surface-400">People Affected</label>
              <div className="relative">
                <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
                <input
                  type="number"
                  min="1"
                  value={form.people_affected}
                  onChange={(e) => setForm(f => ({ ...f, people_affected: parseInt(e.target.value) || 1 }))}
                  className="w-full rounded-xl border border-theme bg-input py-2.5 pl-9 pr-3 text-sm text-white outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-surface-400">Medical Emergency</label>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, medical_emergency: !f.medical_emergency }))}
                className={`flex w-full items-center gap-2 rounded-xl border p-2.5 transition-all ${
                  form.medical_emergency
                    ? 'border-red-500/40 bg-red-500/10 text-red-400'
                    : 'border-theme bg-panel text-surface-500'
                }`}
              >
                <Heart size={16} fill={form.medical_emergency ? 'currentColor' : 'none'} />
                <span className="text-sm">{form.medical_emergency ? 'YES' : 'No'}</span>
              </button>
            </div>
          </div>

          {form.medical_emergency && (
            <div>
              <label className="mb-1.5 block text-sm text-surface-400">Medical Details</label>
              <input
                type="text"
                value={form.medical_details}
                onChange={(e) => setForm(f => ({ ...f, medical_details: e.target.value }))}
                placeholder="Patient condition, medication needed, etc."
                className="w-full rounded-xl border border-theme bg-input px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all placeholder:text-surface-600"
              />
            </div>
          )}

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-sm text-surface-400">Description *</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Describe the situation: what is happening, how many people need help, any immediate dangers…"
              required
              rows={3}
              className="w-full rounded-xl border border-theme bg-input px-3 py-2.5 text-sm text-white outline-none placeholder:text-surface-600 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-center text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-red-500 py-3.5 text-base font-bold text-white shadow-lg shadow-red-500/25 transition-all hover:from-red-500 hover:to-red-400 disabled:opacity-60"
          >
            {loading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                <Send size={18} /> 🚨 SEND SOS REPORT
              </>
            )}
          </button>

          <p className="text-center text-xs text-surface-500">
            If you are offline, the report is saved on this device and automatically submitted once a connection returns.
          </p>
        </form>
      </div>
    </div>
  )
}