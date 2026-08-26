import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { ShieldCheck, Loader2 } from 'lucide-react'

interface AdminProtectedRouteProps {
  children: ReactNode
}

export function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
  const { user, usuario, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#070D18]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-700 flex items-center justify-center text-white font-bold shadow-lg shadow-sky-950/50">
            <ShieldCheck className="w-6 h-6 animate-pulse" />
          </div>
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
            <span>Verificando credenciais de plataforma...</span>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth" replace />
  }

  if (usuario?.perfil !== 'platform_admin') {
    // Se for usuário autenticado mas não platform_admin, redireciona para o app da empresa
    return <Navigate to="/app/dashboard" replace />
  }

  return <>{children}</>
}
