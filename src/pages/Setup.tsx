import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2,
  ArrowRight,
  Lock,
  Mail,
  Loader2,
  AlertCircle,
  Phone,
  FileText,
  User,
} from 'lucide-react'
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
import { toast } from '@/hooks/use-toast'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

export default function SetupPage() {
  const navigate = useNavigate()

  const [checkingBootstrap, setCheckingBootstrap] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Seção 1 — Dados da Empresa
  const [empresaNome, setEmpresaNome] = useState('')
  const [empresaNomeFantasia, setEmpresaNomeFantasia] = useState('')
  const [empresaCnpj, setEmpresaCnpj] = useState('')
  const [empresaEmail, setEmpresaEmail] = useState('')
  const [empresaTelefone, setEmpresaTelefone] = useState('')

  // Seção 2 — Administrador Principal
  const [adminNome, setAdminNome] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminSenha, setAdminSenha] = useState('')

  useEffect(() => {
    let isMounted = true

    async function checkStatus() {
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/bootstrap-install`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(supabaseAnonKey ? { apikey: supabaseAnonKey } : {}),
          },
        })

        if (!response.ok) {
          // Se a função retornar erro de status, permite exibir formulário com fallback
          if (isMounted) setCheckingBootstrap(false)
          return
        }

        const data = await response.json()
        if (data?.bootstrapped) {
          navigate('/auth', { replace: true })
          return
        }
      } catch {
        // Falha de rede: libera para o usuário tentar ou ver estado
      } finally {
        if (isMounted) {
          setCheckingBootstrap(false)
        }
      }
    }

    checkStatus()

    return () => {
      isMounted = false
    }
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    // Frontend validations
    const cleanEmpresaNome = empresaNome.trim()
    const cleanEmpresaNomeFantasia = empresaNomeFantasia.trim()
    const cleanAdminNome = adminNome.trim()
    const cleanAdminEmail = adminEmail.trim().toLowerCase()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!cleanEmpresaNome) {
      setErrorMessage('Informe a Razão Social da empresa.')
      return
    }

    if (!cleanEmpresaNomeFantasia) {
      setErrorMessage('Informe o Nome Fantasia da empresa.')
      return
    }

    if (!cleanAdminNome) {
      setErrorMessage('Informe o nome completo do administrador.')
      return
    }

    if (!cleanAdminEmail || !emailRegex.test(cleanAdminEmail)) {
      setErrorMessage('Informe um e-mail válido para o administrador.')
      return
    }

    if (!adminSenha || adminSenha.length < 6) {
      setErrorMessage('A senha deve ter no mínimo 6 caracteres.')
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/bootstrap-install`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(supabaseAnonKey ? { apikey: supabaseAnonKey } : {}),
        },
        body: JSON.stringify({
          empresa_nome: cleanEmpresaNome,
          empresa_nome_fantasia: cleanEmpresaNomeFantasia,
          empresa_cnpj: empresaCnpj.trim() || undefined,
          empresa_email: empresaEmail.trim() || undefined,
          empresa_telefone: empresaTelefone.trim() || undefined,
          admin_nome: cleanAdminNome,
          admin_email: cleanAdminEmail,
          admin_senha: adminSenha,
        }),
      })

      const result = await response.json().catch(() => null)

      if (!response.ok || !result?.sucesso) {
        const errorText =
          result?.erro || 'Não foi possível configurar o sistema. Verifique sua conexão.'

        if (errorText.includes('já possui um administrador')) {
          toast({
            title: 'Sistema já inicializado',
            description: 'O sistema já possui um administrador configurado. Faça login.',
            variant: 'destructive',
          })
          navigate('/auth', { replace: true })
          return
        }

        setErrorMessage(errorText)
        return
      }

      // Sucesso
      toast({
        title: 'Sucesso!',
        description: 'Empresa configurada com sucesso! Faça login para continuar.',
        className: 'bg-emerald-700 text-white border-emerald-600',
      })

      navigate('/auth', { replace: true })
    } catch {
      setErrorMessage('Não foi possível configurar o sistema. Verifique sua conexão.')
    } finally {
      setSubmitting(false)
    }
  }

  if (checkingBootstrap) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-[#0E1B2C] p-4">
        <div className="inline-flex h-14 w-14 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 items-center justify-center shadow-xl shadow-teal-950/60 border border-teal-400/20 mb-4 animate-pulse">
          <Building2 className="w-8 h-8 text-white" />
        </div>
        <Loader2 className="w-8 h-8 animate-spin text-teal-400 mb-2" />
        <p className="text-slate-400 text-sm">Verificando status do sistema...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-[#0E1B2C] p-4 py-8 relative overflow-hidden">
      {/* Background accents */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-teal-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-xl space-y-6 relative z-10 animate-fade-in-up my-auto">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 items-center justify-center shadow-xl shadow-teal-950/60 border border-teal-400/20">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">EVO Gestão</h1>
          <p className="text-sm text-teal-400 font-medium">Configuração Inicial</p>
        </div>

        {/* Setup Card */}
        <Card className="rounded-2xl border-slate-800 bg-slate-900/90 backdrop-blur-md text-white shadow-2xl">
          <CardHeader className="space-y-1 text-center pb-4">
            <CardTitle className="text-xl font-bold text-white">
              Criar Primeira Empresa & Administrador
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              Preencha os dados abaixo para inicializar o sistema e criar a conta Master
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {errorMessage && (
                <div className="p-3 rounded-lg bg-red-950/60 border border-red-800/60 text-red-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Seção 1: Dados da Empresa */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-1 border-b border-slate-800">
                  <Building2 className="w-4 h-4 text-teal-400" />
                  <h2 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                    Dados da Empresa
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor="empresa_nome" className="text-xs font-medium text-slate-300">
                      Razão Social <span className="text-teal-400">*</span>
                    </Label>
                    <Input
                      id="empresa_nome"
                      type="text"
                      placeholder="Minha Empresa Distribuidora LTDA"
                      value={empresaNome}
                      onChange={(e) => setEmpresaNome(e.target.value)}
                      required
                      className="bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-teal-500 h-9 text-sm"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <Label
                      htmlFor="empresa_nome_fantasia"
                      className="text-xs font-medium text-slate-300"
                    >
                      Nome Fantasia <span className="text-teal-400">*</span>
                    </Label>
                    <Input
                      id="empresa_nome_fantasia"
                      type="text"
                      placeholder="Minha Distribuidora"
                      value={empresaNomeFantasia}
                      onChange={(e) => setEmpresaNomeFantasia(e.target.value)}
                      required
                      className="bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-teal-500 h-9 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="empresa_cnpj" className="text-xs font-medium text-slate-300">
                      CNPJ <span className="text-slate-500 text-[11px]">(opcional)</span>
                    </Label>
                    <div className="relative">
                      <FileText className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
                      <Input
                        id="empresa_cnpj"
                        type="text"
                        placeholder="00.000.000/0001-00"
                        value={empresaCnpj}
                        onChange={(e) => setEmpresaCnpj(e.target.value)}
                        className="pl-8 bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-teal-500 h-9 text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label
                      htmlFor="empresa_telefone"
                      className="text-xs font-medium text-slate-300"
                    >
                      Telefone <span className="text-slate-500 text-[11px]">(opcional)</span>
                    </Label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
                      <Input
                        id="empresa_telefone"
                        type="text"
                        placeholder="(00) 00000-0000"
                        value={empresaTelefone}
                        onChange={(e) => setEmpresaTelefone(e.target.value)}
                        className="pl-8 bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-teal-500 h-9 text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor="empresa_email" className="text-xs font-medium text-slate-300">
                      Email da Empresa{' '}
                      <span className="text-slate-500 text-[11px]">(opcional)</span>
                    </Label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
                      <Input
                        id="empresa_email"
                        type="email"
                        placeholder="contato@minhadistribuidora.com.br"
                        value={empresaEmail}
                        onChange={(e) => setEmpresaEmail(e.target.value)}
                        className="pl-8 bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-teal-500 h-9 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção 2: Administrador Principal */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-1 border-b border-slate-800">
                  <User className="w-4 h-4 text-teal-400" />
                  <h2 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                    Administrador Principal
                  </h2>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="admin_nome" className="text-xs font-medium text-slate-300">
                      Nome Completo <span className="text-teal-400">*</span>
                    </Label>
                    <div className="relative">
                      <User className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
                      <Input
                        id="admin_nome"
                        type="text"
                        placeholder="Nome do Administrador"
                        value={adminNome}
                        onChange={(e) => setAdminNome(e.target.value)}
                        required
                        className="pl-8 bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-teal-500 h-9 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="admin_email" className="text-xs font-medium text-slate-300">
                        Email de Acesso <span className="text-teal-400">*</span>
                      </Label>
                      <div className="relative">
                        <Mail className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
                        <Input
                          id="admin_email"
                          type="email"
                          placeholder="admin@empresa.com.br"
                          value={adminEmail}
                          onChange={(e) => setAdminEmail(e.target.value)}
                          required
                          className="pl-8 bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-teal-500 h-9 text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="admin_senha" className="text-xs font-medium text-slate-300">
                        Senha <span className="text-teal-400">*</span>
                      </Label>
                      <div className="relative">
                        <Lock className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
                        <Input
                          id="admin_senha"
                          type="password"
                          placeholder="Mínimo 6 caracteres"
                          value={adminSenha}
                          onChange={(e) => setAdminSenha(e.target.value)}
                          required
                          minLength={6}
                          className="pl-8 bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-teal-500 h-9 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-teal-600 hover:bg-teal-500 text-white font-semibold h-11 rounded-lg shadow-lg shadow-teal-900/30 transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Configurando sistema...</span>
                  </>
                ) : (
                  <>
                    <span>Criar Empresa e Acessar o Sistema</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex flex-col border-t border-slate-800/80 pt-4 text-center">
            <p className="text-xs text-slate-500">
              Esta etapa é executada uma única vez para inicializar o sistema.
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
