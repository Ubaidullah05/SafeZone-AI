import { useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import type { Role } from '../types'

interface ProtectedRouteProps {
  children: ReactNode
  requiredRole?: Role | Role[]
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login', { replace: true })
    }
  }, [loading, user, navigate])

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          <p className="font-mono text-sm text-slate-500 dark:text-slate-400">Authenticating…</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  // Role-based access control
  if (requiredRole) {
    const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
    if (!allowed.includes(user.role as Role)) {
      return null
    }
  }

  return <>{children}</>
}
