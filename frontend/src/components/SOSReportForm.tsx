import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, MapPin, Send, X, Loader2, CheckCircle2, WifiOff } from 'lucide-react'
import * as api from '../services/api'
import type { VillageResult } from '../types'

interface SOSReportFormProps {
  onSubmit?: () => void
  onClose: () => void
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function findNearestVillage(villages: VillageResult[], lat: number, lng: number): VillageResult | null {
  if (!villages.length) return null
  let best = villages[0]
  let bestDist = Infinity
  for (const v of villages) {
    const d = haversineDistance(lat, lng, v.latitude, v.longitude)
    if (d < bestDist) {
      bestDist = d
      best = v
    }
  }
  return best
}

export default function SOSReportForm({ onSubmit, onClose }: SOSReportFormProps) {
  const [phase, setPhase] = useState<'locating' | 'sending' | 'success' | 'error'>('locating')
  const [errorMsg, setErrorMsg] = useState('')

  const sendSOS = useCallback(async (lat: number, lng: number) => {
    let villages: VillageResult[] = []
    try {
      villages = await api.fetchVillages()
    } catch { /* proceed with defaults */ }

    const nearest = findNearestVillage(villages, lat, lng)

    const report = {
      reporter_name: 'Civilian (SOS)',
      reporter_phone: '',
      village_id: nearest?.id || 'unknown',
      village_name: nearest?.name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      emergency_type: 'OTHER',
      severity: 5,
      description: 'SOS emergency alert — civilian pressed distress button. Location shared automatically.',
      people_affected: 1,
      medical_emergency: false,
      medical_details: '',
      latitude: lat,
      longitude: lng,
      timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    }

    setPhase('sending')
    await api.submitSOS(report)
    setPhase('success')
    if (onSubmit) onSubmit()
  }, [onSubmit])

  useEffect(() => {
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser.')
      setPhase('error')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        sendSOS(pos.coords.latitude, pos.coords.longitude)
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setErrorMsg('Location permission denied. Please enable location access in your browser settings and try again.')
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setErrorMsg('Location unavailable. Your device could not determine your position.')
        } else if (err.code === err.TIMEOUT) {
          setErrorMsg('Location request timed out. Please try again.')
        } else {
          setErrorMsg('Unable to get your location. Please try again.')
        }
        setPhase('error')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }, [sendSOS])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="w-full max-w-sm rounded-t-3xl border border-theme bg-sidebar p-6 shadow-2xl backdrop-blur-xl sm:rounded-3xl sm:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
              <AlertTriangle size={20} className="text-red-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">SOS Distress</h2>
              <p className="text-xs text-surface-400">Sending your location to officials</p>
            </div>
          </div>
          <button onClick={onClose} className="text-surface-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Locating phase */}
        {phase === 'locating' && (
          <div className="flex flex-col items-center py-8 gap-4">
            <div className="relative">
              <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center">
                <MapPin size={28} className="text-red-400 animate-pulse" />
              </div>
              <div className="absolute inset-0 h-16 w-16 rounded-full border-2 border-red-500/30 animate-ping" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-white">Getting your location...</p>
              <p className="text-xs text-surface-400 mt-1">Allow location access when prompted</p>
            </div>
            <Loader2 size={20} className="animate-spin text-red-400" />
          </div>
        )}

        {/* Sending phase */}
        {phase === 'sending' && (
          <div className="flex flex-col items-center py-8 gap-4">
            <div className="h-16 w-16 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Send size={28} className="text-amber-400 animate-bounce" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-white">Sending SOS to officials...</p>
              <p className="text-xs text-surface-400 mt-1">Your location is being relayed</p>
            </div>
            <Loader2 size={20} className="animate-spin text-amber-400" />
          </div>
        )}

        {/* Success phase */}
        {phase === 'success' && (
          <div className="flex flex-col items-center py-8 gap-4">
            <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 size={28} className="text-emerald-400" />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-white">SOS Sent!</p>
              <p className="text-sm text-surface-400 mt-2">
                Your location has been sent to the district safety board.
              </p>
            </div>
            <div className="w-full rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 mt-2">
              <p className="font-mono text-xs uppercase tracking-widest text-emerald-400 text-center">What happens next</p>
              <ul className="mt-2 space-y-1.5 text-sm text-surface-400">
                <li className="flex items-start gap-2"><span className="mt-0.5">🏢</span> Report sent to the district safety board</li>
                <li className="flex items-start gap-2"><span className="mt-0.5">🚑</span> Officials will dispatch help to your location</li>
                <li className="flex items-start gap-2"><span className="mt-0.5">📶</span> If offline, the SOS is queued and sent when connected</li>
              </ul>
            </div>
            <button
              onClick={onClose}
              className="mt-4 w-full rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 py-3 font-semibold text-white transition-all hover:from-violet-500 hover:to-violet-400"
            >
              Close
            </button>
          </div>
        )}

        {/* Error phase */}
        {phase === 'error' && (
          <div className="flex flex-col items-center py-8 gap-4">
            <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center">
              <WifiOff size={28} className="text-red-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-white">Could not send SOS</p>
              <p className="text-xs text-red-400/80 mt-2">{errorMsg}</p>
            </div>
            <div className="flex w-full gap-3 mt-2">
              <button
                onClick={() => { setPhase('locating'); setErrorMsg(''); window.location.reload() }}
                className="flex-1 rounded-xl bg-gradient-to-r from-red-600 to-red-500 py-3 font-semibold text-white transition-all hover:from-red-500 hover:to-red-400"
              >
                Retry
              </button>
              <button
                onClick={onClose}
                className="flex-1 rounded-xl border border-theme bg-panel py-3 font-semibold text-surface-400 transition-all hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
