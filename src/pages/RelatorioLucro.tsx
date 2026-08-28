import { useState, useEffect, useCallback } from 'react'
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Percent,
  Receipt,
  Activity,
  Calendar,
  Filter,
  Info,
  RefreshCw,
} from 'lucide-react'
import {
  PageHeader,
  MetricCard,
  TableSkeleton,
  EmptyState,
  ErrorState,
} from '@/components/common/CommonUI'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useEmpresa } from '@/hooks/use-empresa'
import { RelatorioLucroService, LucroResumo, LucroPorVendedor } from '@/services/relatorio-lucro'
import { ComissoesService } from '@/services/comissoes'

interface VendedorOption {
  id: string
  nome: string
}

const formatCurrency = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(val)) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val)
}

type PeriodoPredefinido =
  | 'hoje'
  | '7dias'
  | 'mes_atual'
  | 'mes_anterior'
  | '30dias'
  | 'ano_atual'
  | 'personalizado'

function formatarDataLocal(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function calcularDatas(tipo: PeriodoPredefinido): { inicio: string; fim: string } {
  const hoje = new Date()

  switch (tipo) {
    case 'hoje': {
      const dataStr = formatarDataLocal(hoje)
      return { inicio: dataStr, fim: dataStr }
    }
    case '7dias': {
      const dataInicio = new Date()
      dataInicio.setDate(hoje.getDate() - 6)
      return {
        inicio: formatarDataLocal(dataInicio),
        fim: formatarDataLocal(hoje),
      }
    }
    case 'mes_atual': {
      const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
      return {
        inicio: formatarDataLocal(primeiroDia),
        fim: formatarDataLocal(hoje),
      }
    }
    case 'mes_anterior': {
      const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
      const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth(), 0)
      return {
        inicio: formatarDataLocal(primeiroDia),
        fim: formatarDataLocal(ultimoDia),
      }
    }
    case '30dias': {
      const dataInicio = new Date()
      dataInicio.setDate(hoje.getDate() - 29)
      return {
        inicio: formatarDataLocal(dataInicio),
        fim: formatarDataLocal(hoje),
      }
    }
    case 'ano_atual': {
      const primeiroDia = new Date(hoje.getFullYear(), 0, 1)
      return {
        inicio: formatarDataLocal(primeiroDia),
        fim: formatarDataLocal(hoje),
      }
    }
    case 'personalizado':
    default: {
      const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
      return {
        inicio: formatarDataLocal(primeiroDia),
        fim: formatarDataLocal(hoje),
      }
    }
  }
}

