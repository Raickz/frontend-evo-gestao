import { useLocation, Link } from 'react-router-dom'
import { useEffect } from 'react'
import { Building2, Home, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

const NotFound = () => {
  const location = useLocation()

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.error('404: Rota não encontrada:', location.pathname)
    }
  }, [location.pathname])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F7FB] p-4 text-center">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-5 animate-fade-in-up">
        <div className="h-16 w-16 bg-teal-50 text-teal-700 rounded-2xl flex items-center justify-center mx-auto border border-teal-100">
          <Building2 className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight font-mono">404</h1>
          <h2 className="text-lg font-bold text-slate-800">Página Não Encontrada</h2>
          <p className="text-xs text-slate-500">
            A rota{' '}
            <code className="bg-slate-100 px-1.5 py-0.5 rounded text-teal-700">
              {location.pathname}
            </code>{' '}
            não existe ou você não tem permissão para acessá-la.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to="/app/dashboard" className="w-full sm:w-auto">
            <Button className="w-full bg-teal-700 hover:bg-teal-800 text-white flex items-center gap-2">
              <Home className="w-4 h-4" />
              Voltar ao Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default NotFound
