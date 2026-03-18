import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthSession } from '../hooks/useAuth'

export default function RequireAuth() {
  const { loading, session } = useAuthSession()
  const loc = useLocation()

  if (loading) {
    return <div className="p-6 font-mono text-xs uppercase tracking-widest opacity-60">Auth_Check...</div>
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  }

  return <Outlet />
}
