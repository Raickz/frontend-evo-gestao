import { useState, useEffect, useCallback, useMemo } from 'react'
import { TableSkeleton, EmptyState, ErrorState } from '@/components/common/CommonUI'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EvoHexagonLogo } from '@/components/common/EvoLogo'
import { useEmpresa } from '@/hooks/use-empresa'
import { useAuth } from '@/hooks/use-auth'
import { useTheme } from '@/hooks/use-theme'
import {
  DollarSign,
  ShoppingCart,
  Package,
  Users,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  ClipboardCheck,
  Circle,
  EyeOff,
  TrendingUp,
  TrendingDown,
  PlusCircle,
  UserPlus,
  ShoppingBag,
  ChevronRight,
  Percent,
  FileSpreadsheet,
  Zap,
  Calendar,
  Sparkles,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { canAccessPage } from '@/lib/permissions'
import { supabase } from '@/lib/supabase/client'
import { VendasService } from '@/services/vendas'
import { ClientesService } from '@/services/clientes'
import { ProdutosService } from '@/services/produtos'
import { EstoqueService } from '@/services/estoque'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts'

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
  faturamentoHoje: number
  pedidosHojeCount: number
  lucroHoje: number
  faturamentoMes: number
  vendasMesCount: number
  clientesAtivosCount: number
  produtosAtivosCount: number
  estoqueTotalQuantidade: number
  vendedoresAtivosCount: number
  estoqueBaixoCount: number
  vendasRecentes: VendaRecente[]
  estoqueBaixoItens: ItemEstoqueBaixo[]
}

// Hook de contagem animada suave e profissional
function useAnimatedCount(targetValue: number, duration = 800) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (typeof targetValue !== 'number' || isNaN(targetValue)) {
      setCount(0)
      return
    }

    let startTimestamp: number | null = null
    const startValue = 0

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp
      const progress = Math.min((timestamp - startTimestamp) / duration, 1)
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3)
      setCount(startValue + (targetValue - startValue) * easeProgress)

      if (progress < 1) {
        window.requestAnimationFrame(step)
      }
    }

    const animId = window.requestAnimationFrame(step)
    return () => window.cancelAnimationFrame(animId)
  }, [targetValue, duration])

  return count
}

