import ProtectedRoute from '../../auth/ProtectedRoute'
import AppDashboard from '../../components/AppDashboard'

export default function AuthorityRoute() {
  return (
    <ProtectedRoute>
      <AppDashboard />
    </ProtectedRoute>
  )
}