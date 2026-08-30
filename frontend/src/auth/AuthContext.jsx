import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import * as api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const savedToken = localStorage.getItem('safezone_token')
    const savedUser = localStorage.getItem('safezone_user')
    if (savedToken && savedUser) {
      setToken(savedToken)
      setUser(JSON.parse(savedUser))
    }
    setLoading(false)
  }, [])

  const login = useCallback(async (email, password) => {
    const result = await api.loginUser(email, password)
    localStorage.setItem('safezone_token', result.access_token)
    localStorage.setItem('safezone_user', JSON.stringify(result.user))
    setToken(result.access_token)
    setUser(result.user)
    return result.user
  }, [])

  const register = useCallback(async (name, email, password, role) => {
    const result = await api.registerUser(name, email, password, role)
    localStorage.setItem('safezone_token', result.access_token)
    localStorage.setItem('safezone_user', JSON.stringify(result.user))
    setToken(result.access_token)
    setUser(result.user)
    return result.user
  }, [])

  const faceLogin = useCallback(async (imageData) => {
    const result = await api.faceLogin(imageData)
    localStorage.setItem('safezone_token', result.access_token)
    localStorage.setItem('safezone_user', JSON.stringify(result.user))
    setToken(result.access_token)
    setUser(result.user)
    return result.user
  }, [])

  const loginWithFace = useCallback(async (imageData) => {
    return faceLogin(imageData)
  }, [faceLogin])

  const emergencyPin = useCallback(async (pin) => {
    const result = await api.pinLogin(pin)
    localStorage.setItem('safezone_token', result.access_token)
    localStorage.setItem('safezone_user', JSON.stringify(result.user))
    setToken(result.access_token)
    setUser(result.user)
    return result.user
  }, [])

  const loginWithPin = useCallback(async (pin) => {
    return emergencyPin(pin)
  }, [emergencyPin])

  const logout = useCallback(() => {
    localStorage.removeItem('safezone_token')
    localStorage.removeItem('safezone_user')
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, faceLogin, loginWithFace, emergencyPin, loginWithPin, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