// Componente individual de KPI Card com Sparkline e Glassmorphism
function KpiCard({
  title,
  value,
  isCurrency = false,
  percentage,
  isPositive = true,
  comparisonText,
  icon: Icon,
  sparklineData,
  colorScheme = 'blue',
}: {
  title: string
  value: number
  isCurrency?: boolean
  percentage: string
  isPositive?: boolean
  comparisonText: string
  icon: React.ElementType
  sparklineData: { v: number }[]
  colorScheme?: 'blue' | 'navy' | 'emerald' | 'amber' | 'silver'
}) {
  const animatedValue = useAnimatedCount(value, 900)

  const formattedValue = useMemo(() => {
    if (isCurrency) {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
        animatedValue,
      )
    }
    return Math.round(animatedValue).toLocaleString('pt-BR')
  }, [animatedValue, isCurrency])

  const strokeColor = isPositive ? '#0066FF' : '#EF4444'

  return (
    <div className="glass-card glass-card-hover rounded-2xl p-4 sm:p-5 flex flex-col justify-between relative overflow-hidden group">
      {/* Background soft ambient gradient */}
      <div className="absolute -top-12 -right-12 w-28 h-28 bg-[#0066FF]/5 dark:bg-[#0066FF]/10 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform duration-500" />

      {/* Header of KPI */}
      <div className="flex items-start justify-between gap-3 relative z-10">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#6E7785] dark:text-[#C0C6CF]">
            {title}
          </span>
          <div className="text-2xl sm:text-3xl font-black tracking-tight text-[#0A1328] dark:text-white tabular-nums mt-1">
            {formattedValue}
          </div>
        </div>
        <div className="h-10 w-10 rounded-xl bg-[#0066FF]/10 dark:bg-[#0066FF]/20 text-[#0066FF] dark:text-[#3385FF] flex items-center justify-center shrink-0 border border-[#0066FF]/20 shadow-xs">
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {/* Comparison & Sparkline Footer */}
      <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-[#18284B] relative z-10">
        <div className="flex items-center gap-1.5 flex-wrap">
          <div
            className={`inline-flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded-md ${
              isPositive
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
            }`}
          >
            {isPositive ? (
              <TrendingUp className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>{percentage}</span>
          </div>
          <span className="text-[11px] text-[#6E7785] dark:text-[#8E9AA8]">{comparisonText}</span>
        </div>

        {/* Mini Sparkline Chart */}
        <div className="w-16 h-7 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparklineData}>
              <Line
                type="monotone"
                dataKey="v"
                stroke={strokeColor}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { empresaId, empresa } = useEmpresa()
  const { usuario } = useAuth()
  const { theme } = useTheme()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chartPeriod, setChartPeriod] = useState<'7d' | '30d' | 'mes'>('7d')
  const [selectedDayInfo, setSelectedDayInfo] = useState<string | null>(null)
  const [data, setData] = useState<DashboardData>({
    faturamentoHoje: 0,
    pedidosHojeCount: 0,
    lucroHoje: 0,
    faturamentoMes: 0,
    vendasMesCount: 0,
    clientesAtivosCount: 0,
    produtosAtivosCount: 0,
    estoqueTotalQuantidade: 0,
    vendedoresAtivosCount: 0,
    estoqueBaixoCount: 0,
    vendasRecentes: [],
    estoqueBaixoItens: [],
  })

  const [sales7DaysRealData, setSales7DaysRealData] = useState<
    { data: string; valor: number; pedidos: number; display: string }[]
  >([])
  const [topProdutosRealData, setTopProdutosRealData] = useState<
    { pos: number; nome: string; categoria: string; qtd: number; valor: string }[]
  >([])
  const [paymentMethodsRealData, setPaymentMethodsRealData] = useState<
    { name: string; value: number; color: string; amount: string }[]
  >([])

  const perfilLogado = (usuario?.perfil || '').toLowerCase()
  const isMasterOrAdmin = perfilLogado === 'master' || perfilLogado === 'admin'

  const [onboardingData, setOnboardingData] = useState<OnboardingProgress | null>(null)
  const [loadingOnboarding, setLoadingOnboarding] = useState(true)
  const [checklistDismissed, setChecklistDismissed] = useState(false)

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
            .select('id', { count: 'exact' })
            .eq('empresa_id', empresaId)
            .eq('ativo', true),
          supabase
            .from('vendedores')
            .select('id', { count: 'exact' })
            .eq('empresa_id', empresaId)
            .eq('ativo', true),
          supabase
            .from('clientes')
            .select('id', { count: 'exact' })
            .eq('empresa_id', empresaId)
            .eq('ativo', true),
          supabase
            .from('produtos')
            .select('id', { count: 'exact' })
            .eq('empresa_id', empresaId)
            .eq('ativo', true),
          supabase
            .from('estoques')
            .select('id', { count: 'exact' })
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

      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)
      const startOfTodayIso = startOfToday.toISOString()

      // Período selecionado para o gráfico
      const hoje = new Date()
      hoje.setHours(23, 59, 59, 999)
      
      const inicioPeriodo = new Date()
      
      if (chartPeriod === '7d') {
        inicioPeriodo.setDate(inicioPeriodo.getDate() - 6)
      } else if (chartPeriod === '30d') {
        inicioPeriodo.setDate(inicioPeriodo.getDate() - 29)
      } else {
        // Mês atual
        inicioPeriodo.setDate(1)
      }
      
      inicioPeriodo.setHours(0, 0, 0, 0)
      
      const inicioPeriodoIso = inicioPeriodo.toISOString()
      const fimPeriodoIso = hoje.toISOString()
      
      const quantidadeDias =
        chartPeriod === '7d'
          ? 7
          : chartPeriod === '30d'
            ? 30
            : hoje.getDate()

      let queryVendasHoje = supabase
        .from('vendas')
        .select(
          `
          id,
          total,
          created_at,
          itens_venda(
            quantidade,
            preco_unitario,
            subtotal,
            produto_id,
            produto:produtos(
              nome,
              preco_custo
            )
          )
        `,
        )
        .eq('empresa_id', empresaId)
        .eq('status', 'finalizada')
        .gte('created_at', startOfTodayIso)

      if (resolvedVendedorId) {
        queryVendasHoje = queryVendasHoje.eq('vendedor_id', resolvedVendedorId)
      }

      let queryVendas7Dias = supabase
        .from('vendas')
        .select(
          'id, total, created_at, forma_pagamento, itens_venda(quantidade, preco_unitario, subtotal, produto_id, produto:produtos(nome))',
        )
        .eq('empresa_id', empresaId)
        .eq('status', 'finalizada')
        .gte('created_at', inicioPeriodoIso)
        .lte('created_at', fimPeriodoIso)
        .order('created_at', { ascending: true })

      if (resolvedVendedorId) {
        queryVendas7Dias = queryVendas7Dias.eq('vendedor_id', resolvedVendedorId)
      }

      const [
        faturamentoMesRes,
        vendasMesCountRes,
        clientesCountRes,
        produtosCountRes,
        estoqueBaixoRes,
        vendasRecentesRes,
        vendedoresCountRes,
        estoquesSomaRes,
        vendasHojeRes,
        vendas7DiasRes,
      ] = await Promise.all([
        VendasService.getFaturamentoMensal(empresaId, resolvedVendedorId),
        VendasService.getCountMensal(empresaId, resolvedVendedorId),
        ClientesService.countAtivos(empresaId),
        ProdutosService.countAtivos(empresaId),
        EstoqueService.listEstoqueBaixo(empresaId),
        VendasService.getRecentes(empresaId, resolvedVendedorId),
        supabase
          .from('vendedores')
          .select('id', { count: 'exact' })
          .eq('empresa_id', empresaId)
          .eq('ativo', true),
        supabase.from('estoques').select('quantidade').eq('empresa_id', empresaId),
        queryVendasHoje,
        queryVendas7Dias,
      ])

      if (faturamentoMesRes.error) throw faturamentoMesRes.error
      if (vendasMesCountRes.error) throw vendasMesCountRes.error
      if (clientesCountRes.error) throw clientesCountRes.error
      if (produtosCountRes.error) throw produtosCountRes.error
      if (estoqueBaixoRes.error) throw estoqueBaixoRes.error
      if (vendasRecentesRes.error) throw vendasRecentesRes.error
      if (vendasHojeRes.error) throw vendasHojeRes.error
      if (vendas7DiasRes.error) throw vendas7DiasRes.error

      const totalFaturadoMes = (faturamentoMesRes.data || []).reduce(
        (acc: number, curr: { total: number }) => acc + (curr.total || 0),
        0,
      )

      const vendasHojeList = vendasHojeRes.data || []
      const faturamentoHojeTotal = vendasHojeList.reduce(
        (acc: number, curr: any) => acc + Number(curr.total || 0),
        0,
      )
      const pedidosHojeTotal = vendasHojeList.length

      let lucroHojeTotal = 0
      vendasHojeList.forEach((v: any) => {
        if (Array.isArray(v.itens_venda)) {
          v.itens_venda.forEach((it: any) => {
            const vendaItem = Number(
              it.subtotal || Number(it.quantidade || 0) * Number(it.preco_unitario || 0) || 0,
            )
            const custoUnitario = Number(it.produto?.preco_custo || 0)
            const custoTotal = custoUnitario * Number(it.quantidade || 1)
            lucroHojeTotal += Math.max(0, vendaItem - custoTotal)
          })
        }
      })

      const estoqueTotalQtd = (estoquesSomaRes.data || []).reduce(
        (acc: number, item: { quantidade: number }) => acc + Number(item.quantidade || 0),
        0,
      )

      const estoqueBaixoList = (estoqueBaixoRes.data || []) as unknown as ItemEstoqueBaixo[]
      const vendasRecentesList = (vendasRecentesRes.data || []) as unknown as VendaRecente[]

      setData({
        faturamentoHoje: faturamentoHojeTotal,
        pedidosHojeCount: pedidosHojeTotal,
        lucroHoje: lucroHojeTotal,
        faturamentoMes: totalFaturadoMes,
        vendasMesCount: vendasMesCountRes.count ?? 0,
        clientesAtivosCount: clientesCountRes.count ?? 0,
        produtosAtivosCount: produtosCountRes.count ?? 0,
        estoqueTotalQuantidade: estoqueTotalQtd,
        vendedoresAtivosCount: vendedoresCountRes.count ?? 0,
        estoqueBaixoCount: estoqueBaixoList.length,
        vendasRecentes: vendasRecentesList,
        estoqueBaixoItens: estoqueBaixoList,
      })

     // Montar dados reais conforme o período selecionado
      const diasPeriodoMap: Record<string, { valor: number; pedidos: number }> = {}
      
      for (let i = quantidadeDias - 1; i >= 0; i--) {
        const d = new Date(hoje)
        d.setHours(0, 0, 0, 0)
        d.setDate(d.getDate() - i)
      
        const diaStr = `${String(d.getDate()).padStart(2, '0')}/${String(
          d.getMonth() + 1,
        ).padStart(2, '0')}`
      
        diasPeriodoMap[diaStr] = {
          valor: 0,
          pedidos: 0,
        }
      }
      
      const vendasPeriodoList = vendas7DiasRes.data || []
      
      vendasPeriodoList.forEach((v: any) => {
        if (v.created_at) {
          const vd = new Date(v.created_at)
      
          const key = `${String(vd.getDate()).padStart(2, '0')}/${String(
            vd.getMonth() + 1,
            ).padStart(2, '0')}`
      
          if (diasPeriodoMap[key]) {
            diasPeriodoMap[key].valor += Number(v.total || 0)
            diasPeriodoMap[key].pedidos += 1
          }
        }
      })
      
      const chartPeriodo = Object.keys(diasPeriodoMap).map((k) => ({
        data: k,
        valor: diasPeriodoMap[k].valor,
        pedidos: diasPeriodoMap[k].pedidos,
        display: new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(diasPeriodoMap[k].valor),
      }))
      
      setSales7DaysRealData(chartPeriodo)

      // Montar Top Produtos reais
      const prodMap: Record<
        string,
        { nome: string; categoria: string; qtd: number; valor: number }
      > = {}
      vendas7List.forEach((v: any) => {
        if (Array.isArray(v.itens_venda)) {
          v.itens_venda.forEach((it: any) => {
            const nomeProd = it.produto?.nome || 'Produto'
            const catProd = it.produto?.categoria || 'Geral'
            if (!prodMap[nomeProd]) {
              prodMap[nomeProd] = { nome: nomeProd, categoria: catProd, qtd: 0, valor: 0 }
            }
            prodMap[nomeProd].qtd += Number(it.quantidade || 1)
            prodMap[nomeProd].valor += Number(it.subtotal || it.preco_unitario || 0)
          })
        }
      })

      const topProdList = Object.values(prodMap)
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 5)
        .map((p, idx) => ({
          pos: idx + 1,
          nome: p.nome,
          categoria: p.categoria,
          qtd: p.qtd,
          valor: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
            p.valor,
          ),
        }))
      setTopProdutosRealData(topProdList)

      // Formas de Pagamento reais
      const formasCount: Record<string, number> = {}
      let totalFormas = 0
      vendas7List.forEach((v: any) => {
        const fp = v.forma_pagamento ? String(v.forma_pagamento).toLowerCase() : 'outros'
        formasCount[fp] = (formasCount[fp] || 0) + Number(v.total || 0)
        totalFormas += Number(v.total || 0)
      })

      const paymentColors: Record<string, string> = {
        pix: '#0066FF',
        cartao_credito: '#3385FF',
        cartao_debito: '#6E7785',
        dinheiro: '#10B981',
        boleto: '#F59E0B',
        a_prazo: '#8B5CF6',
        outros: '#C0C6CF',
      }

      const paymentLabels: Record<string, string> = {
        pix: 'PIX',
        cartao_credito: 'Cartão de Crédito',
        cartao_debito: 'Cartão de Débito',
        dinheiro: 'Dinheiro',
        boleto: 'Boleto',
        a_prazo: 'A Prazo',
        outros: 'Outros',
      }

      const formasList = Object.keys(formasCount).map((fpKey) => {
        const amt = formasCount[fpKey]
        const percent = totalFormas > 0 ? Math.round((amt / totalFormas) * 100) : 0
        return {
          name: paymentLabels[fpKey] || fpKey.toUpperCase(),
          value: percent,
          color: paymentColors[fpKey] || '#0066FF',
          amount: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
            amt,
          ),
        }
      })
      setPaymentMethodsRealData(formasList)
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
  }, [empresaId, usuario?.perfil, usuario?.id, chartPeriod])

  useEffect(() => {
    loadDashboardData()
    loadOnboardingProgress()
  }, [loadDashboardData, loadOnboardingProgress])

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

  // Gráfico dos 7 dias real
  const sales7DaysData = sales7DaysRealData

  // Top Produtos real
  const topProdutosData = topProdutosRealData

  // Formas de Pagamento real
  const paymentMethodsData = paymentMethodsRealData

  // Alertas Baseados em Dados Reais
  const alertsData: {
    type: 'critical' | 'warning' | 'info' | 'success'
    tag: string
    title: string
    desc: string
    actionLink: string
    actionText: string
    badgeClass: string
    dotClass: string
  }[] = []

  if (data.estoqueBaixoCount > 0) {
    alertsData.push({
      type: 'critical',
      tag: 'Estoque Baixo',
      title: `${data.estoqueBaixoCount} ${data.estoqueBaixoCount === 1 ? 'item atingiu' : 'itens atingiram'} o nível de segurança`,
      desc: 'Itens com estoque abaixo do mínimo exigem reposição ou pedido de compra.',
      actionLink: '/app/estoque',
      actionText: 'Ver Estoque',
      badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
      dotClass: 'bg-rose-500',
    })
  }

  if (data.clientesAtivosCount > 0) {
    alertsData.push({
      type: 'success',
      tag: 'Clientes Ativos',
      title: `${data.clientesAtivosCount} clientes ativos na base`,
      desc: 'Carteira de clientes cadastrados e ativos no sistema da empresa.',
      actionLink: '/app/clientes',
      actionText: 'Ver Clientes',
      badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      dotClass: 'bg-emerald-500',
    })
  }

  if (data.produtosAtivosCount === 0) {
    alertsData.push({
      type: 'warning',
      tag: 'Catálogo',
      title: 'Nenhum produto cadastrado',
      desc: 'Cadastre os primeiros produtos para começar a movimentar vendas e estoque.',
      actionLink: '/app/produtos',
      actionText: 'Cadastrar Produto',
      badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
      dotClass: 'bg-amber-500',
    })
  } else {
    alertsData.push({
      type: 'info',
      tag: 'Catálogo',
      title: `${data.produtosAtivosCount} produtos ativos`,
      desc: 'Produtos prontos para venda e movimentação de estoque.',
      actionLink: '/app/produtos',
      actionText: 'Ver Produtos',
      badgeClass: 'bg-[#0066FF]/15 text-[#0066FF] dark:text-[#3385FF] border-[#0066FF]/30',
      dotClass: 'bg-[#0066FF]',
    })
  }

  // Sparklines com base nos dados reais dos 7 dias
  const sparklineSales =
    sales7DaysData.length > 0
      ? sales7DaysData.map((d) => ({ v: d.valor }))
      : [{ v: 0 }, { v: 0 }, { v: 0 }, { v: 0 }, { v: 0 }, { v: 0 }, { v: 0 }]

  const sparklineOrders =
    sales7DaysData.length > 0
      ? sales7DaysData.map((d) => ({ v: d.pedidos }))
      : [{ v: 0 }, { v: 0 }, { v: 0 }, { v: 0 }, { v: 0 }, { v: 0 }, { v: 0 }]

  const sparklineProfit =
    sales7DaysData.length > 0
      ? sales7DaysData.map((d) => ({ v: Math.round(d.valor * 0.25) }))
      : [{ v: 0 }, { v: 0 }, { v: 0 }, { v: 0 }, { v: 0 }, { v: 0 }, { v: 0 }]

  const sparklineClients = [{ v: data.clientesAtivosCount }, { v: data.clientesAtivosCount }]
  const sparklineStock = [{ v: data.estoqueTotalQuantidade }, { v: data.estoqueTotalQuantidade }]

  const userName = usuario?.nome || 'Usuário'

  return (
    <div className="space-y-6 pb-12">
      {/* 4. HEADER DO DASHBOARD */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/70 dark:border-[#152342]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#0A1328] dark:text-white">
              Olá, {userName}! 👋
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-[#6E7785] dark:text-[#C0C6CF] mt-1 font-medium">
            Aqui está o resumo da sua empresa hoje.
          </p>
        </div>

        {/* Header Actions: Date Selector, Refresh, Nova Venda */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/70 dark:bg-[#0E1A33]/80 border border-slate-200/80 dark:border-[#1A2C50] text-xs font-semibold text-[#0A1328] dark:text-[#C0C6CF] shadow-xs backdrop-blur-md">
            <Calendar className="w-3.5 h-3.5 text-[#0066FF]" />
            <span>
              Hoje,{' '}
              {new Date().toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadDashboardData()
              loadOnboardingProgress()
            }}
            disabled={loading}
            className="h-9 rounded-xl border-slate-200/80 dark:border-[#1A2C50] text-slate-700 dark:text-[#C0C6CF] bg-white/80 dark:bg-[#0E1A33]/80 hover:bg-slate-100 dark:hover:bg-[#15274D] backdrop-blur-md text-xs font-semibold shadow-xs"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 mr-1.5 text-[#0066FF] ${loading ? 'animate-spin' : ''}`}
            />
            Atualizar
          </Button>

          {canAccessPage(usuario?.perfil, 'vendas') && (
            <Link to="/app/vendas">
              <Button className="h-9 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white flex items-center gap-1.5 shadow-md shadow-[#0066FF]/25 font-bold text-xs transition-transform active:scale-95">
                <PlusCircle className="w-4 h-4" />
                Nova Venda
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Banner de Primeiro Acesso */}
      {showFirstAccessBanner && (
        <div className="glass-card rounded-2xl border border-[#0066FF]/30 bg-gradient-to-r from-[#0066FF]/10 via-[#0A1328]/10 to-[#0066FF]/5 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-[#0066FF] text-white flex items-center justify-center shrink-0 shadow-md shadow-[#0066FF]/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#0A1328] dark:text-white">
                Vamos preparar sua empresa para o EVO Gestão 🚀
              </h3>
              <p className="text-xs sm:text-sm text-[#6E7785] dark:text-[#C0C6CF] mt-0.5">
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
            className="bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-bold shrink-0 shadow-md shadow-[#0066FF]/25 h-9 px-4 rounded-xl"
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
          {/* 5. CARDS DE KPI MODERNOS (Requirement #5 & #6) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="glass-card rounded-2xl p-4">
                  <TableSkeleton rows={2} cols={1} />
                </div>
              ))
            ) : (
              <>
                {/* 1. Vendas Hoje */}
                <KpiCard
                  title="Vendas hoje"
                  value={data.faturamentoHoje}
                  isCurrency={true}
                  percentage={data.faturamentoHoje > 0 ? '+100%' : '0%'}
                  isPositive={true}
                  comparisonText="vs ontem"
                  icon={DollarSign}
                  sparklineData={sparklineSales}
                />

                {/* 2. Pedidos Hoje */}
                <KpiCard
                  title="Pedidos hoje"
                  value={data.pedidosHojeCount}
                  isCurrency={false}
                  percentage={data.pedidosHojeCount > 0 ? `+${data.pedidosHojeCount}` : '0'}
                  isPositive={true}
                  comparisonText="vs ontem"
                  icon={ShoppingCart}
                  sparklineData={sparklineOrders}
                />

                {/* 3. Lucro Hoje */}
                <KpiCard
                  title="Lucro hoje"
                  value={data.lucroHoje}
                  isCurrency={true}
                  percentage={data.lucroHoje > 0 ? '+100%' : '0%'}
                  isPositive={true}
                  comparisonText="vs ontem"
                  icon={TrendingUp}
                  sparklineData={sparklineProfit}
                />

                {/* 4. Clientes Ativos */}
                <KpiCard
                  title="Clientes ativos"
                  value={data.clientesAtivosCount}
                  isCurrency={false}
                  percentage={data.clientesAtivosCount > 0 ? `+${data.clientesAtivosCount}` : '0'}
                  isPositive={true}
                  comparisonText="total na base"
                  icon={Users}
                  sparklineData={sparklineClients}
                />

                {/* 5. Itens em Estoque */}
                <KpiCard
                  title="Itens em estoque"
                  value={data.estoqueTotalQuantidade}
                  isCurrency={false}
                  percentage={
                    data.produtosAtivosCount > 0
                      ? `${data.produtosAtivosCount} produtos`
                      : '0 produtos'
                  }
                  isPositive={data.estoqueTotalQuantidade > 0}
                  comparisonText="unidades físicas"
                  icon={Package}
                  sparklineData={sparklineStock}
                />
              </>
            )}
          </div>

          {/* 10. AÇÕES RÁPIDAS (Requirement #10) */}
          <div className="glass-card rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-[#18284B]">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#0066FF]" />
                <h3 className="text-sm font-extrabold text-[#0A1328] dark:text-white">
                  Ações Rápidas
                </h3>
              </div>
              <span className="text-[11px] text-[#6E7785] dark:text-[#C0C6CF] hidden sm:inline">
                Atalhos operacionais rápidos
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Ação: Nova Venda */}
              <Link
                to="/app/vendas"
                className="group p-3.5 rounded-xl border border-slate-200/80 dark:border-[#18284B] bg-white/40 dark:bg-[#0E1A33]/40 hover:border-[#0066FF] dark:hover:border-[#0066FF] hover:bg-[#0066FF]/5 dark:hover:bg-[#0066FF]/10 transition-all flex items-start gap-3 backdrop-blur-sm"
              >
                <div className="p-2.5 rounded-xl bg-[#0066FF]/10 text-[#0066FF] dark:text-[#3385FF] group-hover:bg-[#0066FF] group-hover:text-white transition-colors">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-[#0066FF] dark:group-hover:text-[#3385FF]">
                      Nova Venda
                    </h4>
                    <ChevronRight className="w-3.5 h-3.5 text-[#6E7785] group-hover:translate-x-1 transition-transform" />
                  </div>
                  <p className="text-[11px] text-[#6E7785] dark:text-[#C0C6CF] mt-0.5 truncate">
                    Registrar pedido e faturamento
                  </p>
                </div>
              </Link>

              {/* Ação: Novo Pedido */}
              <Link
                to="/app/pedidos"
                className="group p-3.5 rounded-xl border border-slate-200/80 dark:border-[#18284B] bg-white/40 dark:bg-[#0E1A33]/40 hover:border-[#0066FF] dark:hover:border-[#0066FF] hover:bg-[#0066FF]/5 dark:hover:bg-[#0066FF]/10 transition-all flex items-start gap-3 backdrop-blur-sm"
              >
                <div className="p-2.5 rounded-xl bg-[#0066FF]/10 text-[#0066FF] dark:text-[#3385FF] group-hover:bg-[#0066FF] group-hover:text-white transition-colors">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-[#0066FF] dark:group-hover:text-[#3385FF]">
                      Novo Pedido
                    </h4>
                    <ChevronRight className="w-3.5 h-3.5 text-[#6E7785] group-hover:translate-x-1 transition-transform" />
                  </div>
                  <p className="text-[11px] text-[#6E7785] dark:text-[#C0C6CF] mt-0.5 truncate">
                    Emitir orçamento ou pedido
                  </p>
                </div>
              </Link>

              {/* Ação: Novo Cliente */}
              <Link
                to="/app/clientes"
                className="group p-3.5 rounded-xl border border-slate-200/80 dark:border-[#18284B] bg-white/40 dark:bg-[#0E1A33]/40 hover:border-[#0066FF] dark:hover:border-[#0066FF] hover:bg-[#0066FF]/5 dark:hover:bg-[#0066FF]/10 transition-all flex items-start gap-3 backdrop-blur-sm"
              >
                <div className="p-2.5 rounded-xl bg-[#0066FF]/10 text-[#0066FF] dark:text-[#3385FF] group-hover:bg-[#0066FF] group-hover:text-white transition-colors">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-[#0066FF] dark:group-hover:text-[#3385FF]">
                      Novo Cliente
                    </h4>
                    <ChevronRight className="w-3.5 h-3.5 text-[#6E7785] group-hover:translate-x-1 transition-transform" />
                  </div>
                  <p className="text-[11px] text-[#6E7785] dark:text-[#C0C6CF] mt-0.5 truncate">
                    Cadastrar e liberar limite
                  </p>
                </div>
              </Link>

              {/* Ação: Novo Produto */}
              <Link
                to="/app/produtos"
                className="group p-3.5 rounded-xl border border-slate-200/80 dark:border-[#18284B] bg-white/40 dark:bg-[#0E1A33]/40 hover:border-[#0066FF] dark:hover:border-[#0066FF] hover:bg-[#0066FF]/5 dark:hover:bg-[#0066FF]/10 transition-all flex items-start gap-3 backdrop-blur-sm"
              >
                <div className="p-2.5 rounded-xl bg-[#0066FF]/10 text-[#0066FF] dark:text-[#3385FF] group-hover:bg-[#0066FF] group-hover:text-white transition-colors">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-[#0066FF] dark:group-hover:text-[#3385FF]">
                      Novo Produto
                    </h4>
                    <ChevronRight className="w-3.5 h-3.5 text-[#6E7785] group-hover:translate-x-1 transition-transform" />
                  </div>
                  <p className="text-[11px] text-[#6E7785] dark:text-[#C0C6CF] mt-0.5 truncate">
                    Inserir no catálogo geral
                  </p>
                </div>
              </Link>
            </div>
          </div>

          {/* 7. GRÁFICO DE VENDAS + 12. FORMAS DE PAGAMENTO (Lado a Lado) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 7. Gráfico Vendas nos últimos 7 dias */}
            <div className="glass-card rounded-2xl p-5 lg:col-span-2 flex flex-col justify-between">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-100 dark:border-[#18284B]">
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-[#0A1328] dark:text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#0066FF]" />
                    Vendas nos últimos 7 dias
                  </h3>
                  <p className="text-xs text-[#6E7785] dark:text-[#C0C6CF] mt-0.5">
                    {sales7DaysData.length > 0
                      ? `Período de ${sales7DaysData[0].data} a ${sales7DaysData[sales7DaysData.length - 1].data} · Faturamento diário e volume de pedidos`
                      : 'Período sem dados · Faturamento diário e volume de pedidos'}
                  </p>
                </div>

                {/* Filtro de Período */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#0E1A33] rounded-xl border border-slate-200/60 dark:border-[#18284B]">
                  {(['7d', '30d', 'mes'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setChartPeriod(p)}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                        chartPeriod === p
                          ? 'bg-[#0066FF] text-white shadow-xs'
                          : 'text-[#6E7785] dark:text-[#C0C6CF] hover:text-[#0A1328] dark:hover:text-white'
                      }`}
                    >
                      {p === '7d' ? '7 Dias' : p === '30d' ? '30 Dias' : 'Mês'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Area Chart with Soft Gradient */}
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={sales7DaysData}
                    margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="evoAreaBlueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0066FF" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#0066FF" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="data"
                      stroke={theme === 'dark' ? '#6E7785' : '#8E9AA8'}
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke={theme === 'dark' ? '#6E7785' : '#8E9AA8'}
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `R$${v}`}
                    />
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const pData = payload[0].payload
                          return (
                            <div className="glass-card rounded-xl p-3 border border-[#0066FF]/30 shadow-lg text-xs space-y-1">
                              <p className="font-bold text-[#0A1328] dark:text-white flex items-center justify-between gap-3">
                                <span>Dia {pData.data}</span>
                                <Badge className="bg-[#0066FF] text-white text-[10px] px-1.5 py-0">
                                  {pData.pedidos} pedidos
                                </Badge>
                              </p>
                              <p className="text-sm font-black text-[#0066FF] dark:text-[#3385FF]">
                                {pData.display}
                              </p>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="valor"
                      stroke="#0066FF"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#evoAreaBlueGrad)"
                      activeDot={{ r: 6, stroke: '#FFFFFF', strokeWidth: 2, fill: '#0066FF' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Day indicator footer */}
              <div className="flex items-center justify-between text-[11px] text-[#6E7785] dark:text-[#8E9AA8] pt-2 border-t border-slate-100 dark:border-[#18284B] mt-2">
                <span>
                  Faturamento no mês: <strong>{formatCurrency(data.faturamentoMes)}</strong>
                </span>
                <span className="text-[#0066FF] font-semibold">
                  Total de pedidos: {data.vendasMesCount}
                </span>
              </div>
            </div>

            {/* 12. Donut Vendas por Forma de Pagamento */}
            <div className="glass-card rounded-2xl p-5 flex flex-col justify-between">
              <div className="pb-3 border-b border-slate-100 dark:border-[#18284B]">
                <h3 className="text-sm sm:text-base font-extrabold text-[#0A1328] dark:text-white flex items-center gap-2">
                  <Percent className="w-4 h-4 text-[#0066FF]" />
                  Formas de Pagamento
                </h3>
                <p className="text-xs text-[#6E7785] dark:text-[#C0C6CF] mt-0.5">
                  Distribuição percentual das vendas
                </p>
              </div>

              {paymentMethodsData.length === 0 ? (
                <div className="h-44 w-full flex flex-col items-center justify-center text-center p-4">
                  <Percent className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Nenhuma venda registrada
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                    As formas de pagamento aparecerão conforme as vendas forem emitidas.
                  </p>
                </div>
              ) : (
                <>
                  {/* Donut Chart with center total */}
                  <div className="relative h-44 w-full flex items-center justify-center my-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={paymentMethodsData}
                          cx="50%"
                          cy="50%"
                          innerRadius={52}
                          outerRadius={72}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {paymentMethodsData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Center text in Donut */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[10px] uppercase font-bold text-[#6E7785] dark:text-[#C0C6CF]">
                        Total
                      </span>
                      <span className="text-base font-black text-[#0A1328] dark:text-white">
                        100%
                      </span>
                    </div>
                  </div>

                  {/* Legend with percentages and colors */}
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-[#18284B]">
                    {paymentMethodsData.map((item) => (
                      <div key={item.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-slate-700 dark:text-[#C0C6CF] font-medium truncate">
                            {item.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-bold text-[#0A1328] dark:text-white">
                            {item.value}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 8. TOP PRODUTOS + 9. ALERTAS IMPORTANTES (Lado a Lado) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 8. Top Produtos Ranking */}
            <div className="glass-card rounded-2xl p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#18284B]">
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-[#0A1328] dark:text-white flex items-center gap-2">
                    <Package className="w-4 h-4 text-[#0066FF]" />
                    Top Produtos
                  </h3>
                  <p className="text-xs text-[#6E7785] dark:text-[#C0C6CF] mt-0.5">
                    Ranking dos itens mais vendidos no período
                  </p>
                </div>
                <Link to="/app/produtos">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[#0066FF] hover:text-[#0052CC] text-xs h-7 px-2 font-semibold flex items-center gap-1"
                  >
                    Ver catálogo
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
              </div>

              {topProdutosData.length === 0 ? (
                <div className="py-8 text-center text-slate-500 dark:text-[#C0C6CF]">
                  <Package className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-xs font-medium">Nenhum produto vendido ainda</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Os itens mais vendidos nos últimos 7 dias aparecerão aqui.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-[#18284B] my-2">
                  {topProdutosData.map((prod) => (
                    <div
                      key={prod.pos}
                      className="py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-[#111F38]/40 px-2 rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`h-7 w-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                            prod.pos === 1
                              ? 'bg-[#0066FF] text-white shadow-xs'
                              : prod.pos === 2
                                ? 'bg-[#3385FF]/20 text-[#0066FF] dark:text-[#3385FF]'
                                : 'bg-slate-100 dark:bg-[#152342] text-[#6E7785] dark:text-[#C0C6CF]'
                          }`}
                        >
                          {prod.pos}
                        </span>
                        <div className="truncate">
                          <p className="text-xs font-bold text-[#0A1328] dark:text-white truncate">
                            {prod.nome}
                          </p>
                          <span className="text-[10px] text-[#6E7785] dark:text-[#8E9AA8]">
                            {prod.categoria} · {prod.qtd} un vendidas
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-[#0A1328] dark:text-white font-mono">
                          {prod.valor}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 9. Alertas Importantes */}
            <div className="glass-card rounded-2xl p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#18284B]">
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-[#0A1328] dark:text-white flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Alertas Importantes
                  </h3>
                  <p className="text-xs text-[#6E7785] dark:text-[#C0C6CF] mt-0.5">
                    Notificações operacionais e atenção imediata
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] border-amber-300 dark:border-amber-800 text-amber-600 font-bold"
                >
                  {alertsData.length} {alertsData.length === 1 ? 'ativo' : 'ativos'}
                </Badge>
              </div>

              <div className="space-y-2.5 my-2">
                {alertsData.map((al, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-slate-100 dark:border-[#18284B] bg-white/40 dark:bg-[#0E1A33]/40 flex items-start justify-between gap-3 backdrop-blur-sm hover:border-[#0066FF]/30 transition-all"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${al.dotClass}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#0A1328] dark:text-white">
                            {al.title}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#6E7785] dark:text-[#C0C6CF] mt-0.5">
                          {al.desc}
                        </p>
                      </div>
                    </div>

                    <Link to={al.actionLink} className="shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] text-[#0066FF] hover:text-[#0052CC] font-bold"
                      >
                        {al.actionText}
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 11. ÚLTIMAS VENDAS */}
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#18284B]">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-[#0A1328] dark:text-white flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-[#0066FF]" />
                  Últimas Vendas
                </h3>
                <p className="text-xs text-[#6E7785] dark:text-[#C0C6CF] mt-0.5">
                  Movimentações comerciais recentes
                </p>
              </div>

              {canAccessPage(usuario?.perfil, 'vendas') && (
                <Link to="/app/vendas">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[#0066FF] hover:text-[#0052CC] text-xs h-8 font-bold flex items-center gap-1"
                  >
                    Ver todas
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              )}
            </div>

            <div className="mt-3 overflow-x-auto">
              {data.vendasRecentes.length === 0 ? (
                <div className="py-8 text-center">
                  <EmptyState
                    icon={ShoppingCart}
                    title="Nenhuma venda recente"
                    description="Novas vendas registradas aparecerão em tempo real aqui."
                    actionLabel={
                      canAccessPage(usuario?.perfil, 'vendas') ? 'Nova Venda' : undefined
                    }
                    onAction={() => (window.location.href = '/app/vendas')}
                  />
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-[#18284B] text-[#6E7785] dark:text-[#8E9AA8] uppercase font-bold text-[10px]">
                      <th className="pb-2.5 font-bold">Nº</th>
                      <th className="pb-2.5 font-bold">Cliente</th>
                      <th className="pb-2.5 font-bold">Forma de Pagamento</th>
                      <th className="pb-2.5 font-bold">Data</th>
                      <th className="pb-2.5 font-bold">Status</th>
                      <th className="pb-2.5 font-bold text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#18284B]">
                    {data.vendasRecentes.slice(0, 5).map((venda) => (
                      <tr
                        key={venda.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-[#111F38]/40 transition-colors"
                      >
                        <td className="py-3 font-mono font-semibold text-[#0066FF]">
                          {venda.numero != null ? `#${venda.numero}` : '—'}
                        </td>
                        <td className="py-3 font-bold text-[#0A1328] dark:text-white">
                          {venda.clientes?.nome || 'Cliente não identificado'}
                        </td>
                        <td className="py-3 text-[#6E7785] dark:text-[#C0C6CF]">
                          <Badge
                            variant="outline"
                            className="text-[11px] font-medium border-slate-200 dark:border-[#1E2F52] bg-slate-50/70 dark:bg-[#0E1A33]"
                          >
                            {formatFormaPagamento(venda.forma_pagamento)}
                          </Badge>
                        </td>
                        <td className="py-3 text-[#6E7785] dark:text-[#8E9AA8] whitespace-nowrap">
                          {formatDate(venda.created_at)}
                        </td>
                        <td className="py-3">
                          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                            Pago
                          </Badge>
                        </td>
                        <td className="py-3 font-black text-[#0A1328] dark:text-white text-right font-mono whitespace-nowrap">
                          {formatCurrency(venda.total || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* 13. BLOCO DE MARCA EVO + 14. RELATÓRIOS INTELIGENTES (Lado a Lado) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 13. Bloco Institucional de Marca EVO Gestão (Requirement #13) */}
            <div className="glass-card rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between border-l-4 border-l-[#0066FF]">
              <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 bg-[#0066FF]/10 rounded-full blur-2xl pointer-events-none" />

              <div className="space-y-4 relative z-10">
                <EvoHexagonLogo size={42} withText={true} subtitle="Tecnologia Corporativa" />
                <p className="text-sm font-semibold text-[#0A1328] dark:text-white leading-relaxed">
                  “Tecnologia que organiza. Gestão que faz crescer.”
                </p>
                <p className="text-xs text-[#6E7785] dark:text-[#C0C6CF]">
                  Sistema integrado de alta performance com segurança corporativa e governança para
                  sua distribuidora.
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-[#18284B] flex items-center justify-between">
                <span className="text-[11px] text-[#6E7785] dark:text-[#8E9AA8]">
                  Versão 2.4 Enterprise
                </span>
                <Link to="/app/relatorios">
                  <Button
                    size="sm"
                    className="bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-bold rounded-xl shadow-xs"
                  >
                    Ver relatórios
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* 14. Relatórios Inteligentes (Requirement #14) */}
            <div className="glass-card rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between border-l-4 border-l-[#3385FF]">
              <div className="space-y-3 relative z-10">
                <div className="flex items-center gap-2.5">
                  <div className="h-10 w-10 rounded-xl bg-[#0066FF]/10 text-[#0066FF] dark:text-[#3385FF] flex items-center justify-center">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#0A1328] dark:text-white">
                      Relatórios Inteligentes
                    </h3>
                    <span className="text-[10px] text-[#0066FF] dark:text-[#3385FF] font-semibold uppercase tracking-wider">
                      Business Intelligence
                    </span>
                  </div>
                </div>

                <p className="text-xs text-[#6E7785] dark:text-[#C0C6CF] leading-relaxed">
                  Acesse análises detalhadas e tome decisões mais estratégicas para o crescimento da
                  sua empresa.
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-[#18284B] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[11px] text-[#6E7785] dark:text-[#8E9AA8]">
                    Métricas consolidadas
                  </span>
                </div>
                <Link to="/app/relatorio-lucro">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-[#0066FF]/30 text-[#0066FF] dark:text-[#3385FF] hover:bg-[#0066FF]/10 text-xs font-bold rounded-xl"
                  >
                    Ver relatórios
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* PARTE: Checklist de Configuração Inicial (apenas Master/Admin) */}
          {isMasterOrAdmin && (!isComplete || !checklistDismissed) && (
            <div id="onboarding-checklist">
              <div
                className={`glass-card rounded-2xl p-5 border transition-colors ${
                  isComplete
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-[#0066FF]/30 bg-white/60 dark:bg-[#0D1933]/60'
                }`}
              >
                <div className="pb-3 border-b border-slate-100 dark:border-[#18284B] flex flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isComplete
                          ? 'bg-emerald-500/15 text-emerald-600'
                          : 'bg-[#0066FF]/15 text-[#0066FF]'
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
                        <h3 className="text-sm sm:text-base font-extrabold text-[#0A1328] dark:text-white">
                          Configuração Inicial
                        </h3>
                        {isComplete && (
                          <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px] font-bold">
                            Empresa configurada 🎉
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-[#6E7785] dark:text-[#C0C6CF] mt-0.5">
                        {loadingOnboarding
                          ? 'Calculando progresso da empresa...'
                          : `${completedCount} de 7 concluídos`}
                      </p>
                    </div>
                  </div>

                  {isComplete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDismissChecklist}
                      className="text-xs text-[#6E7785] hover:text-[#0A1328] dark:hover:text-white h-8 flex items-center gap-1.5"
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                      Ocultar
                    </Button>
                  )}
                </div>

                <div className="pt-4">
                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="w-full bg-slate-100 dark:bg-[#152342] rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          isComplete ? 'bg-emerald-500' : 'bg-[#0066FF]'
                        }`}
                        style={{ width: `${Math.round((completedCount / 7) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Checklist Items Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                    {checklistItems.map((item) => (
                      <div
                        key={item.key}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-colors ${
                          item.done
                            ? 'bg-emerald-500/5 border-emerald-500/20 text-slate-800 dark:text-slate-200'
                            : 'bg-white/40 dark:bg-[#0E1A33]/40 border-slate-200/80 dark:border-[#1A2C50] text-[#6E7785] dark:text-[#C0C6CF]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          {item.done ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <Circle className="w-4 h-4 text-[#6E7785] shrink-0" />
                          )}
                          <span className={`truncate ${item.done ? 'font-bold' : ''}`}>
                            {item.label}
                          </span>
                        </div>

                        {!isComplete && !item.done && item.link && (
                          <Link to={item.link} className="shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[10px] text-[#0066FF] hover:text-[#0052CC] font-bold"
                            >
                              {item.actionText}
                            </Button>
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
