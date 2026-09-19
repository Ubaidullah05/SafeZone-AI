'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import * as api from '../services/api'
import { getCachedSession, cacheSession, clearSession } from '../services/offlineCache'
import type { AuthUser, Role } from '../types'

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  loading: boolean
  authError: string
  setAuthError: (msg: string) => void
  isLoggedIn: boolean
  login: (email: string, password: string) => Promise<AuthUser>
  pinLogin: (email: string, pin: string) => Promise<AuthUser>
  register: (name: string, email: string, password: string, role: Role, department?: string, pin?: string) => Promise<AuthUser>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readLocal(key: string): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(key)
}

function writeLocal(key: string, value: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, value)
}

function removeLocal(key: string) {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(key)
}

function parseUser(raw: string | null): AuthUser | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(() => readLocal('safezone_token'))
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const restoredRef = useRef(false)

  // Restore session (IDB snapshot or verify token against backend)
  const restore = useCallback(async () => {
    setLoading(true)
    const cached = await getCachedSession().catch(() => null)
    const savedUser = readLocal('safezone_user')

    // No token at all → anonymous guest (public view works without login)
    if (!readLocal('safezone_token')) {
      setLoading(false)
      return
    }

    // 1) Local snapshot is enough to render
    if (savedUser || cached?.user) {
      const u = parseUser(savedUser) ?? cached?.user ?? null
      setUser(u)
      setLoading(false)

      // 2) Re-validate in background, refresh snapshot
      try {
        const me = await api.getMe()
        setUser(me)
        writeLocal('safezone_user', JSON.stringify(me))
        await cacheSession(readLocal('safezone_token') ?? '', me).catch(() => {})
      } catch {
        // Token expired/revoked → clear session
        removeLocal('safezone_token')
        removeLocal('safezone_user')
        await clearSession().catch(() => {})
        setUser(null)
        setToken(null)
      }
      return
    }

    // 3) Token present, no snapshot → full validation
    try {
      const me = await api.getMe()
      setUser(me)
      writeLocal('safezone_user', JSON.stringify(me))
      await cacheSession(readLocal('safezone_token') ?? '', me).catch(() => {})
    } catch {
      // Invalid session → back to guest
      removeLocal('safezone_token')
      removeLocal('safezone_user')
      await clearSession().catch(() => {})
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!restoredRef.current) {
      restoredRef.current = true
      void restore()
    }
  }, [restore])

  const handleSignOut = useCallback(async () => {
    removeLocal('safezone_token')
    removeLocal('safezone_user')
    await clearSession().catch(() => {})
    setUser(null)
    setToken(null)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setAuthError('')
    try {
      const data = await api.loginUser(email, password)
      writeLocal('safezone_token', data.access_token)
      writeLocal('safezone_user', JSON.stringify(data.user))
      setToken(data.access_token)
      setUser(data.user)
      await cacheSession(data.access_token, data.user).catch(() => {})
      return data.user
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail
      setAuthError(typeof detail === 'string' ? detail : 'Invalid email or password')
      throw err
    }
  }, [])

  const pinLoginCb = useCallback(async (email: string, pin: string) => {
    setAuthError('')
    try {
      const data = await api.pinLogin(email, pin)
      writeLocal('safezone_token', data.access_token)
      writeLocal('safezone_user', JSON.stringify(data.user))
      setToken(data.access_token)
      setUser(data.user)
      await cacheSession(data.access_token, data.user).catch(() => {})
      return data.user
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail
      setAuthError(typeof detail === 'string' ? detail : 'Invalid PIN for this account')
      throw err
    }
  }, [])

  // ADMIN-only: create an authority account. Returns the created user WITHOUT
  // switching the current session.
  const register = useCallback(
    async (name: string, email: string, password: string, role: Role, department = '', pin = '') => {
      setAuthError('')
      const data = await api.registerUser(name, email, password, role, department, pin)
      return data.user
    },
    []
  )

  const value: AuthContextValue = {
    user,
    token,
    loading,
    authError,
    setAuthError,
    isLoggedIn: !!token,
    login,
    pinLogin: pinLoginCb,
    register,
    logout: handleSignOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}