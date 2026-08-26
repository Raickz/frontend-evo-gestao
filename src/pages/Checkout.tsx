import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  CreditCard,
  ShieldCheck,
  Check,
  ArrowRight,
  Loader2,
  AlertCircle,
  Building2,
  Lock,
  QrCode,
  ArrowLeft,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/use-auth'
import { useEmpresa } from '@/hooks/use-empresa'
import { AssinaturasService, Plano } from '@/services/assinaturas'
import { PagamentosService } from '@/services/pagamentos'
import { toast } from '@/hooks/use-toast'

export default function CheckoutPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, usuario: profile } = useAuth()
  const { empresa } = useEmpresa()

  const planoSlug = searchParams.get('plano') || 'profissional'
  const isFailure = searchParams.get('status') === 'failure'

  const [planos, setPlanos] = useState<Plano[]>([])
  const [loading, setLoading] = useState(true)
  const [processingCheckout, setProcessingCheckout] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(
    isFailure
      ? 'O pagamento não foi concluído. Você pode tentar novamente com outra forma de pagamento.'
      : null,
  )

  const selectedPlano =
    planos.find((p) => p.slug === planoSlug) ||
    planos.find((p) => p.slug === 'profissional') ||
    planos[0]

  const loadData = useCallback(async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const { data, error } = await AssinaturasService.listPlanos()
      if (error) throw error
      if (data && data.length > 0) {
        setPlanos(data)
      } else {
        setErrorMsg('Nenhum plano ativo encontrado no momento.')
      }
    } catch {
      setErrorMsg('Não foi possível carregar as informações do plano.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Se não estiver logado, redireciona para o login com retorno para o checkout
  useEffect(() => {
    if (!loading && !user) {
      navigate(`/auth?redirect=/checkout?plano=${planoSlug}`, { replace: true })
    }
  }, [loading, user, navigate, planoSlug])

  const handleCheckout = async () => {
    if (!selectedPlano?.slug) {
      toast({
        title: 'Plano inválido',
        description: 'Selecione um plano válido para prosseguir.',
        variant: 'destructive',
      })
      return
    }

    setProcessingCheckout(true)
    setErrorMsg(null)

    try {
      const { data, error } = await PagamentosService.criarCheckout(selectedPlano.slug, empresa?.id)

      if (error || !data) {
        throw new Error(error?.message || 'Falha ao iniciar pagamento com Mercado Pago.')
      }

      if (data.init_point) {
        // Redireciona para o Checkout Pro hospedado pelo Mercado Pago
        window.location.href = data.init_point
      } else {
        throw new Error('URL de pagamento não retornada pelo gateway.')
      }
    } catch (err: any) {
      console.error('Erro no checkout:', err)
      setErrorMsg(err.message || 'Ocorreu um erro ao conectar com o Mercado Pago.')
      toast({
        title: 'Erro no Checkout',
        description: err.message || 'Não foi possível iniciar o pagamento.',
        variant: 'destructive',
      })
      setProcessingCheckout(false)
    }
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-[#0B1523] text-white p-4">
        <Loader2 className="w-8 h-8 animate-spin text-teal-400 mb-2" />
        <p className="text-slate-400 text-sm">Carregando detalhes do checkout...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0B1523] text-white flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-teal-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-4xl w-full mx-auto space-y-6 relative z-10 my-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 items-center justify-center shadow-lg shadow-teal-950/60 border border-teal-400/20">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-base font-bold text-white tracking-tight">EVO Gestão</span>
              <p className="text-[11px] text-teal-400 font-medium">
                Checkout Seguro · Mercado Pago
              </p>
            </div>
          </div>

          <Link to="/planos">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Ver outros planos
            </Button>
          </Link>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-950/50 border border-red-800/60 text-red-200 text-xs flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
            <p className="flex-1">{errorMsg}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Coluna 1: Resumo do Plano (5 colunas) */}
          <div className="lg:col-span-5 space-y-4">
            <Card className="rounded-2xl border-slate-800 bg-slate-900/90 text-white shadow-xl h-full flex flex-col justify-between">
              <CardHeader className="pb-4 border-b border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-teal-400 uppercase tracking-wider">
                    Plano Selecionado
                  </span>
                  <Badge className="bg-teal-500/20 text-teal-300 border-teal-500/30 text-[10px]">
                    Mensal
                  </Badge>
                </div>
                <CardTitle className="text-2xl font-bold text-white mt-1">
                  {selectedPlano?.nome || 'Plano Profissional'}
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs">
                  {selectedPlano?.descricao || 'Gestão completa para distribuidoras em crescimento'}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 pt-4">
                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-baseline justify-between">
                  <span className="text-xs text-slate-400">Total a pagar:</span>
                  <div className="text-right">
                    <span className="text-2xl font-extrabold text-white">
                      {formatCurrency(Number(selectedPlano?.valor_mensal || 0))}
                    </span>
                    <span className="text-xs text-slate-400">/mês</span>
                  </div>
                </div>

                {/* Limites incluídos */}
                <div className="space-y-2 text-xs">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Limites da assinatura:
                  </p>
                  <div className="space-y-1 text-slate-300">
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Usuários:</span>
                      <span className="font-semibold text-white">
                        {selectedPlano?.limite_usuarios ?? 'Ilimitado'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Vendedores:</span>
                      <span className="font-semibold text-white">
                        {selectedPlano?.limite_vendedores ?? 'Ilimitado'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Produtos:</span>
                      <span className="font-semibold text-white">
                        {selectedPlano?.limite_produtos ?? 'Ilimitado'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Clientes:</span>
                      <span className="font-semibold text-white">
                        {selectedPlano?.limite_clientes ?? 'Ilimitado'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Recursos inclusos */}
                {selectedPlano?.recursos && Array.isArray(selectedPlano.recursos) && (
                  <div className="space-y-1.5 pt-2">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Recursos inclusos:
                    </p>
                    {selectedPlano.recursos.slice(0, 4).map((rec, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                        <Check className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-1">{rec}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>

              <CardFooter className="pt-2 pb-4 text-[11px] text-slate-500 border-t border-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Garantia de segurança Mercado Pago & cancelamento a qualquer momento.</span>
              </CardFooter>
            </Card>
          </div>

          {/* Coluna 2: Dados da Empresa e Gateway (7 colunas) */}
          <div className="lg:col-span-7 space-y-4">
            <Card className="rounded-2xl border-slate-800 bg-slate-900/90 text-white shadow-xl">
              <CardHeader className="pb-3 border-b border-slate-800">
                <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-teal-400" />
                  Finalizar Pagamento da Assinatura
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs">
                  Pagamento protegido diretamente pelo Mercado Pago via PIX, Cartão de Crédito ou
                  Boleto.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-5 pt-5">
                {/* Dados da empresa compradora */}
                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-700/50">
                    <span className="text-xs font-semibold text-teal-400 uppercase tracking-wider">
                      Empresa Contratante
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[10px] text-slate-400 border-slate-700"
                    >
                      Logado como {profile?.perfil || 'Usuário'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                    <div>
                      <span className="text-slate-400">Razão Social:</span>
                      <p className="font-semibold text-white truncate">
                        {empresa?.nome || 'Minha Empresa'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">Nome Fantasia:</span>
                      <p className="font-semibold text-white truncate">
                        {empresa?.nome_fantasia || '-'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">E-mail:</span>
                      <p className="font-semibold text-white truncate">
                        {empresa?.email || profile?.email || user?.email}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">CNPJ:</span>
                      <p className="font-semibold text-white truncate">
                        {empresa?.cnpj || 'Não informado'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Benefícios Mercado Pago */}
                <div className="space-y-3">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Métodos de Pagamento Disponíveis:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
                        <QrCode className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">PIX Imediato</p>
                        <p className="text-[10px] text-slate-400">Liberação na hora</p>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">Cartão</p>
                        <p className="text-[10px] text-slate-400">Até 12x no cartão</p>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                        <Lock className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">Seguro</p>
                        <p className="text-[10px] text-slate-400">Criptografia MP</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Botão de Pagamento */}
                <div className="pt-2 space-y-2">
                  <Button
                    onClick={handleCheckout}
                    disabled={processingCheckout}
                    className="w-full bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-slate-950 font-bold h-12 rounded-xl shadow-lg shadow-teal-950/60 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
                  >
                    {processingCheckout ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Gerando Checkout Mercado Pago...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Pagar com Mercado Pago</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                  <p className="text-center text-[11px] text-slate-500">
                    Você será redirecionado com segurança para o ambiente oficial do Mercado Pago.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
