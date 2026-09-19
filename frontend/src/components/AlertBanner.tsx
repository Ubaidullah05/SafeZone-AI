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
    <div className="alert-banner relative border-b border-danger/15 px-3 py-2 animate-fade-in-down sm:px-6 sm:py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-danger/15 sm:h-8 sm:w-8"><AlertTriangle size={13} className="text-danger-light animate-pulse sm:w-[14px]" /></div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs sm:gap-x-5 sm:text-sm">
            {criticalCount > 0 && <span className="text-danger-light font-medium"><strong>{criticalCount}</strong> <span className="hidden sm:inline">villages at critical danger</span><span className="sm:hidden">critical</span></span>}
            {newReports > 0 && <span className="text-danger-light/80 font-medium"><strong>{newReports}</strong> <span className="hidden sm:inline">new emergency calls pending</span><span className="sm:hidden">new calls</span></span>}
            {medicalEmergencies > 0 && <span className="text-danger-light font-bold">🏥 {medicalEmergencies} medical</span>}
          </div>
        </div>
        <button onClick={() => setDismissed(true)} className="rounded-lg p-1.5 text-violet-400/40 transition hover:bg-white/5 hover:text-white"><X size={15} /></button>
      </div>
    </div>
  )
}