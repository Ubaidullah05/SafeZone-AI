'use client'

import { ThemeProvider } from '../contexts/ThemeContext'
import { ToastProvider } from '../components/Toast'
import { AuthProvider } from '../auth/AuthContext'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>{children}</AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}