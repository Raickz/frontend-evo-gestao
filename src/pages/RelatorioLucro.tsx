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
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-100 bg-amber-50/80 p-3.5 text-xs text-amber-900">
          <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Aviso:</span> Algumas vendas neste período foram
            registradas antes da implementação do custo histórico e podem exibir custo zerado,
            afetando o cálculo do lucro.
          </div>
        </div>
      )}

      {/* Barra de Filtros */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 pt-4 px-4 sm:px-6">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-800">
            <Filter className="h-4 w-4 text-slate-500" />
            Filtros do Relatório
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Seletor de Período Predefinido */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600">Período</Label>
              <Select
                value={periodoTipo}
                onValueChange={(val) => handlePeriodoChange(val as PeriodoPredefinido)}
              >
                <SelectTrigger className="h-9 text-xs bg-slate-50">
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
              <Label className="text-xs font-semibold text-slate-600">Data Inicial</Label>
              <div className="relative">
                <Input
                  type="date"
                  className="h-9 text-xs bg-slate-50"
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
              <Label className="text-xs font-semibold text-slate-600">Data Final</Label>
              <div className="relative">
                <Input
                  type="date"
                  className="h-9 text-xs bg-slate-50"
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
              <Label className="text-xs font-semibold text-slate-600">Vendedor</Label>
              <Select value={vendedorFilter} onValueChange={(val) => setVendedorFilter(val)}>
                <SelectTrigger className="h-9 text-xs bg-slate-50">
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
        </CardContent>
      </Card>

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

          <Card className="rounded-xl border border-slate-200 bg-white shadow-xs hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Lucro Bruto
              </CardTitle>
              <div
                className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                  lucroPositivo ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold tracking-tight tabular-nums ${
                  loading ? 'text-slate-400' : lucroPositivo ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {loading ? 'Carregando...' : formatCurrency(resumo.lucroBruto)}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {lucroPositivo ? 'Faturamento - Custo' : 'Resultado negativo'}
              </p>
            </CardContent>
          </Card>

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
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3 pt-5 px-6 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">
                Lucro por Vendedor
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Desempenho e rentabilidade individual de cada vendedor ordenado por maior lucro.
              </p>
            </div>
            {porVendedor.length > 0 && !loading && (
              <Badge variant="secondary" className="font-normal text-xs">
                {porVendedor.length} {porVendedor.length === 1 ? 'vendedor' : 'vendedores'}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="p-0">
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
                    <TableRow className="bg-slate-50/70 hover:bg-slate-50/70">
                      <TableHead className="font-semibold text-slate-700 text-xs">
                        Vendedor
                      </TableHead>
                      <TableHead className="text-center font-semibold text-slate-700 text-xs">
                        Vendas
                      </TableHead>
                      <TableHead className="text-right font-semibold text-slate-700 text-xs">
                        Faturamento
                      </TableHead>
                      <TableHead className="text-right font-semibold text-slate-700 text-xs">
                        Custo
                      </TableHead>
                      <TableHead className="text-right font-semibold text-slate-700 text-xs">
                        Lucro
                      </TableHead>
                      <TableHead className="text-right font-semibold text-slate-700 text-xs">
                        Margem
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {porVendedor.map((item) => {
                      const lucroVendedorPositivo = item.lucro >= 0
                      return (
                        <TableRow key={item.vendedorId} className="hover:bg-slate-50/50">
                          <TableCell className="font-medium text-slate-900 text-xs">
                            {item.nome}
                          </TableCell>
                          <TableCell className="text-center text-xs text-slate-600">
                            {item.numeroVendas}
                          </TableCell>
                          <TableCell className="text-right font-medium text-slate-800 text-xs">
                            {formatCurrency(item.faturamento)}
                          </TableCell>
                          <TableCell className="text-right text-slate-600 text-xs">
                            {formatCurrency(item.custo)}
                          </TableCell>
                          <TableCell
                            className={`text-right font-semibold text-xs ${
                              lucroVendedorPositivo ? 'text-emerald-600' : 'text-red-600'
                            }`}
                          >
                            {formatCurrency(item.lucro)}
                          </TableCell>
                          <TableCell className="text-right font-medium text-xs text-slate-700">
                            {item.margem.toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
