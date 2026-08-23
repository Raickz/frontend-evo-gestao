import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { Building2, Loader2 } from 'lucide-react'

interface ProtectedRouteProps {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0E1B2C] text-white">
        <div className="flex flex-col items-center space-y-4 animate-fade-in">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-900/50">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight text-white">EVO Gestão</h1>
            <p className="text-xs text-teal-400 font-medium">
              Gestão Comercial para Distribuidoras
            </p>
          </div>
          <div className="flex items-center gap-2 pt-4 text-xs text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
            <span>Verificando autenticação e empresa...</span>
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
