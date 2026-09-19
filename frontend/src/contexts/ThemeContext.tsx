'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

type ThemeMode = 'day' | 'night'

interface ThemeValue {
  theme: ThemeMode
  toggleTheme: () => void
  isDay: boolean
  isNight: boolean
}

const ThemeContext = createContext<ThemeValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      return (window.localStorage.getItem('safelink_theme') as ThemeMode) || 'night'
    } catch {
      return 'night'
    }
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'day') {
      root.classList.remove('dark')
    } else {
      root.classList.add('dark')
    }
    try {
      window.localStorage.setItem('safelink_theme', theme)
    } catch {
      // storage unavailable (private mode)
    }
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'day' ? 'night' : 'day'))

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDay: theme === 'day', isNight: theme === 'night' }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}