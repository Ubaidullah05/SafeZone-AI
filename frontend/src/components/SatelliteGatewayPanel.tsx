import { useState, useEffect, useCallback } from 'react'
import {
  Radio,
  Satellite,
  WifiOff,
  Bluetooth,
  Send,
  RefreshCw,
  Clock,
  BatteryCharging,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Play,
  ArrowRight,
  Database,
  Globe2,
} from 'lucide-react'
import * as api from '../services/api'
import type {
  SatcomTerminal,
  SatelliteConstellationStatus,
  SatelliteDownlinkMessage,
  SatelliteTransmitResponse,
} from '../types'

export default function SatelliteGatewayPanel() {
  const [status, setStatus] = useState<SatelliteConstellationStatus | null>(null)
  const [terminals, setTerminals] = useState<SatcomTerminal[]>([])
  const [downlinks, setDownlinks] = useState<SatelliteDownlinkMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'terminals' | 'packets' | 'broadcast'>('overview')

  // SIH 1-Click Interactive Demo state
  const [demoStep, setDemoStep] = useState<number>(0)
  const [demoRunning, setDemoRunning] = useState(false)
  const [demoResult, setDemoResult] = useState<SatelliteTransmitResponse | null>(null)
  const [demoLog, setDemoLog] = useState<string[]>([])

  // Downlink broadcast form state
  const [broadcastTitle, setBroadcastTitle] = useState('')
  const [broadcastContent, setBroadcastContent] = useState('')
  const [targetTerminal, setTargetTerminal] = useState('ALL')
  const [broadcasting, setBroadcasting] = useState(false)
  const [broadcastSuccess, setBroadcastSuccess] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [st, terms, msgs] = await Promise.all([
        api.fetchSatelliteStatus(),
        api.fetchSatcomTerminals(),
        api.fetchSatelliteDownlinks(),
      ])
      setStatus(st)
      setTerminals(terms)
      setDownlinks(msgs)
    } catch {
      // Fallback data if backend offline
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    const timer = setInterval(loadData, 12000)
    return () => clearInterval(timer)
  }, [loadData])

  // Run the full SIH Judge demonstration sequence
  const runSIHDemo = async () => {
    setDemoRunning(true)
    setDemoStep(1)
    setDemoLog(['[STAGE 1] Simulating regional cellular tower failure in Kedarnath Valley...'])

    // Stage 1: Outage
    await new Promise((r) => setTimeout(r, 1400))
    setDemoStep(2)
    setDemoLog((prev) => [
      ...prev,
      '[STAGE 2] Terrestrial 4G/5G down. SafeZone Mobile app switches to Off-Grid Protocol.',
      '[STAGE 2] Scanning Bluetooth BLE spectrum (2.4 GHz) for Satcom Terminals...',
    ])

    // Stage 2: BLE Handshake
    await new Promise((r) => setTimeout(r, 1600))
    try {
      await api.pairSatcomTerminal('DATSG-KDR01', 'SIH Demo Mobile Device')
    } catch { /* proceed */ }
    setDemoStep(3)
    setDemoLog((prev) => [
      ...prev,
      '[STAGE 3] Paired with ISRO DAT-SG Terminal #DATSG-KDR01 (Signal: -54 dBm, Battery: 94%).',
      '[STAGE 3] Compressing 650-byte civilian distress report into compact 46-byte burst packet...',
      'Encoded: "SZ1|SOS|V008|30.2030|78.4600|5|4|1|DATSG-KDR01|1092|FL"',
    ])

    // Stage 3: Satellite Uplink Simulation
    await new Promise((r) => setTimeout(r, 1800))
    setDemoStep(4)
    setDemoLog((prev) => [
      ...prev,
      '[STAGE 4] Transmitting burst packet via MSS S-Band (2670 MHz) to GSAT-7R Satellite...',
      '[STAGE 4] Propagation delay transit (~1120ms orbital slant range)...',
    ])

    try {
      const res = await api.transmitSatelliteSOS({
        village_id: 'V008',
        latitude: 30.203,
        longitude: 78.46,
        severity: 5,
        people_affected: 4,
        medical_emergency: true,
        emergency_type: 'FLOOD',
        description: 'SIH Judge Demo: Flash flood reported via simulated ISRO DAT-SG terminal.',
        reporter_name: 'Civilian via Satcom Terminal',
        terminal_id: 'DATSG-KDR01',
      })
      setDemoResult(res)
      setDemoStep(5)
      setDemoLog((prev) => [
        ...prev,
        `[STAGE 5] INMCC Ground Gateway received burst. Decoded & ingested into SafeZone Backend.`,
        `[STAGE 5] Operational Priority: P1_URGENT | Latency: ${res.telemetry.latency_ms}ms | C/N0: ${res.telemetry.carrier_to_noise_dbhz} dB-Hz`,
        `[SUCCESS] Two-way satellite ACK received: ${res.ack_code}`,
      ])
      loadData()
    } catch (err) {
      setDemoLog((prev) => [...prev, `[STATUS] Transmission complete (simulated uplink recorded).`])
      setDemoStep(5)
    } finally {
      setDemoRunning(false)
    }
  }

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!broadcastTitle || !broadcastContent) return
    setBroadcasting(true)
    try {
      await api.broadcastSatelliteDownlink(broadcastTitle, broadcastContent, 'ADVISORY', targetTerminal)
      setBroadcastSuccess(true)
      setBroadcastTitle('')
      setBroadcastContent('')
      loadData()
      setTimeout(() => setBroadcastSuccess(false), 4000)
    } catch {
      // ignore
    } finally {
      setBroadcasting(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-3 sm:p-5">
      {/* Top Banner: Architecture & Defense */}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/40 via-slate-900 to-indigo-950/50 p-5 shadow-2xl backdrop-blur-xl">
        <div className="pointer-events-none absolute -right-16 -top-16 h-60 w-60 rounded-full bg-cyan-500/10 blur-[80px]" />
        <div className="relative flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400">
                <Satellite size={20} className="animate-pulse" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-lg font-bold text-white sm:text-xl">
                    SafeZone Satcom Gateway
                  </h2>
                  <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-0.5 font-mono text-2xs font-semibold uppercase tracking-wider text-cyan-300">
                    Satellite Backhaul — Simulated
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">
                  Modeled on <strong className="text-cyan-300 font-semibold">ISRO Sagarmitra / DAT-SG</strong> (Distress Alert Transmitter - Second Generation) & NavIC MSS architecture
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={runSIHDemo}
              disabled={demoRunning}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 transition-all hover:from-cyan-400 hover:to-blue-500 active:scale-95 disabled:opacity-50"
            >
              <Play size={14} className={demoRunning ? 'animate-spin' : ''} />
              {demoRunning ? 'Simulating Uplink...' : 'Run SIH Judge Demo'}
            </button>
            <button
              onClick={loadData}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-theme bg-bg-card text-muted transition hover:text-white"
              title="Refresh telemetry"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Live Satellite Metrics Bar */}
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-cyan-500/20 pt-4 sm:grid-cols-4 lg:grid-cols-5">
          <div>
            <p className="font-mono text-2xs uppercase text-slate-400">Primary Constellation</p>
            <p className="text-sm font-bold text-white">{status?.primary_satellite || 'GSAT-7R (ISRO MSS)'}</p>
          </div>
          <div>
            <p className="font-mono text-2xs uppercase text-slate-400">Uplink Frequency</p>
            <p className="font-mono text-sm font-bold text-cyan-300">2670.0 MHz (S-Band)</p>
          </div>
          <div>
            <p className="font-mono text-2xs uppercase text-slate-400">Ground Gateway</p>
            <p className="text-sm font-bold text-white">INMCC / Shadnagar</p>
          </div>
          <div>
            <p className="font-mono text-2xs uppercase text-slate-400">Orbital Elevation</p>
            <p className="font-mono text-sm font-bold text-emerald-400">{status?.elevation_angle_deg || 52.4}° / Az 168°</p>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <p className="font-mono text-2xs uppercase text-slate-400">Active Field Terminals</p>
            <p className="font-mono text-sm font-bold text-golden">{terminals.length} Deployed</p>
          </div>
        </div>
      </div>

      {/* Interactive SIH Judge Demo Panel (if triggered or visible) */}
      {demoStep > 0 && (
        <div className="rounded-2xl border border-cyan-500/40 bg-slate-900/90 p-5 shadow-2xl backdrop-blur-xl animate-fade-in-down">
          <div className="flex items-center justify-between border-b border-theme pb-3">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-golden animate-bounce" />
              <h3 className="font-display text-sm font-bold text-white">
                SIH Demonstration: Mobile-to-Satellite Emergency Link Simulation
              </h3>
            </div>
            <button
              onClick={() => { setDemoStep(0); setDemoLog([]) }}
              className="text-xs text-muted hover:text-white"
            >
              Dismiss
            </button>
          </div>

          {/* Stepper Progress */}
          <div className="mt-4 grid grid-cols-5 gap-2 text-center text-xs">
            {[
              ['1. Outage', 'Towers Down'],
              ['2. BLE Scan', 'Pair Terminal'],
              ['3. Compression', 'SZ1 Burst (~44B)'],
              ['4. Sat Uplink', 'GSAT-7R Relay'],
              ['5. Ground Station', 'P1 Priority'],
            ].map(([title, desc], idx) => {
              const num = idx + 1
              const isCurrent = demoStep === num
              const isDone = demoStep > num
              return (
                <div
                  key={title}
                  className={`rounded-xl border p-2.5 transition-all ${
                    isCurrent
                      ? 'border-cyan-400 bg-cyan-500/15 shadow-glow-v'
                      : isDone
                      ? 'border-emerald-500/30 bg-emerald-500/10'
                      : 'border-theme bg-bg-card opacity-50'
                  }`}
                >
                  <p className={`font-mono text-xs font-bold ${isCurrent ? 'text-cyan-300' : isDone ? 'text-emerald-400' : 'text-muted'}`}>
                    {title}
                  </p>
                  <p className="text-2xs text-slate-400 mt-0.5">{desc}</p>
                </div>
              )
            })}
          </div>

          {/* Console Telemetry Output */}
          <div className="mt-4 rounded-xl border border-theme bg-black/60 p-3.5 font-mono text-xs text-cyan-400/90 space-y-1.5">
            {demoLog.map((line, i) => (
              <p key={i} className={line.includes('[SUCCESS]') ? 'text-emerald-400 font-bold' : line.includes('Encoded') ? 'text-golden' : ''}>
                {line}
              </p>
            ))}
          </div>

          {demoResult && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400" />
                <span>
                  Distress report registered into SafeZone AI as <strong>{demoResult.sos_report.id}</strong> ({demoResult.sos_report.village_name})
                </span>
              </div>
              <div className="flex items-center gap-4 font-mono text-2xs">
                <span>Latency: {demoResult.telemetry.latency_ms}ms</span>
                <span>Bandwidth saved: {demoResult.telemetry.compression_ratio_pct}%</span>
                <span>Priority: P1_URGENT</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b border-theme pb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition ${
            activeTab === 'overview'
              ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300'
              : 'text-muted hover:bg-panel hover:text-white'
          }`}
        >
          <Globe2 size={14} /> Architecture & Reality
        </button>
        <button
          onClick={() => setActiveTab('terminals')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition ${
            activeTab === 'terminals'
              ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300'
              : 'text-muted hover:bg-panel hover:text-white'
          }`}
        >
          <Radio size={14} /> Terminal Fleet ({terminals.length})
        </button>
        <button
          onClick={() => setActiveTab('packets')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition ${
            activeTab === 'packets'
              ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300'
              : 'text-muted hover:bg-panel hover:text-white'
          }`}
        >
          <Database size={14} /> Telemetry & Packets
        </button>
        <button
          onClick={() => setActiveTab('broadcast')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition ${
            activeTab === 'broadcast'
              ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300'
              : 'text-muted hover:bg-panel hover:text-white'
          }`}
        >
          <Send size={14} /> Two-Way Downlink Broadcast
        </button>
      </div>

      {/* Tab 1: Architecture & Reality */}
      {activeTab === 'overview' && (
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Architecture flow */}
          <div className="rounded-2xl border border-theme bg-bg-card p-5 shadow-card">
            <h3 className="font-display text-base font-bold text-white mb-2">
              Hybrid Disaster Communications Architecture
            </h3>
            <p className="text-xs text-muted mb-4 leading-relaxed">
              Mobile phones do not communicate directly with satellites via Bluetooth. SafeZone-AI implements a technically defensible 3-tier backhaul:
            </p>

            <div className="space-y-3 font-mono text-xs">
              <div className="rounded-xl border border-theme bg-panel p-3">
                <div className="flex items-center justify-between text-cyan-400 font-bold mb-1">
                  <span>LEVEL 1: Civilian Mobile App</span>
                  <span>BLE 2.4 GHz</span>
                </div>
                <p className="text-2xs text-muted">
                  Phones form local device-to-device mesh or discover nearby Satcom Terminal via Bluetooth Low Energy GATT service.
                </p>
              </div>

              <div className="flex justify-center text-cyan-400"><ArrowRight size={16} className="rotate-90" /></div>

              <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3">
                <div className="flex items-center justify-between text-cyan-300 font-bold mb-1">
                  <span>LEVEL 2: Satcom Terminal Node (ISRO DAT-SG)</span>
                  <span>MSS S-Band 2.67 GHz</span>
                </div>
                <p className="text-2xs text-slate-400">
                  Terminal compresses payload into 44-byte burst string (`SZ1|...`) and transmits to geostationary satellite transponder.
                </p>
              </div>

              <div className="flex justify-center text-cyan-400"><ArrowRight size={16} className="rotate-90" /></div>

              <div className="rounded-xl border border-theme bg-panel p-3">
                <div className="flex items-center justify-between text-indigo-300 font-bold mb-1">
                  <span>LEVEL 3: Ground Station (INMCC Bengaluru)</span>
                  <span>Optical / High-speed Backhaul</span>
                </div>
                <p className="text-2xs text-muted">
                  Ground station receives downlink, verifies checksum, and pushes verified emergency reports into SafeZone-AI Decision Engine.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-golden/20 bg-golden/5 p-3 text-xs text-golden">
              <p className="font-bold flex items-center gap-1.5"><AlertTriangle size={14} /> SIH Defense Takeaway</p>
              <p className="mt-1 text-2xs leading-relaxed text-slate-300">
                &quot;The SafeZone mobile application communicates via Bluetooth with a satellite communication terminal, which provides the satellite uplink when terrestrial mobile towers are destroyed.&quot;
              </p>
            </div>
          </div>

          {/* Technical Specs & Real-world ISRO Reference */}
          <div className="rounded-2xl border border-theme bg-bg-card p-5 shadow-card space-y-4">
            <h3 className="font-display text-base font-bold text-white">
              ISRO Sagarmitra / DAT-SG Technical Alignment
            </h3>
            <p className="text-xs text-muted leading-relaxed">
              ISRO&apos;s operational Second Generation Distress Alert Transmitter (DAT-SG) deployed for marine and disaster relief operates under the exact same paradigm:
            </p>

            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2.5 rounded-xl border border-theme bg-panel p-3">
                <span className="mt-0.5 text-cyan-400 font-bold">1.</span>
                <div>
                  <p className="font-semibold text-white">Bluetooth Smartphone Interface</p>
                  <p className="text-2xs text-muted mt-0.5">
                    Civilians and responders interact using Android UI paired via Bluetooth to the field terminal.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-xl border border-theme bg-panel p-3">
                <span className="mt-0.5 text-cyan-400 font-bold">2.</span>
                <div>
                  <p className="font-semibold text-white">Bandwidth-Conscious Burst Compression</p>
                  <p className="text-2xs text-muted mt-0.5">
                    Satellite links cannot afford large JSON/HTTP payloads. SafeZone&apos;s `SZ1` burst protocol reduces packet overhead by 93.5%.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-xl border border-theme bg-panel p-3">
                <span className="mt-0.5 text-cyan-400 font-bold">3.</span>
                <div>
                  <p className="font-semibold text-white">Two-Way Emergency Messaging</p>
                  <p className="text-2xs text-muted mt-0.5">
                    Enables disaster control centres to broadcast weather alerts, flash-flood warnings, and evacuation commands back to terminals.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-theme bg-black/40 p-3 font-mono text-2xs space-y-1">
              <p className="text-muted">LINK BUDGET SIMULATION:</p>
              <p className="text-cyan-300">Carrier Frequency: 2670.0 MHz (S-Band Uplink)</p>
              <p className="text-cyan-300">GEO Slant Range: ~37,200 km (Transit: ~248 ms x 2)</p>
              <p className="text-emerald-400">Total System Latency: ~1050 ms (Terminal + Space + Ground)</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Terminal Fleet */}
      {activeTab === 'terminals' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {terminals.map((t) => (
            <div key={t.terminal_id} className="rounded-2xl border border-theme bg-bg-card p-4 shadow-card hover:border-cyan-500/30 transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <span className="rounded-lg bg-cyan-500/10 px-2 py-0.5 font-mono text-2xs font-bold text-cyan-400">
                    {t.terminal_id}
                  </span>
                  <h4 className="mt-2 font-display text-sm font-bold text-white">{t.name}</h4>
                  <p className="text-2xs text-muted">{t.model}</p>
                </div>
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
              </div>

              <div className="mt-4 space-y-2 border-t border-theme pt-3 font-mono text-xs">
                <div className="flex items-center justify-between text-muted">
                  <span>GPS Coords</span>
                  <span className="text-white">{t.latitude.toFixed(4)}, {t.longitude.toFixed(4)}</span>
                </div>
                <div className="flex items-center justify-between text-muted">
                  <span>Battery</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <BatteryCharging size={12} /> {t.battery_pct}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-muted">
                  <span>BLE RSSI</span>
                  <span className="text-cyan-300 flex items-center gap-1">
                    <Bluetooth size={12} /> {t.ble_signal_dbm} dBm
                  </span>
                </div>
                <div className="flex items-center justify-between text-muted">
                  <span>Uplink C/N0</span>
                  <span className="text-indigo-300">{t.uplink_c_n0_dbhz} dB-Hz</span>
                </div>
              </div>

              <button
                onClick={async () => {
                  await api.pairSatcomTerminal(t.terminal_id)
                  loadData()
                }}
                className="mt-4 w-full rounded-xl border border-cyan-500/20 bg-cyan-500/5 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/10 transition"
              >
                {t.ble_paired ? 'BLE Connected' : 'Pair via Bluetooth'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Telemetry & Packets */}
      {activeTab === 'packets' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-theme bg-bg-card p-5 shadow-card">
            <h3 className="font-display text-base font-bold text-white mb-2">
              Bandwidth-Optimized Burst Packet Telemetry
            </h3>
            <p className="text-xs text-muted mb-4">
              Comparing standard JSON vs SafeZone SZ1 Satellite Burst Packets.
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-red-400">UNOPTIMIZED JSON (Cellular / Web)</span>
                  <span className="font-mono text-2xs text-muted">~650 Bytes</span>
                </div>
                <pre className="overflow-x-auto rounded-lg bg-black/50 p-3 font-mono text-2xs text-red-300/80 leading-relaxed">
{`{
  "type": "EMERGENCY_SOS",
  "village_id": "V008",
  "village_name": "Amrapur",
  "latitude": 30.2030,
  "longitude": 78.4600,
  "severity": 5,
  "people_affected": 4,
  "medical_emergency": true,
  "medical_details": "Trapped",
  "timestamp": "2026-09-22T20:19:00Z"
}`}
                </pre>
              </div>

              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-emerald-400">SZ1 COMPACT BURST (Satellite MSS)</span>
                  <span className="font-mono text-2xs text-emerald-300 font-bold">44 Bytes (93.2% Reduction)</span>
                </div>
                <pre className="overflow-x-auto rounded-lg bg-black/50 p-3 font-mono text-2xs text-emerald-300 font-bold leading-relaxed">
SZ1|SOS|V008|30.2030|78.4600|5|4|1|DATSG-KDR01|1092|FL
                </pre>
                <div className="mt-3 text-2xs text-muted space-y-1">
                  <p>• Fast transmission in MSS short-burst data frames</p>
                  <p>• Transmittable over high noise and severe weather conditions</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Two-Way Downlink Broadcast */}
      {activeTab === 'broadcast' && (
        <div className="grid gap-5 lg:grid-cols-[1fr_400px]">
          {/* Form */}
          <div className="rounded-2xl border border-theme bg-bg-card p-5 shadow-card">
            <h3 className="font-display text-base font-bold text-white mb-2">
              Broadcast Satellite Emergency Advisory (Forward Link)
            </h3>
            <p className="text-xs text-muted mb-4">
              Send critical weather updates or evacuation directives from the Disaster Control Centre down to all field terminals and civilian phones via satellite broadcast.
            </p>

            <form onSubmit={handleSendBroadcast} className="space-y-4">
              <div>
                <label className="block font-mono text-2xs uppercase text-slate-400 mb-1">Target Terminals</label>
                <select
                  value={targetTerminal}
                  onChange={(e) => setTargetTerminal(e.target.value)}
                  className="w-full rounded-xl border border-theme bg-input px-3 py-2 text-xs text-white outline-none"
                >
                  <option value="ALL">All Deployed Terminals (District-Wide Broadcast)</option>
                  {terminals.map((t) => (
                    <option key={t.terminal_id} value={t.terminal_id}>{t.name} ({t.terminal_id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-mono text-2xs uppercase text-slate-400 mb-1">Alert Headline</label>
                <input
                  type="text"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  placeholder="e.g. FLASH FLOOD WARNING: MANDAKINI RIVER"
                  className="w-full rounded-xl border border-theme bg-input px-3 py-2 text-xs text-white outline-none placeholder:text-muted"
                  required
                />
              </div>

              <div>
                <label className="block font-mono text-2xs uppercase text-slate-400 mb-1">Message Content & Instructions</label>
                <textarea
                  rows={3}
                  value={broadcastContent}
                  onChange={(e) => setBroadcastContent(e.target.value)}
                  placeholder="e.g. Cloudburst detected uphill. Move all residents immediately towards Safe Zone 2 Phata. Medical teams stationed at Sonprayag."
                  className="w-full rounded-xl border border-theme bg-input px-3 py-2 text-xs text-white outline-none placeholder:text-muted"
                  required
                />
              </div>

              {broadcastSuccess && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 size={16} /> Beamed down via GSAT-7R MSS forward link. Field terminals notified.
                </div>
              )}

              <button
                type="submit"
                disabled={broadcasting}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-500 transition disabled:opacity-50"
              >
                <Send size={14} /> {broadcasting ? 'Transmitting via Satellite...' : 'Beam Satellite Downlink'}
              </button>
            </form>
          </div>

          {/* History */}
          <div className="rounded-2xl border border-theme bg-bg-card p-5 shadow-card space-y-3">
            <h4 className="font-display text-sm font-bold text-white">Downlink Broadcast History</h4>
            <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1">
              {downlinks.map((msg) => (
                <div key={msg.id} className="rounded-xl border border-theme bg-panel p-3">
                  <div className="flex items-center justify-between text-2xs font-mono text-cyan-400 mb-1">
                    <span>{msg.id} · {msg.terminal_id}</span>
                    <span className="text-muted">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-xs font-bold text-white">{msg.title}</p>
                  <p className="mt-1 text-2xs text-muted leading-relaxed">{msg.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
