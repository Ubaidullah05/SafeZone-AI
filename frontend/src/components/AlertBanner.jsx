import { AlertTriangle, X } from 'lucide-react'
import { useState } from 'react'

export default function AlertBanner({ criticalCount, sosStats }) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed || (!criticalCount && (!sosStats || sosStats.new_reports === 0))) return null

  return (
    <div className="alert-banner relative border-b border-danger/15 px-6 py-3 animate-fade-in-down">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-danger/15"><AlertTriangle size={14} className="text-danger-light animate-pulse" /></div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            {criticalCount > 0 && <span className="text-danger-light font-medium"><strong>{criticalCount}</strong> villages at CRITICAL risk</span>}
            {sosStats?.new_reports > 0 && <span className="text-danger-light/80 font-medium"><strong>{sosStats.new_reports}</strong> new SOS reports pending</span>}
            {sosStats?.medical_emergencies > 0 && <span className="text-danger-light font-bold">🏥 {sosStats.medical_emergencies} medical emergencies</span>}
          </div>
        </div>
        <button onClick={() => setDismissed(true)} className="rounded-lg p-1.5 text-violet-400/40 transition hover:bg-white/5 hover:text-white"><X size={15} /></button>
      </div>
    </div>
  )
}