export default function RelatorioLucroPage() {
  const { empresaId } = useEmpresa()

  // Filtros
  const [periodoTipo, setPeriodoTipo] = useState<PeriodoPredefinido>('mes_atual')
  const [dataInicio, setDataInicio] = useState<string>(() => calcularDatas('mes_atual').inicio)
  const [dataFim, setDataFim] = useState<string>(() => calcularDatas('mes_atual').fim)
  const [vendedorFilter, setVendedorFilter] = useState<string>('todos')

  // Lista de vendedores para o dropdown
  const [vendedoresList, setVendedoresList] = useState<VendedorOption[]>([])

  // Dados
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resumo, setResumo] = useState<LucroResumo>({
    faturamento: 0,
    custoProdutos: 0,
    lucroBruto: 0,
    margemPercentual: 0,
    numeroVendas: 0,
    ticketMedio: 0,
  })
  const [porVendedor, setPorVendedor] = useState<LucroPorVendedor[]>([])

  // Carrega lista de vendedores ativos para o filtro
  useEffect(() => {
    if (!empresaId) return
    ComissoesService.listVendedores(empresaId).then(({ data }) => {
      setVendedoresList(data || [])
    })
  }, [empresaId])

  // Ajusta as datas ao trocar a opção predefinida
  const handlePeriodoChange = (novoTipo: PeriodoPredefinido) => {
    setPeriodoTipo(novoTipo)
    if (novoTipo !== 'personalizado') {
      const { inicio, fim } = calcularDatas(novoTipo)
      setDataInicio(inicio)
      setDataFim(fim)
    }
  }

  // Busca dados do relatório
  const carregarRelatorio = useCallback(async () => {
    if (!empresaId) return

    if (!dataInicio || !dataFim) {
      setError('Selecione uma data de início e de fim válidas.')
      return
    }

    if (dataInicio > dataFim) {
      setError('A data inicial não pode ser posterior à data final.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const periodo = { inicio: dataInicio, fim: dataFim }
      const vendIdParam = vendedorFilter === 'todos' ? undefined : vendedorFilter

      const resumoPromise = RelatorioLucroService.getResumo(empresaId, periodo, vendIdParam)
      const porVendedorPromise =
        vendedorFilter === 'todos'
          ? RelatorioLucroService.getPorVendedor(empresaId, periodo)
          : Promise.resolve([])

      const [resumoData, porVendedorData] = await Promise.all([resumoPromise, porVendedorPromise])

      setResumo(resumoData)
      setPorVendedor(porVendedorData)
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar relatório de lucro. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [empresaId, dataInicio, dataFim, vendedorFilter])

  useEffect(() => {
    carregarRelatorio()
  }, [carregarRelatorio])

  const lucroPositivo = resumo.lucroBruto >= 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatório de Lucro"
        description="Análise de rentabilidade com base no custo histórico registrado no momento de cada venda."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={carregarRelatorio}
            disabled={loading}
            className="h-9 gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        }
      />

      {/* Aviso sobre Vendas Antigas sem Custo Histórico */}
      {resumo.custoProdutos === 0 && resumo.faturamento > 0 && !loading && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs text-amber-900 dark:text-amber-200">
          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Aviso:</span> Algumas vendas neste período foram
            registradas antes da implementação do custo histórico e podem exibir custo zerado,
            afetando o cálculo do lucro.
          </div>
        </div>
      )}

      {/* Barra de Filtros */}
      <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-[#1A294A] p-5 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-200/60 dark:border-[#1A294A]">
          <Filter className="h-4 w-4 text-[#0066FF]" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Filtros do Relatório
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Seletor de Período Predefinido */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Período
            </Label>
            <Select
              value={periodoTipo}
              onValueChange={(val) => handlePeriodoChange(val as PeriodoPredefinido)}
            >
              <SelectTrigger className="h-9 text-xs bg-slate-50/70 dark:bg-[#0A1328]/50 border-slate-200 dark:border-[#1A294A] rounded-xl">
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hoje" className="text-xs">
                  Hoje
                </SelectItem>
                <SelectItem value="7dias" className="text-xs">
                  Últimos 7 dias
                </SelectItem>
                <SelectItem value="mes_atual" className="text-xs">
                  Este mês
                </SelectItem>
                <SelectItem value="mes_anterior" className="text-xs">
                  Mês anterior
                </SelectItem>
                <SelectItem value="30dias" className="text-xs">
                  Últimos 30 dias
                </SelectItem>
                <SelectItem value="ano_atual" className="text-xs">
                  Este ano
                </SelectItem>
                <SelectItem value="personalizado" className="text-xs">
                  Personalizado
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Data Inicial */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Data Inicial
            </Label>
            <div className="relative">
              <Input
                type="date"
                className="h-9 text-xs bg-slate-50/70 dark:bg-[#0A1328]/50 border-slate-200 dark:border-[#1A294A] rounded-xl"
                value={dataInicio}
                onChange={(e) => {
                  setDataInicio(e.target.value)
                  setPeriodoTipo('personalizado')
                }}
              />
            </div>
          </div>

          {/* Data Final */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Data Final
            </Label>
            <div className="relative">
              <Input
                type="date"
                className="h-9 text-xs bg-slate-50/70 dark:bg-[#0A1328]/50 border-slate-200 dark:border-[#1A294A] rounded-xl"
                value={dataFim}
                onChange={(e) => {
                  setDataFim(e.target.value)
                  setPeriodoTipo('personalizado')
                }}
              />
            </div>
          </div>

          {/* Vendedor */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Vendedor
            </Label>
            <Select value={vendedorFilter} onValueChange={(val) => setVendedorFilter(val)}>
              <SelectTrigger className="h-9 text-xs bg-slate-50/70 dark:bg-[#0A1328]/50 border-slate-200 dark:border-[#1A294A] rounded-xl">
                <SelectValue placeholder="Todos os vendedores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos" className="text-xs">
                  Todos os vendedores
                </SelectItem>
                {vendedoresList.map((vend) => (
                  <SelectItem key={vend.id} value={vend.id} className="text-xs">
                    {vend.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Estados de Erro */}
      {error && (
        <ErrorState title="Erro ao carregar dados" message={error} onRetry={carregarRelatorio} />
      )}

      {/* KPIs */}
      {!error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard
            title="Faturamento"
            value={loading ? 'Carregando...' : formatCurrency(resumo.faturamento)}
            subtitle="Total de vendas finalizadas"
            icon={DollarSign}
          />

          <MetricCard
            title="Custo dos Produtos"
            value={loading ? 'Carregando...' : formatCurrency(resumo.custoProdutos)}
            subtitle="Custo histórico registrado na venda"
            icon={ShoppingCart}
          />

          <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-[#1A294A] p-5 transition-all">
            <div className="flex flex-row items-center justify-between pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#C0C6CF]">
                Lucro Bruto
              </span>
              <div
                className={`h-9 w-9 rounded-xl flex items-center justify-center ${
                  lucroPositivo
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div
                className={`text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums mt-1 ${
                  loading
                    ? 'text-slate-400'
                    : lucroPositivo
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {loading ? 'Carregando...' : formatCurrency(resumo.lucroBruto)}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                {lucroPositivo ? 'Faturamento - Custo' : 'Resultado negativo'}
              </p>
            </div>
          </div>

          <MetricCard
            title="Margem de Lucro"
            value={loading ? 'Carregando...' : `${resumo.margemPercentual.toFixed(1)}%`}
            subtitle="Lucro bruto sobre faturamento"
            icon={Percent}
          />

          <MetricCard
            title="Número de Vendas"
            value={loading ? 'Carregando...' : String(resumo.numeroVendas)}
            subtitle="Vendas no período"
            icon={Receipt}
          />

          <MetricCard
            title="Ticket Médio"
            value={loading ? 'Carregando...' : formatCurrency(resumo.ticketMedio)}
            subtitle="Faturamento por venda"
            icon={Activity}
          />
        </div>
      )}

      {/* Tabela "Lucro por Vendedor" (Exibida quando filtro é "Todos os vendedores") */}
      {!error && vendedorFilter === 'todos' && (
        <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-[#1A294A] overflow-hidden">
          <div className="pb-3 pt-5 px-6 border-b border-slate-200/80 dark:border-[#1A294A] flex flex-row items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Lucro por Vendedor
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Desempenho e rentabilidade individual de cada vendedor ordenado por maior lucro.
              </p>
            </div>
            {porVendedor.length > 0 && !loading && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0066FF]/10 text-[#0066FF] dark:text-[#3B82F6] border border-[#0066FF]/20">
                {porVendedor.length} {porVendedor.length === 1 ? 'vendedor' : 'vendedores'}
              </span>
            )}
          </div>
          <div>
            {loading ? (
              <div className="p-6">
                <TableSkeleton rows={4} cols={6} />
              </div>
            ) : porVendedor.length === 0 ? (
              <div className="py-12">
                <EmptyState
                  title="Nenhuma venda registrada"
                  description="Nenhuma venda finalizada foi encontrada no período selecionado."
                  icon={Calendar}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 dark:bg-[#0A1328]/80 hover:bg-slate-50/80 border-b border-slate-200/80 dark:border-[#1A294A]">
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs">
                        Vendedor
                      </TableHead>
                      <TableHead className="text-center font-semibold text-slate-700 dark:text-slate-300 text-xs">
                        Vendas
                      </TableHead>
                      <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs">
                        Faturamento
                      </TableHead>
                      <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs">
                        Custo
                      </TableHead>
                      <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs">
                        Lucro
                      </TableHead>
                      <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 text-xs">
                        Margem
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-slate-100 dark:divide-[#1A294A]">
                    {porVendedor.map((item) => {
                      const lucroVendedorPositivo = item.lucro >= 0
                      return (
                        <TableRow
                          key={item.vendedorId}
                          className="hover:bg-slate-50/60 dark:hover:bg-white/[0.03]"
                        >
                          <TableCell className="font-medium text-slate-900 dark:text-white text-xs">
                            {item.nome}
                          </TableCell>
                          <TableCell className="text-center text-xs text-slate-600 dark:text-slate-400">
                            {item.numeroVendas}
                          </TableCell>
                          <TableCell className="text-right font-medium text-slate-800 dark:text-slate-200 text-xs">
                            {formatCurrency(item.faturamento)}
                          </TableCell>
                          <TableCell className="text-right text-slate-600 dark:text-slate-400 text-xs">
                            {formatCurrency(item.custo)}
                          </TableCell>
                          <TableCell
                            className={`text-right font-semibold text-xs ${
                              lucroVendedorPositivo
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {formatCurrency(item.lucro)}
                          </TableCell>
                          <TableCell className="text-right font-medium text-xs text-slate-700 dark:text-slate-300">
                            {item.margem.toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
