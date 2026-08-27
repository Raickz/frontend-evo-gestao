import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  DollarSign,
  ShoppingCart,
  Receipt,
  Package,
  TrendingDown,
  ArrowUpCircle,
  ArrowDownCircle,
  Calendar as CalendarIcon,
  Filter,
  Users,
  Layers,
  Truck,
  FileSpreadsheet,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Boxes,
  HelpCircle,
} from 'lucide-react'

import { useEmpresa } from '@/hooks/use-empresa'
import {
  PageHeader,
  MetricCard,
  TableSkeleton,
  ErrorState,
  EmptyState,
} from '@/components/common/CommonUI'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

import {
  RelatoriosService,
  PeriodoFiltro,
  ResumoGeral,
  VendaPorDia,
  ProdutoRanking,
  VendedorDesempenho,
  FormaPagamentoResumo,
  ClienteResumo,
  CompraFornecedorResumo,
  ProdutoCompradoResumo,
  EstoqueIndicadores,
  EstoqueItem,
  MovimentacaoResumo,
  FinanceiroResumo,
  FluxoFinanceiroItem,
  PedidosIndicadores,
} from '@/services/relatorios'

type PresetPeriodo =
  | 'hoje'
  | '7dias'
  | 'mes_atual'
  | 'mes_anterior'
  | '30dias'
  | 'ano_atual'
  | 'personalizado'

function formatDateToIso(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getPeriodoFromPreset(preset: PresetPeriodo): { inicio: string; fim: string } {
  const today = new Date()
  const fim = formatDateToIso(today)

  switch (preset) {
    case 'hoje':
      return { inicio: fim, fim }
    case '7dias': {
      const d = new Date()
      d.setDate(d.getDate() - 6)
      return { inicio: formatDateToIso(d), fim }
    }
    case 'mes_atual': {
      const first = new Date(today.getFullYear(), today.getMonth(), 1)
      return { inicio: formatDateToIso(first), fim }
    }
    case 'mes_anterior': {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const last = new Date(today.getFullYear(), today.getMonth(), 0)
      return { inicio: formatDateToIso(first), fim: formatDateToIso(last) }
    }
    case '30dias': {
      const d = new Date()
      d.setDate(d.getDate() - 29)
      return { inicio: formatDateToIso(d), fim }
    }
    case 'ano_atual': {
      const first = new Date(today.getFullYear(), 0, 1)
      return { inicio: formatDateToIso(first), fim }
    }
    case 'personalizado':
    default: {
      const first = new Date(today.getFullYear(), today.getMonth(), 1)
      return { inicio: formatDateToIso(first), fim }
    }
  }
}

const PIE_COLORS = ['#0d9488', '#0284c7', '#8b5cf6', '#f59e0b', '#ec4899', '#10b981', '#64748b']

const FORMA_PAGTO_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao_credito: 'Cartão de Crédito',
  cartao_debito: 'Cartão de Débito',
  boleto: 'Boleto',
  a_prazo: 'A Prazo',
  outros: 'Outros',
}

