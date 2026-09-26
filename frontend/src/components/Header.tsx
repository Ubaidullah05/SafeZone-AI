import { Bell, Moon, Sun, User, ShieldCheck, Menu } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../auth/AuthContext'

export default function Header({ isDemoMode, sosActiveCount, onOpenMobileSidebar }: { isDemoMode: boolean; sosActiveCount: number; onOpenMobileSidebar: () => void }) {
  const { toggleTheme, isDay } = useTheme()
  const { user, logout } = useAuth()
  const [showProfile, setShowProfile] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  // Dismiss the profile menu on outside tap or Escape. On touch devices there
  // is no hover and no second click target, so without this the menu traps you.
  useEffect(() => {
    if (!showProfile) return
    const onPointerDown = (e: PointerEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfile(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowProfile(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [showProfile])

  const displayName = user?.name || 'User'
  const displayEmail = user?.email || ''
  const role = user?.role || ''

  return (
    <header className="safe-area-x relative z-30 flex items-center justify-between border-b border-theme bg-header px-3 py-2.5 backdrop-blur-xl sm:px-6 sm:py-3">
      {/* Left: Hamburger + Brand */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="flex lg:hidden h-9 w-9 items-center justify-center rounded-xl border border-theme bg-panel text-muted transition-all hover:text-primary"
        >
          <Menu size={18} />
        </button>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-golden shadow-glow-v">
          <span className="text-base">🛡️</span>
        </div>
        <div className="hidden sm:block">
          <h1 className="font-display text-base font-bold text-primary">SafeZone<span className="text-golden">-AI</span></h1>
          <p className="font-mono text-2xs text-muted">District safety board</p>
        </div>
      </div>

      {/* Center: Status */}
      <div className="flex items-center gap-2 sm:gap-4">
        {isDemoMode && (
          <span className="hidden rounded-full border border-golden/20 bg-golden/10 px-2 py-0.5 font-mono text-2xs font-medium text-golden sm:inline sm:px-3 sm:py-1">
            ⚡ DEMO MODE
          </span>
        )}
        <div className="flex items-center gap-1.5 rounded-full border border-danger/20 bg-danger/10 px-2 py-0.5 sm:px-3 sm:py-1">
          <Bell size={12} className="text-danger animate-urgency-pulse sm:text-[13px]" />
          <span className="font-mono text-2xs font-semibold text-danger sm:text-xs">{sosActiveCount}</span>
        </div>
      </div>

      {/* Right: Theme toggle + Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={toggleTheme}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-theme bg-panel text-muted transition-all duration-300 hover:text-golden hover:border-golden/30 hover:bg-golden/5"
          title={isDay ? 'Dark mode' : 'Light mode'}
        >
          <div className="relative h-5 w-5">
            <Sun size={18} className={`absolute inset-0 transition-all duration-500 ${isDay ? 'rotate-0 scale-100 opacity-100 text-golden' : 'rotate-90 scale-0 opacity-0'}`} />
            <Moon size={18} className={`absolute inset-0 transition-all duration-500 ${isDay ? '-rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100 text-violet-300'}`} />
          </div>
        </button>

        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setShowProfile(!showProfile)}
            aria-expanded={showProfile}
            aria-haspopup="menu"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-theme bg-panel text-primary transition-all hover:border-violet-500/30"
          >
            <User size={16} className="text-muted" />
          </button>
          {showProfile && (
            <div className="absolute right-0 top-12 z-50 w-56 rounded-xl border border-theme bg-panel p-2 shadow-float backdrop-blur-xl sm:w-60">
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
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
