'use client'

import { Shield, Map, Radio, Brain, Zap, Users, Home, UserPlus, ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react'
import { useState } from 'react'

interface NavItem {
  id: string
  icon: LucideIcon
  label: string
  color: string
  badge?: boolean
}

const BASE_NAV: NavItem[] = [
  { id: 'risk', icon: Map, label: 'Risk Map', color: 'var(--surface-400)' },
  { id: 'sos', icon: Radio, label: 'SOS Reports', color: '#F43F5E', badge: true },
  { id: 'ground', icon: Brain, label: 'Ground Reality', color: '#C084FC' },
  { id: 'scenario', icon: Zap, label: 'What-If', color: 'var(--golden)' },
  { id: 'relocation', icon: Users, label: 'Relocation', color: '#FB923C' },
  { id: 'shelters', icon: Home, label: 'Safe Zones', color: '#34D399' },
]

interface SidebarProps {
  activeTab: string
  onTabChange: (tab: string) => void
  sosCount: number
  role?: string
}

export default function Sidebar({ activeTab, onTabChange, sosCount, role }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const nav: NavItem[] = role === 'ADMIN'
    ? [...BASE_NAV, { id: 'accounts', icon: UserPlus, label: 'Accounts', color: '#22D3EE' }]
    : BASE_NAV

  return (
    <aside className={`flex h-full flex-col border-r border-theme bg-sidebar py-5 backdrop-blur-xl transition-all duration-300 ${collapsed ? 'w-[72px]' : 'w-[72px] lg:w-[250px]'}`}>
      {/* Logo */}
      <div className="mb-6 flex items-center justify-between px-4">
        <div className="hidden items-center gap-3 lg:flex">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-golden shadow-glow-v">
            <Shield size={18} className="text-white" strokeWidth={2.5} />
          </div>
          {!collapsed && (
            <div className="animate-fade-in">
              <span className="font-display text-lg font-bold text-primary">SafeLink</span>
              <span className="block font-mono text-2xs uppercase tracking-[0.2em] text-muted">AI Platform</span>
            </div>
          )}
        </div>
        <button onClick={() => setCollapsed(!collapsed)} className="hidden lg:flex h-7 w-7 items-center justify-center rounded-lg text-muted transition hover:bg-panel hover:text-primary">
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {nav.map((item) => {
          const Icon = item.icon
          const active = activeTab === item.id
          return (
            <button key={item.id} onClick={() => onTabChange(item.id)} title={item.label}
              className={`group relative flex items-center gap-3.5 rounded-xl px-3.5 py-3 transition-all duration-200 ${active ? 'bg-panel text-primary' : 'text-muted hover:bg-panel hover:text-secondary'}`}>
              {active && <div className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full" style={{ background: item.color }} />}
              <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition" style={{ background: active ? `${item.color}18` : 'transparent' }}>
                <Icon size={18} strokeWidth={active ? 2.2 : 1.8} style={{ color: active ? item.color : undefined }} />
                {item.badge && sosCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 font-mono text-2xs font-bold text-white animate-pulse">{sosCount > 9 ? '9+' : sosCount}</span>
                )}
              </div>
              {!collapsed && <span className="hidden text-sm font-medium lg:block">{item.label}</span>}
            </button>
          )
        })}
      </nav>

      {/* Bottom */}
      {!collapsed && (
        <div className="hidden px-3 lg:block">
          <div className="rounded-xl border border-theme bg-panel p-3.5">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="h-2.5 w-2.5 rounded-full bg-safe" />
                <div className="absolute inset-0 h-2.5 w-2.5 rounded-full bg-safe animate-ping" style={{ animationDuration: '3s' }} />
              </div>
              <div>
                <span className="font-mono text-2xs uppercase tracking-wide text-muted">Decision support</span>
                <span className="block font-mono text-2xs text-muted">Public portal live at /</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}