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
      // Fall back to the pre-rename key so an existing user's saved theme
      // survives the rename instead of silently reverting to night.
      const stored =
        window.localStorage.getItem('safezone_theme') ??
        window.localStorage.getItem('safelink_theme')
      return (stored as ThemeMode) || 'night'
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
      window.localStorage.setItem('safezone_theme', theme)
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