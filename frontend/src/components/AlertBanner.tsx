import { AlertTriangle, X } from 'lucide-react'
import { useState } from 'react'
import type { SOSStats } from '../types'

interface AlertBannerProps {
  criticalCount: number
  sosStats?: SOSStats | null
}

export default function AlertBanner({ criticalCount, sosStats }: AlertBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  const newReports = sosStats?.new_reports ?? 0
  const medicalEmergencies = sosStats?.medical_emergencies ?? 0
  if (dismissed || (!criticalCount && newReports === 0)) return null

  return (
    <div className="alert-banner relative border-b border-danger/15 px-6 py-3 animate-fade-in-down">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-danger/15"><AlertTriangle size={14} className="text-danger-light animate-pulse" /></div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            {criticalCount > 0 && <span className="text-danger-light font-medium"><strong>{criticalCount}</strong> villages at critical danger</span>}
            {newReports > 0 && <span className="text-danger-light/80 font-medium"><strong>{newReports}</strong> new emergency calls pending</span>}
            {medicalEmergencies > 0 && <span className="text-danger-light font-bold">🏥 {medicalEmergencies} medical emergencies</span>}
          </div>
        </div>
        <button onClick={() => setDismissed(true)} className="rounded-lg p-1.5 text-violet-400/40 transition hover:bg-white/5 hover:text-white"><X size={15} /></button>
      </div>
    </div>
  )
}