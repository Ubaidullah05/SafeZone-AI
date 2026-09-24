import { useState, useEffect, useCallback } from 'react'
import {
  AlertTriangle,
  MapPin,
  Send,
  X,
  Loader2,
  CheckCircle2,
  WifiOff,
  Satellite,
  Bluetooth,
  Radio,
  Zap,
} from 'lucide-react'
import * as api from '../services/api'
import type { VillageResult, SatelliteTransmitResponse } from '../types'

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
  const [phase, setPhase] = useState<
    'locating' | 'mode_select' | 'sending' | 'sat_ble_pairing' | 'sat_compressing' | 'sat_uplinking' | 'success' | 'error'
  >('locating')
  const [errorMsg, setErrorMsg] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [useSatcom, setUseSatcom] = useState(false)
  const [satResponse, setSatResponse] = useState<SatelliteTransmitResponse | null>(null)
  const [compressionStats, setCompressionStats] = useState({ rawBytes: 648, burstBytes: 44, ratio: 93.2 })

  // Trigger standard terrestrial send
  const sendTerrestrialSOS = useCallback(
    async (lat: number, lng: number) => {
      let villages: VillageResult[] = []
      try {
        villages = await api.fetchVillages()
      } catch {
        /* proceed with defaults */
      }

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
      try {
        await api.submitSOS(report)
        setPhase('success')
        if (onSubmit) onSubmit()
      } catch {
        // Offer satellite fallback if terrestrial network failed
        setErrorMsg('Terrestrial mobile network unreachable. Cellular towers may be down.')
        setPhase('error')
      }
    },
    [onSubmit]
  )

  // Trigger simulated ISRO DAT-SG Satcom Terminal transmission
  const sendSatelliteSOS = useCallback(
    async (lat: number, lng: number) => {
      let villages: VillageResult[] = []
      try {
        villages = await api.fetchVillages()
      } catch {
        /* proceed */
      }
      const nearest = findNearestVillage(villages, lat, lng)

      // Step 1: Bluetooth BLE terminal handshake
      setPhase('sat_ble_pairing')
      await new Promise((r) => setTimeout(r, 1200))
      try {
        await api.pairSatcomTerminal('DATSG-KDR01', 'Civilian Smartphone')
      } catch {
        /* proceed */
      }

      // Step 2: Packet Compression
      setPhase('sat_compressing')
      await new Promise((r) => setTimeout(r, 1100))

      // Step 3: Satellite Uplink Simulation
      setPhase('sat_uplinking')
      await new Promise((r) => setTimeout(r, 1500))

      try {
        const res = await api.transmitSatelliteSOS({
          village_id: nearest?.id || 'V008',
          latitude: lat,
          longitude: lng,
          severity: 5,
          people_affected: 1,
          medical_emergency: false,
          emergency_type: 'OTHER',
          description: 'Emergency SOS uplinked via Satcom Terminal (ISRO DAT-SG / NavIC).',
          reporter_name: 'Civilian via Satcom Terminal',
          terminal_id: 'DATSG-KDR01',
        })
        setSatResponse(res)
        setCompressionStats({
          rawBytes: 650,
          burstBytes: res.telemetry.packet_size_bytes,
          ratio: res.telemetry.compression_ratio_pct,
        })
        setPhase('success')
        if (onSubmit) onSubmit()
      } catch {
        setErrorMsg('Satellite uplink simulation encountered a link timeout. Please retry.')
        setPhase('error')
      }
    },
    [onSubmit]
  )

  useEffect(() => {
    if (!navigator.geolocation) {
      // Use Kedarnath coordinates as default if browser geolocation not supported
      const fallbackLat = 30.7346
      const fallbackLng = 79.0669
      setCoords({ lat: fallbackLat, lng: fallbackLng })
      if (useSatcom) {
        sendSatelliteSOS(fallbackLat, fallbackLng)
      } else {
        sendTerrestrialSOS(fallbackLat, fallbackLng)
      }
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        if (useSatcom) {
          sendSatelliteSOS(pos.coords.latitude, pos.coords.longitude)
        } else {
          sendTerrestrialSOS(pos.coords.latitude, pos.coords.longitude)
        }
      },
      (err) => {
        // In prototype, don't block on GPS denial - fall back to Kedarnath coordinate
        const fallbackLat = 30.7346
        const fallbackLng = 79.0669
        setCoords({ lat: fallbackLat, lng: fallbackLng })
        if (useSatcom) {
          sendSatelliteSOS(fallbackLat, fallbackLng)
        } else {
          sendTerrestrialSOS(fallbackLat, fallbackLng)
        }
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
    )
  }, [useSatcom, sendSatelliteSOS, sendTerrestrialSOS])

  const switchToSatcom = () => {
    setUseSatcom(true)
    if (coords) {
      sendSatelliteSOS(coords.lat, coords.lng)
    } else {
      sendSatelliteSOS(30.7346, 79.0669)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl border border-theme bg-sidebar p-6 shadow-2xl backdrop-blur-xl sm:rounded-3xl sm:p-7">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                useSatcom ? 'bg-cyan-500/20 text-cyan-400' : 'bg-red-500/10 text-red-400'
              }`}
            >
              {useSatcom ? <Satellite size={22} className="animate-pulse" /> : <AlertTriangle size={20} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Emergency SOS</h2>
                {useSatcom && (
                  <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 font-mono text-2xs text-cyan-300">
                    Satcom
                  </span>
                )}
              </div>
              <p className="text-xs text-surface-400">
                {useSatcom
                  ? 'Uplinking via ISRO DAT-SG Satcom Terminal'
                  : 'Sending distress alert & GPS coordinates'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-surface-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Mode Switcher Toggle Pill */}
        <div className="mb-5 flex rounded-xl border border-theme bg-panel p-1 text-xs">
          <button
            type="button"
            onClick={() => {
              if (useSatcom) {
                setUseSatcom(false)
                if (coords) sendTerrestrialSOS(coords.lat, coords.lng)
              }
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-medium transition ${
              !useSatcom ? 'bg-bg-card text-white shadow-sm' : 'text-muted hover:text-white'
            }`}
          >
            <span>🌐 Terrestrial / 4G</span>
          </button>
          <button
            type="button"
            onClick={switchToSatcom}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-medium transition ${
              useSatcom
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                : 'text-muted hover:text-white'
            }`}
          >
            <Satellite size={13} />
            <span>🛰️ Satcom (ISRO DAT-SG)</span>
          </button>
        </div>

        {/* Locating phase */}
        {phase === 'locating' && (
          <div className="flex flex-col items-center py-6 gap-3">
            <div className="relative">
              <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center">
                <MapPin size={26} className="text-red-400 animate-pulse" />
              </div>
              <div className="absolute inset-0 h-16 w-16 rounded-full border-2 border-red-500/30 animate-ping" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-white">Acquiring Emergency Coordinates...</p>
              <p className="text-xs text-surface-400 mt-0.5">High-precision GPS fix</p>
            </div>
            <Loader2 size={18} className="animate-spin text-red-400" />
          </div>
        )}

        {/* Standard Terrestrial Sending */}
        {phase === 'sending' && (
          <div className="flex flex-col items-center py-6 gap-3">
            <div className="h-16 w-16 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Send size={26} className="text-amber-400 animate-bounce" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-white">Relaying SOS to District Command...</p>
              <p className="text-xs text-surface-400 mt-0.5">Contacting server gateway</p>
            </div>
            <Loader2 size={18} className="animate-spin text-amber-400" />
          </div>
        )}

        {/* Satcom Step 1: Bluetooth BLE Terminal Pairing */}
        {phase === 'sat_ble_pairing' && (
          <div className="flex flex-col items-center py-6 gap-3">
            <div className="relative">
              <div className="h-16 w-16 rounded-full bg-cyan-500/15 flex items-center justify-center text-cyan-300">
                <Bluetooth size={28} className="animate-pulse" />
              </div>
              <div className="absolute inset-0 h-16 w-16 rounded-full border-2 border-cyan-400/40 animate-ping" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-cyan-300">Scanning Bluetooth Spectrum...</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Connecting to ISRO DAT-SG Terminal #042 via BLE (2.4 GHz)
              </p>
            </div>
            <span className="font-mono text-2xs text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 px-2.5 py-1 rounded-full">
              BLE RSSI: -54 dBm · Terminal Battery: 94%
            </span>
          </div>
        )}

        {/* Satcom Step 2: Packet Compression */}
        {phase === 'sat_compressing' && (
          <div className="flex flex-col items-center py-6 gap-3">
            <div className="h-16 w-16 rounded-full bg-indigo-500/15 flex items-center justify-center text-indigo-300">
              <Zap size={28} className="animate-bounce" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-white">Compressing for Satellite Link...</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Converting 650-byte JSON into ultra-compact 44-byte burst packet
              </p>
            </div>
            <div className="rounded-lg border border-theme bg-black/50 p-2 font-mono text-2xs text-emerald-400">
              SZ1|SOS|V008|30.2030|78.4600|5|4|1|DATSG-KDR01
            </div>
          </div>
        )}

        {/* Satcom Step 3: Satellite Uplink Simulation */}
        {phase === 'sat_uplinking' && (
          <div className="flex flex-col items-center py-6 gap-3">
            <div className="relative">
              <div className="h-16 w-16 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Satellite size={30} className="animate-pulse" />
              </div>
              <div className="absolute inset-0 h-16 w-16 rounded-full border-2 border-cyan-400/40 animate-ping" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-cyan-300">Uplinking to GSAT-7R Transponder...</p>
              <p className="text-xs text-slate-400 mt-0.5">
                MSS S-Band 2.67 GHz · Simulating ~1120ms orbital propagation
              </p>
            </div>
            <Loader2 size={18} className="animate-spin text-cyan-400" />
          </div>
        )}

        {/* Success phase */}
        {phase === 'success' && (
          <div className="flex flex-col items-center py-4 gap-3">
            <div
              className={`h-14 w-14 rounded-full flex items-center justify-center ${
                useSatcom ? 'bg-cyan-500/20 text-cyan-400' : 'bg-emerald-500/10 text-emerald-400'
              }`}
            >
              <CheckCircle2 size={30} />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-white">
                {useSatcom ? 'SOS Relayed via Satellite!' : 'SOS Sent Successfully!'}
              </p>
              <p className="text-xs text-surface-400 mt-1">
                {useSatcom
                  ? 'Your distress packet reached INMCC Ground Gateway via GSAT-7R backhaul.'
                  : 'Your location has been transmitted to district disaster officials.'}
              </p>
            </div>

            {/* Satellite Details Pill if satcom used */}
            {useSatcom && (
              <div className="w-full rounded-2xl border border-cyan-500/30 bg-cyan-950/30 p-3.5 text-xs text-slate-300 space-y-2">
                <div className="flex items-center justify-between font-mono text-2xs border-b border-cyan-500/20 pb-2">
                  <span className="text-cyan-400 font-bold">🛰️ Satellite Backhaul — Simulated</span>
                  <span className="text-emerald-400">ACK: {satResponse?.ack_code || 'ACK-SAT-4402'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-2xs font-mono">
                  <div>
                    <span className="text-muted block">Satcom Terminal:</span>
                    <span className="text-white">ISRO DAT-SG (#DATSG-KDR01)</span>
                  </div>
                  <div>
                    <span className="text-muted block">Uplink Latency:</span>
                    <span className="text-cyan-300">{satResponse?.telemetry.latency_ms || 1085} ms</span>
                  </div>
                  <div>
                    <span className="text-muted block">Burst Packet Size:</span>
                    <span className="text-emerald-400">{compressionStats.burstBytes} Bytes ({compressionStats.ratio}% saved)</span>
                  </div>
                  <div>
                    <span className="text-muted block">Operational Priority:</span>
                    <span className="text-amber-300 font-bold">P1_URGENT</span>
                  </div>
                </div>
              </div>
            )}

            <div className="w-full rounded-xl border border-theme bg-panel p-3 text-xs text-surface-400 space-y-1">
              <p className="font-mono text-2xs uppercase text-slate-400 font-semibold mb-1">Immediate Actions</p>
              <p className="flex items-center gap-1.5 text-slate-300">
                <span>🚑</span> Quick Response Team alerted with high priority
              </p>
              <p className="flex items-center gap-1.5 text-slate-300">
                <span>📍</span> Safe Zone route & capacity ledger updated
              </p>
            </div>

            <button
              onClick={onClose}
              className="mt-2 w-full rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 py-2.5 font-semibold text-white shadow-lg transition hover:from-violet-500 hover:to-cyan-500"
            >
              Close
            </button>
          </div>
        )}

        {/* Error phase with Satellite Fallback offer */}
        {phase === 'error' && (
          <div className="flex flex-col items-center py-5 gap-3">
            <div className="h-14 w-14 rounded-full bg-red-500/10 flex items-center justify-center">
              <WifiOff size={26} className="text-red-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-white">Terrestrial Towers Unreachable</p>
              <p className="text-xs text-red-400/90 mt-1">{errorMsg}</p>
            </div>

            {!useSatcom && (
              <div className="w-full rounded-xl border border-cyan-500/30 bg-cyan-950/30 p-3 text-xs text-slate-300">
                <p className="font-semibold text-cyan-300 flex items-center gap-1 mb-1">
                  <Satellite size={14} /> Switch to Satcom Terminal
                </p>
                <p className="text-2xs text-muted mb-2">
                  Connect via Bluetooth to an ISRO DAT-SG satellite terminal for off-grid backhaul.
                </p>
                <button
                  onClick={switchToSatcom}
                  className="w-full rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 py-2 font-bold text-white shadow-md hover:from-cyan-400 hover:to-blue-500 transition"
                >
                  Connect to Satellite Gateway Node
                </button>
              </div>
            )}

            <div className="flex w-full gap-2 mt-1">
              <button
                onClick={() => {
                  setPhase('locating')
                  setErrorMsg('')
                  if (coords) sendTerrestrialSOS(coords.lat, coords.lng)
                }}
                className="flex-1 rounded-xl border border-theme bg-panel py-2 text-xs font-semibold text-surface-400 hover:text-white"
              >
                Retry Cellular
              </button>
              <button
                onClick={onClose}
                className="flex-1 rounded-xl border border-theme bg-panel py-2 text-xs font-semibold text-surface-400 hover:text-white"
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
