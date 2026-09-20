import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider } from './components/Toast'
import { AuthProvider } from './auth/AuthContext'
import ProtectedRoute from './auth/ProtectedRoute'
import PublicView from './components/PublicView'
import LoginPage from './auth/LoginPage'
import RegisterPage from './auth/RegisterPage'
import AppDashboard from './components/AppDashboard'

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
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
                  <ProtectedRoute requiredRole="ADMIN">
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
