import { ShieldAlert, Radio } from 'lucide-react'

export default function Header({ isDemoMode }) {
  return (
    <header className="flex items-center justify-between border-b border-base-700 bg-base-900/90 px-6 py-3 backdrop-blur shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-signal-critical/10 text-signal-critical">
          <ShieldAlert size={20} strokeWidth={2.2} />
        </div>
        <div>
          <div className="flex items-baseline gap-2">
            <h1 className="font-display text-lg font-semibold tracking-tight text-slate-800">SAFEZONE-AI</h1>
            <span className="rounded border border-base-600 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-slate-500">
              SIH26191 Prototype
            </span>
          </div>
          <p className="text-xs text-slate-500">Smart Hazard Assessment &amp; Feasible Evacuation Zone Engine</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {isDemoMode && (
          <span className="rounded-full border border-signal-moderate/40 bg-signal-moderate/10 px-3 py-1 font-mono text-[11px] uppercase tracking-wide text-signal-moderate">
            Demo Data Mode
          </span>
        )}
        <div className="flex items-center gap-2 rounded-full border border-base-600 bg-base-850 px-3 py-1.5">
          <Radio size={13} className="text-signal-zone" />
          <span className="font-mono text-[11px] uppercase tracking-wide text-slate-600">
            Decision Support System — Prototype
          </span>
        </div>
      </div>
    </header>
  )
}

