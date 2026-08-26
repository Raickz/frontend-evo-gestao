import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { useEmpresa } from '@/hooks/use-empresa'
import { Building2, Loader2 } from 'lucide-react'
import { canAccessPage, AppPage } from '@/lib/permissions'

interface ProtectedRouteProps {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const { loading: loadingEmpresa } = useEmpresa()

  if (loading || loadingEmpresa) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0E1B2C]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-white font-bold shadow-lg shadow-teal-950/50">
            <Building2 className="w-6 h-6 animate-pulse" />
          </div>
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
            <span>Carregando dados da distribuidora...</span>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth" replace />
  }

  return <>{children}</>
}

interface PageAccessGuardProps {
  children: ReactNode
  page: AppPage
}

export function PageAccessGuard({ children, page }: PageAccessGuardProps) {
  const { usuario } = useAuth()

  const allowed = canAccessPage(usuario?.perfil, page)

  if (!allowed) {
    return <Navigate to="/app/dashboard" replace />
  }

  return <>{children}</>
}

export const RoleRouteGuard = PageAccessGuard
