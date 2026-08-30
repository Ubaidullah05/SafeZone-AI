import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('safelink_theme') || 'night'
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
      localStorage.setItem('safelink_theme', theme)
    } catch {}
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'day' ? 'night' : 'day')

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDay: theme === 'day', isNight: theme === 'night' }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
