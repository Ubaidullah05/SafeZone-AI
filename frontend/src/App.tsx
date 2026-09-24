import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider, useToast } from './components/Toast'
import { AuthProvider } from './auth/AuthContext'
import ProtectedRoute from './auth/ProtectedRoute'
import PublicView from './components/PublicView'
import LoginPage from './auth/LoginPage'
import RegisterPage from './auth/RegisterPage'
import AppDashboard from './components/AppDashboard'
import { initOfflineSync } from './services/offlineQueue'
import { syncOfflineQueue } from './services/api'

function OfflineSyncManager() {
  const { addToast } = useToast()

  useEffect(() => {
    const handleSynced = (e: Event) => {
      const customEvent = e as CustomEvent<{ synced: number; remaining: number }>
      if (customEvent.detail && customEvent.detail.synced > 0) {
        addToast({
          type: 'success',
          title: 'Offline SOS Synced',
          message: `${customEvent.detail.synced} emergency report(s) forwarded to authorities.`,
          duration: 6000,
        })
      }
    }

    window.addEventListener('safezone:sos-synced', handleSynced)
    const cleanup = initOfflineSync(() => syncOfflineQueue())

    return () => {
      window.removeEventListener('safezone:sos-synced', handleSynced)
      cleanup()
    }
  }, [addToast])

  return null
}

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <OfflineSyncManager />
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<PublicView />} />
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/register"
                element={
                  <ProtectedRoute requiredRole="ADMIN">
                    <RegisterPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/authority"
                element={
                  <ProtectedRoute requiredRole={['ADMIN', 'OFFICIAL']}>
                    <AppDashboard />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}

export default App
