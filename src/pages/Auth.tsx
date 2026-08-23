import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { Building2, ArrowRight, Lock, Mail, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'

function mapAuthError(errorMessage?: string): string {
  if (!errorMessage) {
    return 'Email ou senha inválidos. Por favor, verifique suas credenciais.'
  }
  const lower = errorMessage.toLowerCase()
  if (lower.includes('invalid login credentials') || lower.includes('invalid_grant')) {
    return 'Email ou senha inválidos.'
  }
  if (lower.includes('email not confirmed')) {
    return 'Email não confirmado. Por favor, verifique sua caixa de entrada.'
  }
  if (lower.includes('user not found')) {
    return 'Usuário não cadastrado no sistema.'
  }
  if (lower.includes('too many requests') || lower.includes('rate limit')) {
    return 'Muitas tentativas de acesso. Tente novamente em alguns instantes.'
  }
  return 'Email ou senha inválidos. Por favor, verifique suas credenciais.'
}

export default function AuthPage() {
  const { signIn, user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Se já autenticado e carregamento concluído, redirecionar para a aplicação
  if (user && !authLoading) {
    return <Navigate to="/app/dashboard" replace />
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSubmitting(true)

    try {
      const { error } = await signIn(email.trim(), password)
      if (error) {
        setErrorMessage(mapAuthError(error.message))
      } else {
        navigate('/app/dashboard', { replace: true })
      }
    } catch {
      setErrorMessage('Ocorreu um erro ao tentar realizar o login. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-[#0E1B2C] p-4 relative overflow-hidden">
      {/* Background accents */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-teal-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10 animate-fade-in-up">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 items-center justify-center shadow-xl shadow-teal-950/60 border border-teal-400/20">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">EVO Gestão</h1>
          <p className="text-sm text-teal-400 font-medium">
            Sistema de Gestão Comercial para Distribuidoras
          </p>
        </div>

        {/* Login Card */}
        <Card className="rounded-2xl border-slate-800 bg-slate-900/90 backdrop-blur-md text-white shadow-2xl">
          <CardHeader className="space-y-1 text-center pb-4">
            <CardTitle className="text-xl font-bold text-white">Acessar Conta</CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              Entre com suas credenciais para gerenciar suas operações
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-lg bg-red-950/60 border border-red-800/60 text-red-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-semibold text-slate-300">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu.email@empresa.com.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-9 bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-teal-500 h-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-semibold text-slate-300">
                    Senha
                  </Label>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pl-9 bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-teal-500 h-10"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-teal-600 hover:bg-teal-500 text-white font-semibold h-10 rounded-lg shadow-lg shadow-teal-900/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Autenticando...</span>
                  </>
                ) : (
                  <>
                    <span>Entrar no Sistema</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col border-t border-slate-800/80 pt-4 text-center">
            <p className="text-xs text-slate-500">
              Acesso restrito para usuários cadastrados da sua distribuidora.
            </p>
          </CardFooter>
        </Card>

        {/* Footer info */}
        <p className="text-center text-[11px] text-slate-500">
          EVO Gestão © {new Date().getFullYear()} — Plataforma Multiempresa
        </p>
      </div>
    </div>
  )
}
