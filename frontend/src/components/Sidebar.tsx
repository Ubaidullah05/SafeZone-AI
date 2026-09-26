import { Shield, Map, Radio, Brain, Zap, Users, Home, UserPlus, ChevronLeft, ChevronRight, X, Satellite, type LucideIcon } from 'lucide-react'
import { useState, useEffect } from 'react'

interface NavItem {
  id: string
  icon: LucideIcon
  label: string
  color: string
  badge?: boolean
}

const BASE_NAV: NavItem[] = [
  { id: 'risk', icon: Map, label: 'Danger Map', color: 'var(--surface-400)' },
  { id: 'sos', icon: Radio, label: 'Emergency Calls', color: '#F43F5E', badge: true },
  { id: 'satellite', icon: Satellite, label: 'Satcom Backhaul', color: '#22D3EE' },
  { id: 'ground', icon: Brain, label: 'What People Report', color: '#C084FC' },
  { id: 'scenario', icon: Zap, label: 'What If', color: 'var(--golden)' },
  { id: 'relocation', icon: Users, label: 'Who Should Move', color: '#FB923C' },
  { id: 'shelters', icon: Home, label: 'Shelters', color: '#34D399' },
]

interface SidebarProps {
  activeTab: string
  onTabChange: (tab: string) => void
  sosCount: number
  role?: string
  mobileOpen: boolean
  onMobileClose: () => void
}

export default function Sidebar({ activeTab, onTabChange, sosCount, role, mobileOpen, onMobileClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  // Model internals (factor weights, provenance) are official/admin only.
  const officialNav: NavItem[] = [{ id: 'learning', icon: Brain, label: 'How It Learned', color: '#34D399' }]
  const nav: NavItem[] = role === 'ADMIN'
    ? [...BASE_NAV, ...officialNav, { id: 'accounts', icon: UserPlus, label: 'People', color: '#22D3EE' }]
    : role === 'OFFICIAL'
      ? [...BASE_NAV, ...officialNav]
      : BASE_NAV

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onMobileClose()
      }
      window.addEventListener('keydown', onKeyDown)
      return () => {
        document.body.style.overflow = ''
        window.removeEventListener('keydown', onKeyDown)
      }
    }
  }, [mobileOpen, onMobileClose])

  const handleNav = (id: string) => {
    onTabChange(id)
    onMobileClose()
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="mb-6 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-golden shadow-glow-v">
            <Shield size={18} className="text-white" strokeWidth={2.5} />
          </div>
          <div className="animate-fade-in">
            <span className="font-display text-lg font-bold text-primary">SafeLink</span>
            <span className="block font-mono text-2xs uppercase tracking-[0.2em] text-muted">AI Platform</span>
          </div>
        </div>
        {/* Desktop collapse button */}
        <button onClick={() => setCollapsed(!collapsed)} className="hidden lg:flex h-7 w-7 items-center justify-center rounded-lg text-muted transition hover:bg-panel hover:text-primary">
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
        {/* Mobile close button */}
        <button onClick={onMobileClose} className="flex lg:hidden h-7 w-7 items-center justify-center rounded-lg text-muted transition hover:bg-panel hover:text-primary">
          <X size={16} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {nav.map((item) => {
          const Icon = item.icon
          const active = activeTab === item.id
          return (
            <button key={item.id} onClick={() => handleNav(item.id)} title={item.label}
              className={`group relative flex items-center gap-3.5 rounded-xl px-3.5 py-3 transition-all duration-200 ${active ? 'bg-panel text-primary' : 'text-muted hover:bg-panel hover:text-secondary'}`}>
              {active && <div className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full" style={{ background: item.color }} />}
              <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition" style={{ background: active ? `${item.color}18` : 'transparent' }}>
                <Icon size={18} strokeWidth={active ? 2.2 : 1.8} style={{ color: active ? item.color : undefined }} />
                {item.badge && sosCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 font-mono text-2xs font-bold text-white animate-pulse">{sosCount > 9 ? '9+' : sosCount}</span>
                )}
              </div>
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3">
        <div className="rounded-xl border border-theme bg-panel p-3.5">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="h-2.5 w-2.5 rounded-full bg-safe" />
              <div className="absolute inset-0 h-2.5 w-2.5 rounded-full bg-safe animate-ping" style={{ animationDuration: '3s' }} />
            </div>
            <div>
              <span className="font-mono text-2xs uppercase tracking-wide text-muted">Safety help</span>
              <span className="block font-mono text-2xs text-muted">Public page at /</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex h-full flex-col border-r border-theme bg-sidebar py-5 backdrop-blur-xl transition-all duration-300 ${collapsed ? 'w-[72px]' : 'w-[250px]'}`}>
        {sidebarContent}
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
            onClick={onMobileClose}
          />
          {/* Drawer. Scrollable because the nav plus the footer card overflow
              short screens and landscape phones. */}
          <aside
            className="mobile-scroll absolute left-0 top-0 h-full w-[min(280px,85vw)] flex flex-col overscroll-contain border-r border-theme bg-sidebar py-5 backdrop-blur-xl animate-slide-in-left"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
          >
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  )
}