export default function RelatoriosPage() {
  const { empresaId } = useEmpresa()

  // Filtros de Período
  const [preset, setPreset] = useState<PresetPeriodo>('mes_atual')
  const [periodo, setPeriodo] = useState<PeriodoFiltro>(() => getPeriodoFromPreset('mes_atual'))
  const [customInicio, setCustomInicio] = useState(periodo.inicio)
  const [customFim, setCustomFim] = useState(periodo.fim)

  // Estados de dados
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [resumoGeral, setResumoGeral] = useState<ResumoGeral | null>(null)
  const [vendasPorDia, setVendasPorDia] = useState<VendaPorDia[]>([])
  const [rankingOrdem, setRankingOrdem] = useState<'quantidade' | 'faturamento'>('faturamento')
  const [rankingProdutos, setRankingProdutos] = useState<ProdutoRanking[]>([])
  const [desempenhoVendedores, setDesempenhoVendedores] = useState<VendedorDesempenho[]>([])
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamentoResumo[]>([])
  const [clientesResumo, setClientesResumo] = useState<{
    clientes: ClienteResumo[]
    compraramNoPeriodo: number
    novosNoPeriodo: number
    topCliente: string | null
  }>({
    clientes: [],
    compraramNoPeriodo: 0,
    novosNoPeriodo: 0,
    topCliente: null,
  })
  const [comprasFornecedores, setComprasFornecedores] = useState<CompraFornecedorResumo[]>([])
  const [produtosComprados, setProdutosComprados] = useState<ProdutoCompradoResumo[]>([])
  const [estoqueIndicadores, setEstoqueIndicadores] = useState<EstoqueIndicadores | null>(null)
  const [estoqueFiltroStatus, setEstoqueFiltroStatus] = useState<
    'todos' | 'zerado' | 'abaixo_minimo'
  >('todos')
  const [estoqueItens, setEstoqueItens] = useState<EstoqueItem[]>([])
  const [loadingEstoqueItens, setLoadingEstoqueItens] = useState(false)
  const [movimentacoesResumo, setMovimentacoesResumo] = useState<MovimentacaoResumo | null>(null)
  const [financeiroResumo, setFinanceiroResumo] = useState<FinanceiroResumo | null>(null)
  const [fluxoFinanceiro, setFluxoFinanceiro] = useState<FluxoFinanceiroItem[]>([])
  const [pedidosIndicadores, setPedidosIndicadores] = useState<PedidosIndicadores | null>(null)

  const handleSelectPreset = (novoPreset: PresetPeriodo) => {
    setPreset(novoPreset)
    if (novoPreset !== 'personalizado') {
      const p = getPeriodoFromPreset(novoPreset)
      setPeriodo(p)
      setCustomInicio(p.inicio)
      setCustomFim(p.fim)
    }
  }

  const handleApplyCustom = () => {
    if (!customInicio || !customFim) return
    if (customInicio > customFim) {
      setPeriodo({ inicio: customFim, fim: customInicio })
    } else {
      setPeriodo({ inicio: customInicio, fim: customFim })
    }
  }

  // Carregar dados principais
  const carregarDados = useCallback(async () => {
    if (!empresaId) return
    setLoading(true)
    setError(null)

    try {
      const [
        resumo,
        vendasDia,
        ranking,
        vendedores,
        formas,
        clientes,
        comprasForn,
        prodsComp,
        estIndicadores,
        movResumo,
        finResumo,
        fluxo,
        pedidos,
      ] = await Promise.all([
        RelatoriosService.getResumoGeral(empresaId, periodo),
        RelatoriosService.getVendasPorDia(empresaId, periodo),
        RelatoriosService.getRankingProdutos(empresaId, periodo, rankingOrdem),
        RelatoriosService.getDesempenhoVendedores(empresaId, periodo),
        RelatoriosService.getFormasPagamento(empresaId, periodo),
        RelatoriosService.getClientesResumo(empresaId, periodo),
        RelatoriosService.getComprasPorFornecedor(empresaId, periodo),
        RelatoriosService.getProdutosMaisComprados(empresaId, periodo),
        RelatoriosService.getEstoqueIndicadores(empresaId),
        RelatoriosService.getMovimentacoesResumo(empresaId, periodo),
        RelatoriosService.getFinanceiroResumo(empresaId, periodo),
        RelatoriosService.getFluxoFinanceiro(empresaId, periodo),
        RelatoriosService.getPedidosIndicadores(empresaId, periodo),
      ])

      setResumoGeral(resumo)
      setVendasPorDia(vendasDia)
      setRankingProdutos(ranking)
      setDesempenhoVendedores(vendedores)
      setFormasPagamento(formas)
      setClientesResumo(clientes)
      setComprasFornecedores(comprasForn)
      setProdutosComprados(prodsComp)
      setEstoqueIndicadores(estIndicadores)
      setMovimentacoesResumo(movResumo)
      setFinanceiroResumo(finResumo)
      setFluxoFinanceiro(fluxo)
      setPedidosIndicadores(pedidos)
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.error('Erro ao carregar relatórios:', err)
      }
      setError(err?.message || 'Falha ao carregar relatórios gerenciais.')
    } finally {
      setLoading(false)
    }
  }, [empresaId, periodo, rankingOrdem])

  // Recarregar itens de estoque separadamente quando o filtro de status mudar
  const carregarItensEstoque = useCallback(async () => {
    if (!empresaId) return
    setLoadingEstoqueItens(true)
    try {
      const itens = await RelatoriosService.getEstoqueItens(empresaId, estoqueFiltroStatus)
      setEstoqueItens(itens)
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Erro ao carregar itens de estoque:', err)
      }
    } finally {
      setLoadingEstoqueItens(false)
    }
  }, [empresaId, estoqueFiltroStatus])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  useEffect(() => {
    carregarItensEstoque()
  }, [carregarItensEstoque])

  // Formatações
  const formatCurrency = (val: number | undefined | null) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-'
    const parts = dateStr.split('T')[0].split('-')
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`
    }
    return new Date(dateStr).toLocaleDateString('pt-BR')
  }

  // Agrupamento para gráfico de vendas se período for longo (> 60 dias)
  const vendasChartData = useMemo(() => {
    const dInicio = new Date(periodo.inicio)
    const dFim = new Date(periodo.fim)
    const diffDays = Math.ceil((dFim.getTime() - dInicio.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays <= 60) {
      return vendasPorDia.map((item) => {
        const parts = item.data.split('-')
        const label = parts.length === 3 ? `${parts[2]}/${parts[1]}` : item.data
        return {
          label,
          data: item.data,
          faturamento: item.total,
          quantidade: item.quantidade,
        }
      })
    }

    // Agrupar por mês
    const mesesMap: Record<string, { faturamento: number; quantidade: number }> = {}
    for (const item of vendasPorDia) {
      const mes = item.data.substring(0, 7) // YYYY-MM
      if (!mesesMap[mes]) mesesMap[mes] = { faturamento: 0, quantidade: 0 }
      mesesMap[mes].faturamento += item.total
      mesesMap[mes].quantidade += item.quantidade
    }

    return Object.entries(mesesMap)
      .map(([mes, val]) => {
        const parts = mes.split('-')
        const label = parts.length === 2 ? `${parts[1]}/${parts[0]}` : mes
        return {
          label,
          data: mes,
          faturamento: val.faturamento,
          quantidade: val.quantidade,
        }
      })
      .sort((a, b) => a.data.localeCompare(b.data))
  }, [vendasPorDia, periodo])

  // Total das formas de pagamento para percentuais
  const totalValorFormas = useMemo(() => {
    return formasPagamento.reduce((acc, f) => acc + f.valor, 0)
  }, [formasPagamento])

  // Chart configs
  const areaChartConfig: ChartConfig = {
    faturamento: {
      label: 'Faturamento',
      color: '#0d9488',
    },
  }

  const barChartConfig: ChartConfig = {
    recebimentos: {
      label: 'Recebimentos',
      color: '#10b981',
    },
    pagamentos: {
      label: 'Pagamentos',
      color: '#ef4444',
    },
  }

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header */}
      <PageHeader
        title="Relatórios"
        description="Analise o desempenho comercial, financeiro e operacional da sua empresa."
        badge="Somente Leitura"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={carregarDados}
            disabled={loading}
            className="text-xs h-9 text-slate-700 hover:text-teal-700 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar Dados
          </Button>
        }
      />

      {/* 2. Barra de Filtro de Período */}
      <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-[#1A294A] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 dark:border-[#1A294A] pb-3">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-[#0066FF]" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Período de Análise
            </span>
          </div>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Intervalo selecionado:{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {formatDate(periodo.inicio)} até {formatDate(periodo.fim)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant={preset === 'hoje' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSelectPreset('hoje')}
              className={`text-xs h-8 rounded-xl ${
                preset === 'hoje'
                  ? 'bg-[#0066FF] hover:bg-[#0052CC] text-white font-semibold'
                  : 'text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#1A294A]'
              }`}
            >
              Hoje
            </Button>
            <Button
              type="button"
              variant={preset === '7dias' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSelectPreset('7dias')}
              className={`text-xs h-8 rounded-xl ${
                preset === '7dias'
                  ? 'bg-[#0066FF] hover:bg-[#0052CC] text-white font-semibold'
                  : 'text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#1A294A]'
              }`}
            >
              7 dias
            </Button>
            <Button
              type="button"
              variant={preset === 'mes_atual' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSelectPreset('mes_atual')}
              className={`text-xs h-8 rounded-xl ${
                preset === 'mes_atual'
                  ? 'bg-[#0066FF] hover:bg-[#0052CC] text-white font-semibold'
                  : 'text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#1A294A]'
              }`}
            >
              Este mês
            </Button>
            <Button
              type="button"
              variant={preset === 'mes_anterior' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSelectPreset('mes_anterior')}
              className={`text-xs h-8 rounded-xl ${
                preset === 'mes_anterior'
                  ? 'bg-[#0066FF] hover:bg-[#0052CC] text-white font-semibold'
                  : 'text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#1A294A]'
              }`}
            >
              Mês anterior
            </Button>
            <Button
              type="button"
              variant={preset === '30dias' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSelectPreset('30dias')}
              className={`text-xs h-8 rounded-xl ${
                preset === '30dias'
                  ? 'bg-[#0066FF] hover:bg-[#0052CC] text-white font-semibold'
                  : 'text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#1A294A]'
              }`}
            >
              30 dias
            </Button>
            <Button
              type="button"
              variant={preset === 'ano_atual' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSelectPreset('ano_atual')}
              className={`text-xs h-8 rounded-xl ${
                preset === 'ano_atual'
                  ? 'bg-[#0066FF] hover:bg-[#0052CC] text-white font-semibold'
                  : 'text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#1A294A]'
              }`}
            >
              Este ano
            </Button>
            <Button
              type="button"
              variant={preset === 'personalizado' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSelectPreset('personalizado')}
              className={`text-xs h-8 rounded-xl ${
                preset === 'personalizado'
                  ? 'bg-[#0066FF] hover:bg-[#0052CC] text-white font-semibold'
                  : 'text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#1A294A]'
              }`}
            >
              Personalizado
            </Button>
          </div>

          {preset === 'personalizado' && (
            <div className="flex items-center gap-2 ml-auto w-full sm:w-auto pt-2 sm:pt-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  De:
                </span>
                <Input
                  type="date"
                  value={customInicio}
                  onChange={(e) => setCustomInicio(e.target.value)}
                  className="h-8 text-xs bg-slate-50/70 dark:bg-[#0A1328]/50 border-slate-200 dark:border-[#1A294A] w-36 rounded-xl"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  Até:
                </span>
                <Input
                  type="date"
                  value={customFim}
                  onChange={(e) => setCustomFim(e.target.value)}
                  className="h-8 text-xs bg-slate-50/70 dark:bg-[#0A1328]/50 border-slate-200 dark:border-[#1A294A] w-36 rounded-xl"
                />
              </div>
              <Button
                size="sm"
                onClick={handleApplyCustom}
                className="bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs h-8 px-3 rounded-xl"
              >
                Filtrar
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Erro global */}
      {error && <ErrorState message={error} onRetry={carregarDados} />}

      {/* SEÇÃO 1: RESUMO GERAL */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600">
            1. Resumo Geral do Período
          </h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={`kpi-skel-${i}`}
                className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 shadow-xs"
              >
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-24" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            {/* 1. Faturamento */}
            <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-[#1A294A] p-4 transition-all">
              <div className="flex items-center justify-between pb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#C0C6CF]">
                  Faturamento
                </span>
                <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="text-lg font-black tracking-tight text-slate-900 dark:text-white tabular-nums">
                {formatCurrency(resumoGeral?.faturamento)}
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                Vendas finalizadas
              </p>
            </div>

            {/* 2. Nº Vendas */}
            <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-[#1A294A] p-4 transition-all">
              <div className="flex items-center justify-between pb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#C0C6CF]">
                  Nº de Vendas
                </span>
                <div className="h-7 w-7 rounded-lg bg-[#0066FF]/10 text-[#0066FF] dark:text-[#3B82F6] flex items-center justify-center">
                  <ShoppingCart className="w-4 h-4" />
                </div>
              </div>
              <div className="text-lg font-black tracking-tight text-slate-900 dark:text-white tabular-nums">
                {resumoGeral?.numeroVendas ?? 0}
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                Pedidos fechados
              </p>
            </div>

            {/* 3. Ticket Médio */}
            <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-[#1A294A] p-4 transition-all">
              <div className="flex items-center justify-between pb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#C0C6CF]">
                  Ticket Médio
                </span>
                <div className="h-7 w-7 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
                </div>
              </div>
              <div className="text-lg font-black tracking-tight text-slate-900 dark:text-white tabular-nums">
                {formatCurrency(resumoGeral?.ticketMedio)}
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Por venda</p>
            </div>

            {/* 4. Compras */}
            <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-[#1A294A] p-4 transition-all">
              <div className="flex items-center justify-between pb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#C0C6CF]">
                  Nº Compras
                </span>
                <div className="h-7 w-7 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
              </div>
              <div className="text-lg font-black tracking-tight text-slate-900 dark:text-white tabular-nums">
                {resumoGeral?.totalCompras ?? 0}
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                Ordens de compra
              </p>
            </div>

            {/* 5. Valor Compras */}
            <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-[#1A294A] p-4 transition-all">
              <div className="flex items-center justify-between pb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#C0C6CF]">
                  Valor Comprado
                </span>
                <div className="h-7 w-7 rounded-lg bg-pink-500/10 text-pink-600 dark:text-pink-400 flex items-center justify-center">
                  <TrendingDown className="w-4 h-4" />
                </div>
              </div>
              <div className="text-lg font-black tracking-tight text-slate-900 dark:text-white tabular-nums">
                {formatCurrency(resumoGeral?.valorCompras)}
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Total gasto</p>
            </div>

            {/* 6. Receber Aberto */}
            <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-[#1A294A] p-4 transition-all">
              <div className="flex items-center justify-between pb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#C0C6CF]">
                  Receber Aberto
                </span>
                <div className="h-7 w-7 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <ArrowUpCircle className="w-4 h-4" />
                </div>
              </div>
              <div className="text-lg font-black tracking-tight text-rose-600 dark:text-rose-400 tabular-nums">
                {formatCurrency(resumoGeral?.contasReceberAberto)}
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                Saldo pendente atual
              </p>
            </div>

            {/* 7. Pagar Aberto */}
            <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-[#1A294A] p-4 transition-all">
              <div className="flex items-center justify-between pb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#C0C6CF]">
                  Pagar Aberto
                </span>
                <div className="h-7 w-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <ArrowDownCircle className="w-4 h-4" />
                </div>
              </div>
              <div className="text-lg font-black tracking-tight text-amber-600 dark:text-amber-400 tabular-nums">
                {formatCurrency(resumoGeral?.contasPagarAberto)}
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                Compromissos atuais
              </p>
            </div>
          </div>
        )}
      </section>

      {/* SEÇÃO 2: DESEMPENHO DE VENDAS (Evolução) */}
      <section>
        <Card className="rounded-xl border border-slate-200 bg-white shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">
                  2. Evolução do Faturamento
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Acompanhamento cronológico do faturamento bruto no período
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="h-72 flex items-center justify-center">
                <Skeleton className="w-full h-full rounded-xl" />
              </div>
            ) : vendasChartData.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Nenhuma venda registrada no período selecionado.
              </div>
            ) : (
              <div className="h-72 w-full pt-2">
                <ChartContainer config={areaChartConfig} className="h-full w-full">
                  <AreaChart
                    data={vendasChartData}
                    margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorFaturamento" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0d9488" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#0d9488" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#64748b', fontSize: 11 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      tickFormatter={(val) =>
                        `R$ ${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`
                      }
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="faturamento"
                      stroke="#0d9488"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorFaturamento)"
                    />
                  </AreaChart>
                </ChartContainer>
              </div>
            )}

            {/* Sub-cards de apoio */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-[11px] text-slate-500 font-medium block">
                  Faturamento Total
                </span>
                <span className="text-base font-bold text-slate-900 tabular-nums">
                  {formatCurrency(resumoGeral?.faturamento)}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-[11px] text-slate-500 font-medium block">Nº de Vendas</span>
                <span className="text-base font-bold text-slate-900 tabular-nums">
                  {resumoGeral?.numeroVendas ?? 0}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-[11px] text-slate-500 font-medium block">Ticket Médio</span>
                <span className="text-base font-bold text-slate-900 tabular-nums">
                  {formatCurrency(resumoGeral?.ticketMedio)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* SEÇÃO 3: PRODUTOS MAIS VENDIDOS */}
      <section>
        <Card className="rounded-xl border border-slate-200 bg-white shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">
                  3. Produtos Mais Vendidos (Top 20)
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Ranking de produtos ordenado por quantidade vendida ou faturamento
                </CardDescription>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
                <Button
                  size="sm"
                  variant={rankingOrdem === 'faturamento' ? 'default' : 'ghost'}
                  onClick={() => setRankingOrdem('faturamento')}
                  className={`h-7 text-xs px-2.5 ${rankingOrdem === 'faturamento' ? 'bg-teal-700 hover:bg-teal-800 text-white font-semibold' : 'text-slate-600'}`}
                >
                  Por Faturamento
                </Button>
                <Button
                  size="sm"
                  variant={rankingOrdem === 'quantidade' ? 'default' : 'ghost'}
                  onClick={() => setRankingOrdem('quantidade')}
                  className={`h-7 text-xs px-2.5 ${rankingOrdem === 'quantidade' ? 'bg-teal-700 hover:bg-teal-800 text-white font-semibold' : 'text-slate-600'}`}
                >
                  Por Quantidade
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <TableSkeleton rows={5} cols={6} />
            ) : rankingProdutos.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Nenhuma venda de produtos registrada no período.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-3 px-3 text-center w-12">#</th>
                      <th className="py-3 px-4">Produto</th>
                      <th className="py-3 px-3">Código</th>
                      <th className="py-3 px-4 text-center">Qtd Vendida</th>
                      <th className="py-3 px-4 text-right">Faturamento</th>
                      <th className="py-3 px-4 text-right">Ticket Médio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rankingProdutos.map((item, idx) => (
                      <tr key={item.produto_id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 text-center font-bold text-slate-400">
                          {idx + 1}º
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">{item.nome}</td>
                        <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                          {item.codigo ? `#${item.codigo}` : '-'}
                        </td>
                        <td className="py-2.5 px-4 text-center font-bold text-slate-800 tabular-nums">
                          {item.quantidadeVendida} {item.unidade}
                        </td>
                        <td className="py-2.5 px-4 text-right font-black text-teal-800 tabular-nums">
                          {formatCurrency(item.faturamento)}
                        </td>
                        <td className="py-2.5 px-4 text-right text-slate-600 tabular-nums">
                          {formatCurrency(item.ticketMedio)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* SEÇÃO 4: DESEMPENHO DOS VENDEDORES */}
      <section>
        <Card className="rounded-xl border border-slate-200 bg-white shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-slate-900">
              4. Desempenho dos Vendedores
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Resultados de vendas, faturamento e comissões geradas no período
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <TableSkeleton rows={4} cols={5} />
            ) : desempenhoVendedores.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Nenhum vendedor vinculado a vendas no período.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-3 px-4">Vendedor</th>
                      <th className="py-3 px-4 text-center">Nº Vendas</th>
                      <th className="py-3 px-4 text-right">Faturamento</th>
                      <th className="py-3 px-4 text-right">Ticket Médio</th>
                      <th className="py-3 px-4 text-right">Comissão Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {desempenhoVendedores.map((v) => (
                      <tr key={v.vendedor_id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-4 font-semibold text-slate-900">{v.nome}</td>
                        <td className="py-2.5 px-4 text-center font-bold text-slate-800 tabular-nums">
                          {v.vendas}
                        </td>
                        <td className="py-2.5 px-4 text-right font-black text-slate-900 tabular-nums">
                          {formatCurrency(v.faturamento)}
                        </td>
                        <td className="py-2.5 px-4 text-right text-slate-600 tabular-nums">
                          {formatCurrency(v.ticketMedio)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-bold text-emerald-700 tabular-nums">
                          {formatCurrency(v.comissaoTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* SEÇÃO 5: FORMAS DE PAGAMENTO */}
      <section>
        <Card className="rounded-xl border border-slate-200 bg-white shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-slate-900">
              5. Vendas por Forma de Pagamento
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Distribuição do faturamento pelas modalidades de recebimento
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-56 rounded-lg" />
                <Skeleton className="h-56 rounded-lg" />
              </div>
            ) : formasPagamento.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Nenhum pagamento registrado no período.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                {/* Gráfico Donut */}
                <div className="h-60 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={formasPagamento}
                        dataKey="valor"
                        nameKey="forma_pagamento"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                      >
                        {formasPagamento.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: any) => formatCurrency(Number(val))}
                        labelFormatter={(label) => FORMA_PAGTO_LABELS[label] || label}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Tabela descritiva */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="py-2.5 px-3">Forma</th>
                        <th className="py-2.5 px-3 text-center">Qtd</th>
                        <th className="py-2.5 px-3 text-right">Valor</th>
                        <th className="py-2.5 px-3 text-right">%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {formasPagamento.map((fp, idx) => {
                        const pct = totalValorFormas > 0 ? (fp.valor / totalValorFormas) * 100 : 0
                        const label = FORMA_PAGTO_LABELS[fp.forma_pagamento] || fp.forma_pagamento
                        return (
                          <tr key={fp.forma_pagamento} className="hover:bg-slate-50/70">
                            <td className="py-2 px-3 font-semibold text-slate-900 flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                              />
                              {label}
                            </td>
                            <td className="py-2 px-3 text-center font-bold text-slate-800 tabular-nums">
                              {fp.quantidade}
                            </td>
                            <td className="py-2 px-3 text-right font-black text-slate-900 tabular-nums">
                              {formatCurrency(fp.valor)}
                            </td>
                            <td className="py-2 px-3 text-right text-slate-500 font-mono">
                              {pct.toFixed(1)}%
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* SEÇÃO 6: CLIENTES */}
      <section>
        <Card className="rounded-xl border border-slate-200 bg-white shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-slate-900">
              6. Desempenho de Clientes (Top 20)
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Clientes que mais compraram no período e novos cadastros
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 3 Indicadores de Clientes */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[11px] text-slate-500 font-medium block">
                  Compraram no Período
                </span>
                <span className="text-lg font-black text-slate-900 tabular-nums">
                  {clientesResumo.compraramNoPeriodo}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[11px] text-slate-500 font-medium block">
                  Novos Cadastrados
                </span>
                <span className="text-lg font-black text-teal-700 tabular-nums">
                  {clientesResumo.novosNoPeriodo}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[11px] text-slate-500 font-medium block">
                  Maior Comprador
                </span>
                <span
                  className="text-sm font-bold text-slate-900 truncate block"
                  title={clientesResumo.topCliente || '-'}
                >
                  {clientesResumo.topCliente || 'Nenhum'}
                </span>
              </div>
            </div>

            {loading ? (
              <TableSkeleton rows={4} cols={4} />
            ) : clientesResumo.clientes.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Nenhum cliente realizou compras no período.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-3 px-4">Cliente</th>
                      <th className="py-3 px-4 text-center">Nº Compras</th>
                      <th className="py-3 px-4 text-right">Valor Total</th>
                      <th className="py-3 px-4 text-right">Última Compra</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {clientesResumo.clientes.map((c) => (
                      <tr key={c.cliente_id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-4 font-semibold text-slate-900">{c.nome}</td>
                        <td className="py-2.5 px-4 text-center font-bold text-slate-800 tabular-nums">
                          {c.quantidadeCompras}
                        </td>
                        <td className="py-2.5 px-4 text-right font-black text-slate-900 tabular-nums">
                          {formatCurrency(c.valorTotal)}
                        </td>
                        <td className="py-2.5 px-4 text-right text-slate-500">
                          {formatDate(c.ultimaCompra)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* SEÇÃO 7: COMPRAS */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600">
          7. Compras e Fornecedores
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Card 1: Compras por Fornecedor */}
          <Card className="rounded-xl border border-slate-200 bg-white shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-slate-900">
                Compras por Fornecedor
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Volume de aquisições por fornecedor no período
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <TableSkeleton rows={4} cols={3} />
              ) : comprasFornecedores.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Nenhuma compra registrada com fornecedores no período.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="py-2.5 px-3">Fornecedor</th>
                        <th className="py-2.5 px-3 text-center">Nº Compras</th>
                        <th className="py-2.5 px-3 text-right">Valor Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {comprasFornecedores.map((f) => (
                        <tr key={f.fornecedor_id} className="hover:bg-slate-50/70">
                          <td className="py-2 px-3 font-semibold text-slate-900 truncate max-w-[180px]">
                            {f.nome}
                          </td>
                          <td className="py-2 px-3 text-center font-bold text-slate-800 tabular-nums">
                            {f.numeroCompras}
                          </td>
                          <td className="py-2 px-3 text-right font-black text-slate-900 tabular-nums">
                            {formatCurrency(f.valorTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card 2: Produtos Mais Comprados */}
          <Card className="rounded-xl border border-slate-200 bg-white shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-slate-900">
                Produtos Mais Comprados
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Itens com maior volume e custo médio de reposição
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <TableSkeleton rows={4} cols={4} />
              ) : produtosComprados.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Nenhum item comprado no período.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="py-2.5 px-3">Produto</th>
                        <th className="py-2.5 px-3 text-center">Qtd</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                        <th className="py-2.5 px-3 text-right">Custo Médio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {produtosComprados.map((p) => (
                        <tr key={p.produto_id} className="hover:bg-slate-50/70">
                          <td className="py-2 px-3 font-semibold text-slate-900 truncate max-w-[160px]">
                            {p.nome}
                          </td>
                          <td className="py-2 px-3 text-center font-bold text-slate-800 tabular-nums">
                            {p.quantidadeComprada} {p.unidade}
                          </td>
                          <td className="py-2 px-3 text-right font-black text-slate-900 tabular-nums">
                            {formatCurrency(p.valorTotal)}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-600 tabular-nums">
                            {formatCurrency(p.custoMedio)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* SEÇÃO 8: ESTOQUE */}
      <section>
        <Card className="rounded-xl border border-slate-200 bg-white shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-slate-900">
              8. Situação do Estoque e Movimentações
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Status atual dos saldos, níveis de reposição e movimentações no período
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 4 Indicadores de Estoque */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 bg-red-50/60 border border-red-200 rounded-xl">
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-700 block">
                  Produtos Zerados
                </span>
                <span className="text-2xl font-black text-red-900 tabular-nums">
                  {estoqueIndicadores?.produtosZerados ?? 0}
                </span>
                <p className="text-[10px] text-red-600 mt-0.5">Sem saldo em estoque</p>
              </div>

              <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 block">
                  Abaixo do Mínimo
                </span>
                <span className="text-2xl font-black text-amber-900 tabular-nums">
                  {estoqueIndicadores?.produtosAbaixoMinimo ?? 0}
                </span>
                <p className="text-[10px] text-amber-600 mt-0.5">Necessitam reposição</p>
              </div>

              <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">
                  Estoque Normal
                </span>
                <span className="text-2xl font-black text-emerald-900 tabular-nums">
                  {estoqueIndicadores?.produtosNormais ?? 0}
                </span>
                <p className="text-[10px] text-emerald-600 mt-0.5">Acima do mínimo</p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block">
                  Qtd Total em Estoque
                </span>
                <span className="text-2xl font-black text-slate-900 tabular-nums">
                  {estoqueIndicadores?.quantidadeTotalEstoque ?? 0}
                </span>
                <p className="text-[10px] text-slate-500 mt-0.5">Soma de todas as unidades</p>
              </div>
            </div>

            {/* Movimentações no Período */}
            <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                Movimentações Realizadas no Período
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                <div className="p-2 bg-white rounded-lg border border-emerald-200">
                  <span className="text-[10px] text-emerald-700 font-bold block">Entradas (+)</span>
                  <span className="text-sm font-black text-emerald-900">
                    {movimentacoesResumo?.entradas ?? 0}
                  </span>
                </div>
                <div className="p-2 bg-white rounded-lg border border-red-200">
                  <span className="text-[10px] text-red-700 font-bold block">Saídas (-)</span>
                  <span className="text-sm font-black text-red-900">
                    {movimentacoesResumo?.saidas ?? 0}
                  </span>
                </div>
                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-600 font-bold block">Perdas</span>
                  <span className="text-sm font-black text-slate-800">
                    {movimentacoesResumo?.perdas ?? 0}
                  </span>
                </div>
                <div className="p-2 bg-white rounded-lg border border-blue-200">
                  <span className="text-[10px] text-blue-700 font-bold block">Ajustes</span>
                  <span className="text-sm font-black text-blue-900">
                    {movimentacoesResumo?.ajustes ?? 0}
                  </span>
                </div>
                <div className="p-2 bg-white rounded-lg border border-orange-200">
                  <span className="text-[10px] text-orange-700 font-bold block">Devoluções</span>
                  <span className="text-sm font-black text-orange-900">
                    {movimentacoesResumo?.devolucoes ?? 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Tabela de Produtos com Filtro de Status */}
            <div className="space-y-2 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-800">
                  Produtos em Estoque ({estoqueItens.length})
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant={estoqueFiltroStatus === 'todos' ? 'default' : 'outline'}
                    onClick={() => setEstoqueFiltroStatus('todos')}
                    className={`h-7 text-xs ${estoqueFiltroStatus === 'todos' ? 'bg-teal-700 hover:bg-teal-800 text-white font-semibold' : 'text-slate-600'}`}
                  >
                    Todos
                  </Button>
                  <Button
                    size="sm"
                    variant={estoqueFiltroStatus === 'zerado' ? 'default' : 'outline'}
                    onClick={() => setEstoqueFiltroStatus('zerado')}
                    className={`h-7 text-xs ${estoqueFiltroStatus === 'zerado' ? 'bg-red-700 hover:bg-red-800 text-white font-semibold' : 'text-red-700 border-red-200'}`}
                  >
                    Zerados
                  </Button>
                  <Button
                    size="sm"
                    variant={estoqueFiltroStatus === 'abaixo_minimo' ? 'default' : 'outline'}
                    onClick={() => setEstoqueFiltroStatus('abaixo_minimo')}
                    className={`h-7 text-xs ${estoqueFiltroStatus === 'abaixo_minimo' ? 'bg-amber-700 hover:bg-amber-800 text-white font-semibold' : 'text-amber-700 border-amber-200'}`}
                  >
                    Abaixo do Mínimo
                  </Button>
                </div>
              </div>

              {loadingEstoqueItens ? (
                <TableSkeleton rows={4} cols={5} />
              ) : estoqueItens.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  Nenhum produto cadastrado com este status de estoque.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500 sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">Produto</th>
                        <th className="py-2.5 px-3">Código</th>
                        <th className="py-2.5 px-3 text-center">Estoque Atual</th>
                        <th className="py-2.5 px-3 text-center">Estoque Mínimo</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {estoqueItens.map((p) => {
                        const isZerado = p.status === 'zerado'
                        const isAbaixo = p.status === 'abaixo_minimo'

                        return (
                          <tr key={p.produto_id} className="hover:bg-slate-50/70">
                            <td className="py-2 px-3 font-semibold text-slate-900">{p.nome}</td>
                            <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">
                              {p.codigo ? `#${p.codigo}` : '-'}
                            </td>
                            <td className="py-2 px-3 text-center font-bold text-slate-900 tabular-nums">
                              {p.estoqueAtual} {p.unidade}
                            </td>
                            <td className="py-2 px-3 text-center text-slate-500 tabular-nums">
                              {p.estoqueMinimo} {p.unidade}
                            </td>
                            <td className="py-2 px-3 text-center">
                              {isZerado ? (
                                <Badge
                                  variant="outline"
                                  className="bg-red-100 text-red-800 border-red-200 font-semibold text-[10px]"
                                >
                                  Zerado
                                </Badge>
                              ) : isAbaixo ? (
                                <Badge
                                  variant="outline"
                                  className="bg-amber-100 text-amber-800 border-amber-200 font-semibold text-[10px]"
                                >
                                  Abaixo do Mínimo
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="bg-green-100 text-green-800 border-green-200 font-semibold text-[10px]"
                                >
                                  Normal
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
            </div>
          </CardContent>
        </Card>
      </section>

      {/* SEÇÃO 9: FINANCEIRO */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600">
          9. Desempenho Financeiro
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Card Contas a Receber */}
          <Card className="rounded-xl border border-slate-200 bg-white shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ArrowUpCircle className="w-4 h-4 text-teal-700" />
                Contas a Receber (Saldo Geral)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-24 rounded-lg" />
              ) : (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">
                      Total Gerado
                    </span>
                    <span className="text-base font-black text-slate-900 tabular-nums">
                      {formatCurrency(financeiroResumo?.contasReceber.total)}
                    </span>
                  </div>
                  <div className="p-3 bg-emerald-50/50 rounded-lg border border-emerald-200">
                    <span className="text-[10px] text-emerald-700 uppercase font-bold block">
                      Já Recebido
                    </span>
                    <span className="text-base font-black text-emerald-800 tabular-nums">
                      {formatCurrency(financeiroResumo?.contasReceber.recebido)}
                    </span>
                  </div>
                  <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-200">
                    <span className="text-[10px] text-blue-700 uppercase font-bold block">
                      Em Aberto
                    </span>
                    <span className="text-base font-black text-blue-800 tabular-nums">
                      {formatCurrency(financeiroResumo?.contasReceber.aberto)}
                    </span>
                  </div>
                  <div className="p-3 bg-red-50/50 rounded-lg border border-red-200">
                    <span className="text-[10px] text-red-700 uppercase font-bold block">
                      Vencido
                    </span>
                    <span className="text-base font-black text-red-800 tabular-nums">
                      {formatCurrency(financeiroResumo?.contasReceber.vencido)}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card Contas a Pagar */}
          <Card className="rounded-xl border border-slate-200 bg-white shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ArrowDownCircle className="w-4 h-4 text-amber-600" />
                Contas a Pagar (Saldo Geral)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-24 rounded-lg" />
              ) : (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">
                      Total Gerado
                    </span>
                    <span className="text-base font-black text-slate-900 tabular-nums">
                      {formatCurrency(financeiroResumo?.contasPagar.total)}
                    </span>
                  </div>
                  <div className="p-3 bg-emerald-50/50 rounded-lg border border-emerald-200">
                    <span className="text-[10px] text-emerald-700 uppercase font-bold block">
                      Já Pago
                    </span>
                    <span className="text-base font-black text-emerald-800 tabular-nums">
                      {formatCurrency(financeiroResumo?.contasPagar.pago)}
                    </span>
                  </div>
                  <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-200">
                    <span className="text-[10px] text-amber-700 uppercase font-bold block">
                      Em Aberto
                    </span>
                    <span className="text-base font-black text-amber-800 tabular-nums">
                      {formatCurrency(financeiroResumo?.contasPagar.aberto)}
                    </span>
                  </div>
                  <div className="p-3 bg-red-50/50 rounded-lg border border-red-200">
                    <span className="text-[10px] text-red-700 uppercase font-bold block">
                      Vencido
                    </span>
                    <span className="text-base font-black text-red-800 tabular-nums">
                      {formatCurrency(financeiroResumo?.contasPagar.vencido)}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Card Fluxo Financeiro (Gráfico) */}
        <Card className="rounded-xl border border-slate-200 bg-white shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-slate-900">
              Fluxo Financeiro Efetivado (Recebimentos vs Pagamentos)
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Valores efetivamente quitados por mês no período
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <Skeleton className="w-full h-full rounded-xl" />
              </div>
            ) : fluxoFinanceiro.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Nenhum pagamento ou recebimento liquidado no período.
              </div>
            ) : (
              <div className="h-64 w-full pt-2">
                <ChartContainer config={barChartConfig} className="h-full w-full">
                  <BarChart
                    data={fluxoFinanceiro}
                    margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="mes"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#64748b', fontSize: 11 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      tickFormatter={(val) =>
                        `R$ ${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`
                      }
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />
                      }
                    />
                    <Bar dataKey="recebimentos" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="pagamentos" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* SEÇÃO 10: PEDIDOS */}
      <section>
        <Card className="rounded-xl border border-slate-200 bg-white shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-slate-900">
              10. Pedidos Comerciais e Conversão
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Volume de pedidos abertos, status de atendimento e conversão em vendas faturadas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <Skeleton className="h-24 rounded-lg" />
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">
                      Total Pedidos
                    </span>
                    <span className="text-xl font-black text-slate-900 tabular-nums">
                      {pedidosIndicadores?.total ?? 0}
                    </span>
                  </div>
                  <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-200">
                    <span className="text-[10px] text-amber-700 font-bold uppercase block">
                      Pendentes
                    </span>
                    <span className="text-xl font-black text-amber-900 tabular-nums">
                      {pedidosIndicadores?.pendentes ?? 0}
                    </span>
                  </div>
                  <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-200">
                    <span className="text-[10px] text-blue-700 font-bold uppercase block">
                      Confirmados
                    </span>
                    <span className="text-xl font-black text-blue-900 tabular-nums">
                      {pedidosIndicadores?.confirmados ?? 0}
                    </span>
                  </div>
                  <div className="p-3 bg-emerald-50/60 rounded-lg border border-emerald-200">
                    <span className="text-[10px] text-emerald-700 font-bold uppercase block">
                      Faturados
                    </span>
                    <span className="text-xl font-black text-emerald-900 tabular-nums">
                      {pedidosIndicadores?.faturados ?? 0}
                    </span>
                  </div>
                  <div className="p-3 bg-red-50/60 rounded-lg border border-red-200">
                    <span className="text-[10px] text-red-700 font-bold uppercase block">
                      Cancelados
                    </span>
                    <span className="text-xl font-black text-red-900 tabular-nums">
                      {pedidosIndicadores?.cancelados ?? 0}
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-teal-50/60 rounded-xl border border-teal-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold text-teal-900 uppercase tracking-wider block">
                      Taxa de Conversão em Vendas
                    </span>
                    <p className="text-xs text-teal-700 mt-0.5">
                      Vendas originadas diretamente a partir de ordens de pedidos registradas no
                      período
                    </p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <span className="text-[10px] text-teal-700 font-medium block">
                        Pedidos Convertidos
                      </span>
                      <span className="text-lg font-black text-teal-950 tabular-nums">
                        {pedidosIndicadores?.convertidosEmVenda ?? 0}
                      </span>
                    </div>
                    <div className="text-right border-l border-teal-200 pl-6">
                      <span className="text-[10px] text-teal-700 font-medium block">
                        Valor Convertido
                      </span>
                      <span className="text-lg font-black text-teal-950 tabular-nums">
                        {formatCurrency(pedidosIndicadores?.valorConvertido)}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
