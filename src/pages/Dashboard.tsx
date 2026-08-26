import { useState, useEffect, useCallback } from 'react'
import {
  PageHeader,
  MetricCard,
  TableSkeleton,
  EmptyState,
  ErrorState,
} from '@/components/common/CommonUI'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useEmpresa } from '@/hooks/use-empresa'
import { useAuth } from '@/hooks/use-auth'
import {
  DollarSign,
  ShoppingCart,
  Package,
  Users,
  AlertTriangle,
  CheckCircle2,
  Boxes,
  ArrowRight,
  RefreshCw,
  ClipboardCheck,
  Circle,
  Rocket,
  ChevronDown,
  ChevronUp,
  EyeOff,
  CreditCard,
  Clock,
  ShieldAlert,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { canAccessPage } from '@/lib/permissions'
import { supabase } from '@/lib/supabase/client'
import { VendasService } from '@/services/vendas'
import { ClientesService } from '@/services/clientes'
import { ProdutosService } from '@/services/produtos'
import { EstoqueService } from '@/services/estoque'
import { AssinaturasService, AssinaturaComPlano } from '@/services/assinaturas'

interface OnboardingProgress {
  empresaNome: string | null
  empresaLogoUrl: string | null
  usuariosCount: number
  vendedoresCount: number
  clientesCount: number
  produtosCount: number
  estoqueCount: number
}

interface VendaRecente {
  id: string
  numero: number | null
  total: number
  forma_pagamento: string | null
  status: string
  created_at: string
  clientes?: {
    nome: string
  } | null
}

interface ItemEstoqueBaixo {
  quantidade: number
  produtos: {
    nome: string
    estoque_minimo: number
    unidade: string
  }
}

interface DashboardData {
  faturamentoMes: number
  vendasMesCount: number
  clientesAtivosCount: number
  produtosAtivosCount: number
  estoqueBaixoCount: number
  vendasRecentes: VendaRecente[]
  estoqueBaixoItens: ItemEstoqueBaixo[]
}

export default function DashboardPage() {
  const { empresaId, empresa } = useEmpresa()
  const { usuario } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<DashboardData>({
    faturamentoMes: 0,
    vendasMesCount: 0,
    clientesAtivosCount: 0,
    produtosAtivosCount: 0,
    estoqueBaixoCount: 0,
    vendasRecentes: [],
    estoqueBaixoItens: [],
  })

  const perfilLogado = (usuario?.perfil || '').toLowerCase()
  const isMasterOrAdmin = perfilLogado === 'master' || perfilLogado === 'admin'

  const [onboardingData, setOnboardingData] = useState<OnboardingProgress | null>(null)
  const [loadingOnboarding, setLoadingOnboarding] = useState(true)
  const [checklistDismissed, setChecklistDismissed] = useState(false)

  // Assinatura do usuário / empresa
  const { statusAssinatura, loadingStatus: loadingAssinaturaStatus, refreshStatus } = useEmpresa()
  const [assinatura, setAssinatura] = useState<AssinaturaComPlano | null>(null)
  const [loadingAssinatura, setLoadingAssinatura] = useState(true)

  // Contadores de Uso do Plano (para Master/Admin)
  const [planUsage, setPlanUsage] = useState<{
    usuarios: number
    vendedores: number
    produtos: number
    clientes: number
    vendasMes: number
  }>({
    usuarios: 0,
    vendedores: 0,
    produtos: 0,
    clientes: 0,
    vendasMes: 0,
  })

  const loadAssinatura = useCallback(async () => {
    if (!empresaId || !isMasterOrAdmin) {
      setLoadingAssinatura(false)
      return
    }

    try {
      const { data: assData } = await AssinaturasService.getByEmpresaId(empresaId)
      setAssinatura(assData)
      await refreshStatus()
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Erro ao carregar assinatura no Dashboard:', err)
      }
    } finally {
      setLoadingAssinatura(false)
    }
  }, [empresaId, isMasterOrAdmin, refreshStatus])

  // Recuperar estado dismissível de checklist completo do localStorage
  useEffect(() => {
    if (empresaId) {
      const stored = localStorage.getItem(`evo_onboarding_dismissed_${empresaId}`)
      if (stored === 'true') {
        setChecklistDismissed(true)
      }
    }
  }, [empresaId])

  const loadOnboardingProgress = useCallback(async () => {
    if (!empresaId || !isMasterOrAdmin) {
      setLoadingOnboarding(false)
      return
    }

    try {
      const [empresaRes, usuariosRes, vendedoresRes, clientesRes, produtosRes, estoquesRes] =
        await Promise.all([
          supabase.from('empresas').select('nome,logo_url').eq('id', empresaId).single(),
          supabase
            .from('usuarios')
            .select('id', { count: 'exact', head: true })
            .eq('empresa_id', empresaId)
            .eq('ativo', true),
          supabase
            .from('vendedores')
            .select('id', { count: 'exact', head: true })
            .eq('empresa_id', empresaId)
            .eq('ativo', true),
          supabase
            .from('clientes')
            .select('id', { count: 'exact', head: true })
            .eq('empresa_id', empresaId)
            .eq('ativo', true),
          supabase
            .from('produtos')
            .select('id', { count: 'exact', head: true })
            .eq('empresa_id', empresaId)
            .eq('ativo', true),
          supabase
            .from('estoques')
            .select('id', { count: 'exact', head: true })
            .eq('empresa_id', empresaId)
            .gt('quantidade', 0),
        ])

      setOnboardingData({
        empresaNome: empresaRes.data?.nome || null,
        empresaLogoUrl: empresaRes.data?.logo_url || null,
        usuariosCount: usuariosRes.count ?? 0,
        vendedoresCount: vendedoresRes.count ?? 0,
        clientesCount: clientesRes.count ?? 0,
        produtosCount: produtosRes.count ?? 0,
        estoqueCount: estoquesRes.count ?? 0,
      })
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Erro ao carregar onboarding progress:', err)
      }
    } finally {
      setLoadingOnboarding(false)
    }
  }, [empresaId, isMasterOrAdmin])

  const loadDashboardData = useCallback(async () => {
    if (!empresaId) return
    setLoading(true)
    setError(null)

    try {
      let resolvedVendedorId: string | null = null
      if (usuario?.perfil === 'vendedor') {
        const { data: vendedorData } = await supabase
          .from('vendedores')
          .select('id')
          .eq('empresa_id', empresaId)
          .eq('usuario_id', usuario.id)
          .maybeSingle()

        resolvedVendedorId = vendedorData?.id || '00000000-0000-0000-0000-000000000000'
      }

      const [
        faturamentoRes,
        vendasCountRes,
        clientesCountRes,
        produtosCountRes,
        estoqueBaixoRes,
        vendasRecentesRes,
        usuariosCountRes,
        vendedoresCountRes,
        vendasMesTotalRes,
      ] = await Promise.all([
        VendasService.getFaturamentoMensal(empresaId, resolvedVendedorId),
        VendasService.getCountMensal(empresaId, resolvedVendedorId),
        ClientesService.countAtivos(empresaId),
        ProdutosService.countAtivos(empresaId),
        EstoqueService.listEstoqueBaixo(empresaId),
        VendasService.getRecentes(empresaId, resolvedVendedorId),
        supabase
          .from('usuarios')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', empresaId)
          .eq('ativo', true),
        supabase
          .from('vendedores')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', empresaId)
          .eq('ativo', true),
        VendasService.getCountMensal(empresaId, null), // Todas as vendas finalizadas da empresa no mês
      ])

      // Verifica se houve erro em alguma das chamadas
      if (faturamentoRes.error) throw faturamentoRes.error
      if (vendasCountRes.error) throw vendasCountRes.error
      if (clientesCountRes.error) throw clientesCountRes.error
      if (produtosCountRes.error) throw produtosCountRes.error
      if (estoqueBaixoRes.error) throw estoqueBaixoRes.error
      if (vendasRecentesRes.error) throw vendasRecentesRes.error

      const totalFaturado = (faturamentoRes.data || []).reduce(
        (acc: number, curr: { total: number }) => acc + (curr.total || 0),
        0,
      )

      const estoqueBaixoList = (estoqueBaixoRes.data || []) as unknown as ItemEstoqueBaixo[]
      const vendasRecentesList = (vendasRecentesRes.data || []) as unknown as VendaRecente[]

      setData({
        faturamentoMes: totalFaturado,
        vendasMesCount: vendasCountRes.count ?? 0,
        clientesAtivosCount: clientesCountRes.count ?? 0,
        produtosAtivosCount: produtosCountRes.count ?? 0,
        estoqueBaixoCount: estoqueBaixoList.length,
        vendasRecentes: vendasRecentesList,
        estoqueBaixoItens: estoqueBaixoList,
      })

      setPlanUsage({
        usuarios: usuariosCountRes.count ?? 0,
        vendedores: vendedoresCountRes.count ?? 0,
        produtos: produtosCountRes.count ?? 0,
        clientes: clientesCountRes.count ?? 0,
        vendasMes: vendasMesTotalRes.count ?? 0,
      })
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.error('Erro ao carregar dados do dashboard:', err)
      }
      setError(
        err?.message || 'Falha ao buscar dados do Supabase. Verifique sua conexão e permissões.',
      )
    } finally {
      setLoading(false)
    }
  }, [empresaId, usuario?.perfil, usuario?.id])

  useEffect(() => {
    loadDashboardData()
    loadOnboardingProgress()
    loadAssinatura()
  }, [loadDashboardData, loadOnboardingProgress, loadAssinatura])

  const handleDismissChecklist = () => {
    if (empresaId) {
      localStorage.setItem(`evo_onboarding_dismissed_${empresaId}`, 'true')
    }
    setChecklistDismissed(true)
  }

  const checklistItems = [
    {
      key: 'dados_empresa',
      label: 'Dados da empresa preenchidos',
      done: !!onboardingData?.empresaNome,
      link: '/app/configuracoes',
      actionText: 'Configurar Empresa',
    },
    {
      key: 'logo',
      label: 'Logo cadastrada',
      done: !!onboardingData?.empresaLogoUrl,
      link: '/app/configuracoes',
      actionText: 'Enviar Logo',
    },
    {
      key: 'usuarios',
      label: 'Primeiro usuário criado',
      done: (onboardingData?.usuariosCount ?? 0) > 0,
      link: '/app/configuracoes',
      actionText: 'Criar Usuário',
    },
    {
      key: 'vendedores',
      label: 'Primeiro vendedor cadastrado',
      done: (onboardingData?.vendedoresCount ?? 0) > 0,
      link: '/app/vendedores',
      actionText: 'Cadastrar Vendedor',
    },
    {
      key: 'clientes',
      label: 'Primeiro cliente cadastrado',
      done: (onboardingData?.clientesCount ?? 0) > 0,
      link: '/app/clientes',
      actionText: 'Cadastrar Cliente',
    },
    {
      key: 'produtos',
      label: 'Primeiro produto cadastrado',
      done: (onboardingData?.produtosCount ?? 0) > 0,
      link: '/app/produtos',
      actionText: 'Cadastrar Produto',
    },
    {
      key: 'estoque',
      label: 'Estoque inicial cadastrado',
      done: (onboardingData?.estoqueCount ?? 0) > 0,
      link: '/app/estoque',
      actionText: 'Lançar Estoque',
    },
  ]

  const completedCount = checklistItems.filter((i) => i.done).length
  const isComplete = completedCount === 7
  const showFirstAccessBanner = isMasterOrAdmin && completedCount < 4

  const calcularDiasRestantesTrial = (fimStr?: string | null): number => {
    if (!fimStr) return 0
    try {
      const fim = new Date(fimStr)
      const hoje = new Date()
      hoje.setHours(0, 0, 0, 0)
      fim.setHours(0, 0, 0, 0)
      const diffMs = fim.getTime() - hoje.getTime()
      return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    } catch {
      return 0
    }
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  }

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(d)
    } catch {
      return dateStr
    }
  }

  const formatFormaPagamento = (fp?: string | null) => {
    if (!fp) return '—'
    const mapa: Record<string, string> = {
      dinheiro: 'Dinheiro',
      pix: 'PIX',
      cartao_credito: 'Cartão de Crédito',
      cartao_debito: 'Cartão de Débito',
      boleto: 'Boleto',
      a_prazo: 'A Prazo',
      prazo: 'A Prazo',
    }
    return mapa[fp.toLowerCase()] || fp.toUpperCase()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visão Geral"
        description={`Bem-vindo de volta, ${usuario?.nome || 'Usuário'}. Aqui está o resumo comercial da ${
          empresa?.nome_fantasia || empresa?.nome || 'sua distribuidora'
        }.`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                loadDashboardData()
                loadOnboardingProgress()
                loadAssinatura()
              }}
              disabled={loading}
              className="text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            {canAccessPage(usuario?.perfil, 'vendas') && (
              <Link to="/app/vendas">
                <Button className="bg-teal-700 hover:bg-teal-800 text-white flex items-center gap-1.5 shadow-sm">
                  <ShoppingCart className="w-4 h-4" />
                  Nova Venda
                </Button>
              </Link>
            )}
          </div>
        }
      />

      {/* Card de Status da Assinatura & Uso do Plano (Apenas Master/Admin) */}
      {isMasterOrAdmin && !loadingAssinatura && (
        <div className="space-y-4">
          {(() => {
            const planoNome =
              statusAssinatura?.plano_nome || assinatura?.planos?.nome || 'Profissional'
            const status = statusAssinatura?.status || assinatura?.status || 'trial'
            const acessoPermitido = statusAssinatura ? statusAssinatura.acesso_permitido : true

            // Caso especial: Bloqueio (Trial expirado, cancelada, bloqueada, ou sem assinatura)
            if (!acessoPermitido) {
              const isTrial = status === 'trial'
              return (
                <Card className="rounded-xl border border-rose-200 bg-rose-50/40 shadow-xs p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-3.5">
                      <div className="h-10 w-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                        <ShieldAlert className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            Plano {planoNome}
                          </span>
                          <span className="text-slate-400 text-xs">·</span>
                          <Badge
                            variant="outline"
                            className="text-[11px] font-bold py-0.5 px-2 bg-rose-100 text-rose-800 border-rose-300"
                          >
                            {isTrial ? 'Expirado' : 'Assinatura Inativa'}
                          </Badge>
                        </div>
                        <p className="text-xs text-rose-900/90 font-medium mt-1">
                          {isTrial
                            ? 'Seu período de teste terminou. O sistema está em modo somente leitura (todos os dados estão preservados).'
                            : statusAssinatura?.motivo_bloqueio ||
                              'Sua assinatura requer regularização.'}
                        </p>
                      </div>
                    </div>

                    <Link to="/app/configuracoes" className="shrink-0 self-end sm:self-auto">
                      <Button
                        size="sm"
                        className="h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center gap-1.5 shadow-xs"
                      >
                        Regularizar Assinatura
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  </div>
                </Card>
              )
            }

            if (status === 'trial') {
              const diasRestantes =
                statusAssinatura?.dias_restantes !== undefined
                  ? statusAssinatura.dias_restantes
                  : calcularDiasRestantesTrial(assinatura?.fim_periodo_teste)
              const isUrgente = diasRestantes <= 5

              const badgeColor = isUrgente
                ? 'bg-amber-100 text-amber-800 border-amber-300'
                : 'bg-teal-100 text-teal-800 border-teal-200'

              const borderColor = isUrgente
                ? 'border-amber-200 bg-amber-50/20'
                : 'border-slate-200 bg-white'

              const iconColor = isUrgente
                ? 'bg-amber-100 text-amber-700'
                : 'bg-teal-50 text-teal-700'

              return (
                <Card className={`rounded-xl border ${borderColor} shadow-xs p-3.5 sm:p-4`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${iconColor}`}
                      >
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            Plano {planoNome}
                          </span>
                          <span className="text-slate-400 text-xs">·</span>
                          <span className="text-xs font-medium text-slate-600">
                            Período de teste
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[11px] font-semibold py-0.5 px-2 ${badgeColor}`}
                          >
                            {diasRestantes === 1 ? 'Resta 1 dia' : `Restam ${diasRestantes} dias`}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Aproveite todos os recursos liberados durante o período de avaliação da
                          sua distribuidora.
                        </p>
                      </div>
                    </div>

                    <Link to="/app/configuracoes" className="shrink-0 self-end sm:self-auto">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-teal-700 hover:text-teal-800 hover:bg-teal-50 font-medium flex items-center gap-1"
                      >
                        Ver assinatura
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  </div>
                </Card>
              )
            }

            if (status === 'ativa') {
              const dataCobranca = assinatura.proxima_cobranca || assinatura.vencimento

              return (
                <Card className="rounded-xl border border-slate-200 bg-white shadow-xs p-3.5 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            Plano {planoNome}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 border-emerald-200 py-0.5 px-2"
                          >
                            Assinatura ativa
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Sua assinatura está regular e todas as funcionalidades estão disponíveis.
                        </p>
                        {dataCobranca && (
                          <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
                            <Clock className="w-3.5 h-3.5 text-slate-400 inline" />
                            Próxima cobrança: {formatDate(dataCobranca)}
                          </p>
                        )}
                      </div>
                    </div>

                    <Link to="/app/configuracoes" className="shrink-0 self-end sm:self-auto">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-teal-700 hover:text-teal-800 hover:bg-teal-50 font-medium flex items-center gap-1"
                      >
                        Ver assinatura
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  </div>
                </Card>
              )
            }

            // Alerta especial de inadimplência (status === 'atrasada')
            if (status === 'atrasada') {
              return (
                <Card className="rounded-xl border border-amber-300 bg-amber-50/70 shadow-xs p-3.5 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-amber-950">
                            Plano {planoNome}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[11px] font-semibold bg-amber-100 text-amber-800 border-amber-300 py-0.5 px-2"
                          >
                            Fatura em atraso
                          </Badge>
                        </div>
                        <p className="text-xs text-amber-900 mt-0.5 font-medium">
                          Sua fatura está em atraso. Regularize para evitar o bloqueio do sistema.
                        </p>
                      </div>
                    </div>

                    <Link to="/app/configuracoes" className="shrink-0 self-end sm:self-auto">
                      <Button
                        size="sm"
                        className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold flex items-center gap-1 shadow-xs"
                      >
                        Ver Assinatura
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  </div>
                </Card>
              )
            }

            // Outros status: pendente, etc.
            const statusConfigMap: Record<
              string,
              { label: string; badge: string; icon: any; iconStyle: string }
            > = {
              pendente: {
                label: 'Pagamento pendente',
                badge: 'bg-yellow-50 text-yellow-800 border-yellow-200',
                icon: Clock,
                iconStyle: 'bg-yellow-50 text-yellow-700',
              },
            }

            const currentConfig = statusConfigMap[status] || {
              label: status,
              badge: 'bg-slate-50 text-slate-700 border-slate-200',
              icon: CreditCard,
              iconStyle: 'bg-slate-50 text-slate-700',
            }

            const StatusIcon = currentConfig.icon

            return (
              <Card className="rounded-xl border border-slate-200 bg-white shadow-xs p-3.5 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${currentConfig.iconStyle}`}
                    >
                      <StatusIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">Plano {planoNome}</span>
                        <Badge
                          variant="outline"
                          className={`text-[11px] font-semibold py-0.5 px-2 ${currentConfig.badge}`}
                        >
                          {currentConfig.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Status atualizado dos serviços da sua empresa no EVO Gestão.
                      </p>
                    </div>
                  </div>

                  <Link to="/app/configuracoes" className="shrink-0 self-end sm:self-auto">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-teal-700 hover:text-teal-800 hover:bg-teal-50 font-medium flex items-center gap-1"
                    >
                      Ver assinatura
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </div>
              </Card>
            )
          })()}

          {/* Nova Seção: Uso do Plano (Master/Admin) */}
          {assinatura.planos && (
            <Card className="rounded-xl border border-slate-200 bg-white shadow-xs p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-teal-700" />
                  <h3 className="text-sm font-bold text-slate-900">Uso do Plano</h3>
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-slate-50 text-slate-600 border-slate-200 font-medium"
                  >
                    {assinatura.planos.nome}
                  </Badge>
                </div>
                <span className="text-[11px] text-slate-500">
                  Consumo em tempo real dos limites da empresa
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                {[
                  {
                    label: 'Usuários',
                    current: planUsage.usuarios,
                    limit: assinatura.planos.limite_usuarios,
                  },
                  {
                    label: 'Vendedores',
                    current: planUsage.vendedores,
                    limit: assinatura.planos.limite_vendedores,
                  },
                  {
                    label: 'Produtos',
                    current: planUsage.produtos,
                    limit: assinatura.planos.limite_produtos,
                  },
                  {
                    label: 'Clientes',
                    current: planUsage.clientes,
                    limit: assinatura.planos.limite_clientes,
                  },
                  {
                    label: 'Vendas no mês',
                    current: planUsage.vendasMes,
                    limit: assinatura.planos.limite_vendas_mes,
                  },
                ].map((item, idx) => {
                  const isUnlimited = item.limit === null || item.limit === undefined
                  const percent = isUnlimited
                    ? 100
                    : item.limit > 0
                      ? Math.min(Math.round((item.current / item.limit) * 100), 100)
                      : 0
                  const isFull = !isUnlimited && item.limit !== null && item.current >= item.limit

                  // Cores: Verde (<= 70%), Amarelo (> 70% e < 100%), Vermelho (100%)
                  const barColor = isUnlimited
                    ? 'bg-emerald-500'
                    : percent >= 100
                      ? 'bg-rose-500'
                      : percent > 70
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'

                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border border-slate-100 bg-slate-50/60 flex flex-col justify-between space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">{item.label}</span>
                        {isFull && (
                          <Badge className="bg-rose-100 text-rose-800 border-rose-200 text-[9px] px-1.5 py-0 font-bold">
                            Limite atingido
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-baseline justify-between text-xs">
                        <span className="font-bold text-slate-900 text-sm">{item.current}</span>
                        <span className="text-slate-500 text-[11px]">
                          {isUnlimited ? '/ Ilimitado' : `/ ${item.limit}`}
                        </span>
                      </div>

                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-500 ${barColor}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* PARTE 5: Banner de Primeiro Acesso (< 4 itens concluídos para Master/Admin) */}
      {showFirstAccessBanner && (
        <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Rocket className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-teal-950">
                Vamos preparar sua empresa para o EVO Gestão 🚀
              </h3>
              <p className="text-xs sm:text-sm text-teal-800/80 mt-0.5">
                Complete as etapas abaixo para liberar todo o potencial da sua distribuidora.
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => {
              document
                .getElementById('onboarding-checklist')
                ?.scrollIntoView({ behavior: 'smooth' })
            }}
            className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shrink-0 shadow-xs h-9 px-4"
          >
            Ver Configuração Inicial
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </div>
      )}

      {error ? (
        <ErrorState
          title="Erro ao carregar o Dashboard"
          message={error}
          onRetry={loadDashboardData}
        />
      ) : (
        <>
          {/* 5 KPI Cards (Responsive Grid: 1 col mobile, 2 sm, 4 lg - 5th card spans nicely) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {loading ? (
              <>
                <Card className="rounded-xl border border-slate-200 bg-white p-4">
                  <TableSkeleton rows={2} cols={2} />
                </Card>
                <Card className="rounded-xl border border-slate-200 bg-white p-4">
                  <TableSkeleton rows={2} cols={2} />
                </Card>
                <Card className="rounded-xl border border-slate-200 bg-white p-4">
                  <TableSkeleton rows={2} cols={2} />
                </Card>
                <Card className="rounded-xl border border-slate-200 bg-white p-4">
                  <TableSkeleton rows={2} cols={2} />
                </Card>
                <Card className="rounded-xl border border-slate-200 bg-white p-4 sm:col-span-2 lg:col-span-4">
                  <TableSkeleton rows={2} cols={2} />
                </Card>
              </>
            ) : (
              <>
                {/* 1. Faturamento do mês */}
                <MetricCard
                  title="Faturamento do mês"
                  value={formatCurrency(data.faturamentoMes)}
                  subtitle="Vendas finalizadas no mês atual"
                  icon={DollarSign}
                />

                {/* 2. Vendas do mês */}
                <MetricCard
                  title="Vendas do mês"
                  value={`${data.vendasMesCount}`}
                  subtitle="Finalizadas no mês atual"
                  icon={ShoppingCart}
                />

                {/* 3. Clientes ativos */}
                <MetricCard
                  title="Clientes ativos"
                  value={`${data.clientesAtivosCount}`}
                  subtitle="Cadastrados e habilitados"
                  icon={Users}
                />

                {/* 4. Produtos cadastrados */}
                <MetricCard
                  title="Produtos cadastrados"
                  value={`${data.produtosAtivosCount}`}
                  subtitle="Itens ativos no catálogo"
                  icon={Package}
                />

                {/* 5. Estoque baixo */}
                <Card
                  className={`rounded-xl border shadow-xs hover:shadow-md transition-shadow ${
                    data.estoqueBaixoCount > 0
                      ? 'border-amber-200 bg-amber-50/20'
                      : 'border-slate-200 bg-white'
                  } sm:col-span-2 lg:col-span-4`}
                >
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle
                      className={`text-xs font-semibold uppercase tracking-wider ${
                        data.estoqueBaixoCount > 0 ? 'text-amber-800' : 'text-slate-500'
                      }`}
                    >
                      Estoque baixo
                    </CardTitle>
                    <div
                      className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                        data.estoqueBaixoCount > 0
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-teal-50 text-teal-700'
                      }`}
                    >
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div
                      className={`text-2xl font-bold tracking-tight tabular-nums ${
                        data.estoqueBaixoCount > 0 ? 'text-amber-700' : 'text-slate-900'
                      }`}
                    >
                      {data.estoqueBaixoCount}{' '}
                      <span className="text-sm font-normal text-slate-500">
                        {data.estoqueBaixoCount === 1
                          ? 'item no limite'
                          : 'itens no limite ou abaixo'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {data.estoqueBaixoCount > 0
                        ? 'Requer reposição imediata junto aos fornecedores'
                        : 'Todos os produtos estão com níveis regulares de estoque'}
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* PARTE 4: Checklist de Configuração Inicial (apenas Master/Admin) */}
          {isMasterOrAdmin && (!isComplete || !checklistDismissed) && (
            <div id="onboarding-checklist">
              <Card
                className={`rounded-xl border shadow-xs transition-colors ${
                  isComplete ? 'border-emerald-200 bg-emerald-50/20' : 'border-teal-300 bg-white'
                }`}
              >
                <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isComplete ? 'bg-emerald-100 text-emerald-700' : 'bg-teal-100 text-teal-700'
                      }`}
                    >
                      {isComplete ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <ClipboardCheck className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-sm sm:text-base font-bold text-slate-900">
                          Configuração Inicial
                        </CardTitle>
                        {isComplete && (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100 font-semibold text-[11px]">
                            Empresa configurada com sucesso 🎉
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-xs text-slate-500 mt-0.5">
                        {loadingOnboarding
                          ? 'Calculando progresso da empresa...'
                          : `${completedCount} de 7 concluídos`}
                      </CardDescription>
                    </div>
                  </div>

                  {isComplete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDismissChecklist}
                      className="text-xs text-slate-500 hover:text-slate-800 h-8 flex items-center gap-1.5"
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                      Ocultar
                    </Button>
                  )}
                </CardHeader>

                <CardContent className="pt-4">
                  {/* Barra de Progresso visual */}
                  <div className="mb-4">
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          isComplete ? 'bg-emerald-500' : 'bg-teal-600'
                        }`}
                        style={{ width: `${Math.round((completedCount / 7) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Grid de Itens do Checklist */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                    {checklistItems.map((item) => {
                      return (
                        <div
                          key={item.key}
                          className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition-colors ${
                            item.done
                              ? 'bg-emerald-50/40 border-emerald-100 text-slate-700'
                              : 'bg-slate-50/60 border-slate-200 text-slate-600 hover:border-teal-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            {item.done ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            ) : (
                              <Circle className="w-4 h-4 text-slate-400 shrink-0" />
                            )}
                            <span
                              className={`truncate ${
                                item.done ? 'font-medium text-slate-800' : 'text-slate-600'
                              }`}
                            >
                              {item.label}
                            </span>
                          </div>

                          {!isComplete && !item.done && item.link && (
                            <Link to={item.link} className="shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-[11px] text-teal-700 hover:text-teal-800 hover:bg-teal-50 font-medium"
                              >
                                {item.actionText}
                              </Button>
                            </Link>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Seções "Vendas Recentes" e "Estoque Baixo" (lado a lado no lg) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Seção Vendas Recentes */}
            <Card className="border border-slate-200 bg-white shadow-xs flex flex-col">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900">
                      Vendas Recentes
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Últimas 5 vendas finalizadas
                    </CardDescription>
                  </div>
                  {canAccessPage(usuario?.perfil, 'vendas') && (
                    <Link to="/app/vendas">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-teal-700 hover:text-teal-800 hover:bg-teal-50 text-xs flex items-center gap-1"
                      >
                        Ver todas
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-4 flex-1">
                {loading ? (
                  <TableSkeleton rows={5} cols={4} />
                ) : data.vendasRecentes.length === 0 ? (
                  <EmptyState
                    icon={ShoppingCart}
                    title="Nenhuma venda recente"
                    description="Nenhuma venda finalizada este mês. Novas vendas registradas aparecerão automaticamente aqui."
                    actionLabel={
                      canAccessPage(usuario?.perfil, 'vendas') ? 'Criar Primeira Venda' : undefined
                    }
                    onAction={
                      canAccessPage(usuario?.perfil, 'vendas')
                        ? () => window.location.assign('/app/vendas')
                        : undefined
                    }
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 uppercase font-semibold">
                          <th className="pb-2 font-medium">Nº</th>
                          <th className="pb-2 font-medium">Cliente</th>
                          <th className="pb-2 font-medium">Pagamento</th>
                          <th className="pb-2 font-medium">Data</th>
                          <th className="pb-2 font-medium text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.vendasRecentes.map((venda) => (
                          <tr key={venda.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2.5 font-mono text-slate-600">
                              {venda.numero != null ? `#${venda.numero}` : '—'}
                            </td>
                            <td className="py-2.5 font-medium text-slate-900">
                              {venda.clientes?.nome || 'Cliente não identificado'}
                            </td>
                            <td className="py-2.5 text-slate-600">
                              <Badge
                                variant="outline"
                                className="text-[11px] font-normal border-slate-200 bg-slate-50"
                              >
                                {formatFormaPagamento(venda.forma_pagamento)}
                              </Badge>
                            </td>
                            <td className="py-2.5 text-slate-500 whitespace-nowrap">
                              {formatDate(venda.created_at)}
                            </td>
                            <td className="py-2.5 font-bold text-slate-900 text-right whitespace-nowrap">
                              {formatCurrency(venda.total || 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Seção Estoque Baixo */}
            <Card className="border border-slate-200 bg-white shadow-xs flex flex-col">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900">
                      Estoque Baixo
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Produtos abaixo ou no limite mínimo
                    </CardDescription>
                  </div>
                  {canAccessPage(usuario?.perfil, 'estoque') && (
                    <Link to="/app/estoque">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-teal-700 hover:text-teal-800 hover:bg-teal-50 text-xs flex items-center gap-1"
                      >
                        Gerenciar estoque
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-4 flex-1">
                {loading ? (
                  <TableSkeleton rows={5} cols={4} />
                ) : data.estoqueBaixoItens.length === 0 ? (
                  <EmptyState
                    icon={CheckCircle2}
                    title="Estoque em dia"
                    description="Todos os produtos estão com estoque adequado."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 uppercase font-semibold">
                          <th className="pb-2 font-medium">Produto</th>
                          <th className="pb-2 font-medium text-center">Mínimo</th>
                          <th className="pb-2 font-medium text-right">Atual</th>
                          <th className="pb-2 font-medium text-right">Situação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.estoqueBaixoItens.map((item, idx) => {
                          const isZero = (item.quantidade ?? 0) <= 0
                          return (
                            <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-2.5 font-medium text-slate-900">
                                {item.produtos?.nome || 'Produto sem nome'}
                              </td>
                              <td className="py-2.5 text-center text-slate-500 font-mono">
                                {item.produtos?.estoque_minimo ?? 0}{' '}
                                {item.produtos?.unidade || 'UN'}
                              </td>
                              <td
                                className={`py-2.5 text-right font-mono font-bold ${
                                  isZero ? 'text-red-600' : 'text-amber-600'
                                }`}
                              >
                                {item.quantidade ?? 0} {item.produtos?.unidade || 'UN'}
                              </td>
                              <td className="py-2.5 text-right whitespace-nowrap">
                                {isZero ? (
                                  <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] hover:bg-red-100 font-semibold">
                                    Zerado
                                  </Badge>
                                ) : (
                                  <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] hover:bg-amber-100 font-semibold">
                                    Abaixo do Mín.
                                  </Badge>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Atalhos Rápidos & Dados da Empresa */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border border-slate-200 bg-white shadow-xs md:col-span-2">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900">
                      Módulos de Gestão Rápida
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Acesse diretamente as operações principais da sua distribuidora
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-teal-700 border-teal-200 bg-teal-50">
                    Operacional
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {canAccessPage(usuario?.perfil, 'clientes') && (
                  <Link
                    to="/app/clientes"
                    className="p-3.5 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/30 transition-all flex items-start gap-3 group"
                  >
                    <div className="p-2.5 rounded-lg bg-teal-100 text-teal-700 group-hover:bg-teal-700 group-hover:text-white transition-colors">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-teal-900">
                        Clientes & Limites
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Gerencie limites de crédito e vendedores vinculados.
                      </p>
                    </div>
                  </Link>
                )}

                {canAccessPage(usuario?.perfil, 'produtos') && (
                  <Link
                    to="/app/produtos"
                    className="p-3.5 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/30 transition-all flex items-start gap-3 group"
                  >
                    <div className="p-2.5 rounded-lg bg-teal-100 text-teal-700 group-hover:bg-teal-700 group-hover:text-white transition-colors">
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-teal-900">
                        Catálogo de Produtos
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Tabela de preços, estoque mínimo e categorias.
                      </p>
                    </div>
                  </Link>
                )}

                {canAccessPage(usuario?.perfil, 'estoque') && (
                  <Link
                    to="/app/estoque"
                    className="p-3.5 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/30 transition-all flex items-start gap-3 group"
                  >
                    <div className="p-2.5 rounded-lg bg-amber-100 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                      <Boxes className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-amber-900">
                        Controle de Estoque
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Entradas, saídas e rastreamento de saldo por produto.
                      </p>
                    </div>
                  </Link>
                )}

                {canAccessPage(usuario?.perfil, 'financeiro') && (
                  <Link
                    to="/app/financeiro"
                    className="p-3.5 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/30 transition-all flex items-start gap-3 group"
                  >
                    <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                      <DollarSign className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-900">
                        Contas a Receber / Pagar
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Fluxo de caixa, baixas e títulos a vencer.
                      </p>
                    </div>
                  </Link>
                )}
              </CardContent>
            </Card>

            {/* System Information Card */}
            <Card className="border border-slate-200 bg-white shadow-xs">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-base font-bold text-slate-900">
                  Dados da Empresa
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Escopo seguro e autenticado
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Razão Social:</span>
                  <span className="font-semibold text-slate-800 text-right">
                    {empresa?.nome || 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">CNPJ:</span>
                  <span className="font-mono text-slate-700">
                    {empresa?.cnpj || 'Não informado'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Perfil de Acesso:</span>
                  <span className="font-bold text-teal-700 uppercase">
                    {usuario?.perfil || 'vendedor'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Status Empresa:</span>
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Ativa
                  </span>
                </div>
                {canAccessPage(usuario?.perfil, 'configuracoes') && (
                  <div className="pt-2">
                    <Link to="/app/configuracoes">
                      <Button
                        variant="outline"
                        className="w-full text-xs text-slate-700 hover:bg-slate-50"
                      >
                        Ver Detalhes da Conta
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
