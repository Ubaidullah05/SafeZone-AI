import { Bell, Moon, Sun, User, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../auth/AuthContext'

export default function Header({ isDemoMode, sosActiveCount }: { isDemoMode: boolean; sosActiveCount: number }) {
  const { theme, toggleTheme, isDay } = useTheme()
  const { user, logout } = useAuth()
  const [showProfile, setShowProfile] = useState(false)

  const displayName = user?.name || 'Authority User'
  const displayEmail = user?.email || ''
  const role = user?.role || ''

  return (
    <header className="relative flex items-center justify-between border-b border-theme bg-header px-6 py-3 backdrop-blur-xl z-30">
      {/* Left: Brand */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-golden shadow-glow-v">
          <span className="text-base">🛡️</span>
        </div>
        <div className="hidden sm:block">
          <h1 className="font-display text-base font-bold text-primary">SafeLink<span className="text-golden">-AI</span></h1>
          <p className="font-mono text-2xs text-muted">Authority control room · decision support</p>
        </div>
      </div>

      {/* Center: Status */}
      <div className="flex items-center gap-4">
        {isDemoMode && (
          <span className="rounded-full border border-golden/20 bg-golden/10 px-3 py-1 font-mono text-2xs font-medium text-golden">
            ⚡ OFFLINE FALLBACK
          </span>
        )}
        <div className="flex items-center gap-2 rounded-full border border-danger/20 bg-danger/10 px-3 py-1">
          <Bell size={13} className="text-danger animate-urgency-pulse" />
          <span className="font-mono text-xs font-semibold text-danger">{sosActiveCount} Active</span>
        </div>
      </div>

      {/* Right: Theme toggle + Profile */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleTheme}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-theme bg-panel text-muted transition-all duration-300 hover:text-golden hover:border-golden/30 hover:bg-golden/5"
          title={isDay ? 'Switch to Night Mode' : 'Switch to Day Mode'}
        >
          <div className="relative h-5 w-5">
            <Sun size={18} className={`absolute inset-0 transition-all duration-500 ${isDay ? 'rotate-0 scale-100 opacity-100 text-golden' : 'rotate-90 scale-0 opacity-0'}`} />
            <Moon size={18} className={`absolute inset-0 transition-all duration-500 ${isDay ? '-rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100 text-violet-300'}`} />
          </div>
        </button>

        <div className="relative">
          <button
            onClick={() => setShowProfile(!showProfile)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-theme bg-panel text-primary transition-all hover:border-violet-500/30"
          >
            <User size={16} className="text-muted" />
          </button>
          {showProfile && (
            <div className="absolute right-0 top-12 z-50 w-60 rounded-xl border border-theme bg-panel p-2 shadow-float backdrop-blur-xl">
              <div className="border-b border-theme px-3 py-2 mb-1">
                <p className="truncate text-sm font-medium text-primary">{displayName}</p>
                <p className="truncate text-xs text-muted">{displayEmail}</p>
                <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 font-mono text-2xs uppercase tracking-wider text-violet-300">
                  <ShieldCheck size={10} /> {role}
                </span>
              </div>
              <button
                onClick={() => { setShowProfile(false); void logout() }}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-danger/10 transition"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}