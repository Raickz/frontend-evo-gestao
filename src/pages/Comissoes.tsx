import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  PageHeader,
  EmptyState,
  TableSkeleton,
  ErrorState,
  MetricCard,
} from '@/components/common/CommonUI'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useEmpresa } from '@/hooks/use-empresa'
import { ComissoesService, Comissao, IndicadoresComissoes } from '@/services/comissoes'
import {
  Percent,
  DollarSign,
  Calendar,
  Search,
  Filter,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  UserCheck,
  Receipt,
  FileText,
} from 'lucide-react'

const PAGE_SIZE = 20

export default function ComissoesPage() {
  const { empresaId } = useEmpresa()

  // Estados de dados
  const [comissoes, setComissoes] = useState<Comissao[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [indicadores, setIndicadores] = useState<IndicadoresComissoes>({
    totalComissoes: 0,
    comissoesPendentes: 0,
    comissoesPagas: 0,
    totalVendasComissionadas: 0,
  })
  const [vendedoresList, setVendedoresList] = useState<{ id: string; nome: string }[]>([])

  // Estados de controle
  const [loading, setLoading] = useState(true)
  const [loadingKpis, setLoadingKpis] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtros
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('todos')
  const [vendedorFilter, setVendedorFilter] = useState<string>('todos')
  const [dataInicio, setDataInicio] = useState<string>('')
  const [dataFim, setDataFim] = useState<string>('')
  const [currentPage, setCurrentPage] = useState(1)

  // Formatação de valores BRL
  const formatCurrency = (val: number | null | undefined) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
  }

  // Formatação de percentual
  const formatPercent = (val: number | null | undefined) => {
    const num = Number(val) || 0
    return `${Number(num.toFixed(2))}%`
  }

  // Formatação de data
  const formatDate = (isoString: string | null | undefined) => {
    if (!isoString) return '—'
    try {
      const date = new Date(isoString)
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date)
    } catch {
      return isoString
    }
  }

  // Carrega lista de vendedores para o select dropdown
  const loadVendedores = useCallback(async () => {
    if (!empresaId) return
    try {
      const { data } = await ComissoesService.listVendedores(empresaId)
      setVendedoresList(data || [])
    } catch {
      // Ignora falha de filtro
    }
  }, [empresaId])

  // Carrega Indicadores (KPIs do topo)
  const loadIndicadores = useCallback(async () => {
    if (!empresaId) return
    setLoadingKpis(true)
    try {
      const { data, error: err } = await ComissoesService.getIndicadores(empresaId)
      if (err) throw err
      if (data) {
        setIndicadores(data)
      }
    } catch {
      // Indicadores mantêm zeros padrão se falhar
    } finally {
      setLoadingKpis(false)
    }
  }, [empresaId])

  // Carrega comissões filtradas e paginadas
  const fetchComissoes = useCallback(async () => {
    if (!empresaId) return
    setLoading(true)
    setError(null)
    try {
      const {
        data,
        count,
        error: err,
      } = await ComissoesService.listFiltered(empresaId, {
        termo: search,
        status: statusFilter,
        vendedorId: vendedorFilter,
        dataInicio: dataInicio || undefined,
        dataFim: dataFim || undefined,
        page: currentPage,
        pageSize: PAGE_SIZE,
      })

      if (err) throw err
      setComissoes(data || [])
      setTotalCount(count)
    } catch (e: any) {
      setError(e.message || 'Falha ao buscar comissões')
    } finally {
      setLoading(false)
    }
  }, [empresaId, search, statusFilter, vendedorFilter, dataInicio, dataFim, currentPage])

  // Debounce para busca textual
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchComissoes()
    }, 300)

    return () => clearTimeout(handler)
  }, [fetchComissoes])

  // Inicialização
  useEffect(() => {
    loadVendedores()
    loadIndicadores()
  }, [loadVendedores, loadIndicadores])

  // Reset de filtros
  const handleClearFilters = () => {
    setSearch('')
    setStatusFilter('todos')
    setVendedorFilter('todos')
    setDataInicio('')
    setDataFim('')
    setCurrentPage(1)
  }

  const hasActiveFilters = Boolean(
    search.trim() ||
    statusFilter !== 'todos' ||
    vendedorFilter !== 'todos' ||
    dataInicio ||
    dataFim,
  )

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  // Renderizador de badge de status
  const renderStatusBadge = (status: string) => {
    const s = status?.toLowerCase()
    if (s === 'pago') {
      return (
        <Badge
          variant="outline"
          className="bg-emerald-50 text-emerald-700 border-emerald-200 font-medium"
        >
          Pago
        </Badge>
      )
    }
    if (s === 'pendente') {
      return (
        <Badge
          variant="outline"
          className="bg-amber-50 text-amber-700 border-amber-200 font-medium"
        >
          Pendente
        </Badge>
      )
    }
    if (s === 'cancelado') {
      return (
        <Badge
          variant="outline"
          className="bg-slate-100 text-slate-600 border-slate-300 font-medium"
        >
          Cancelado
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
        {status}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Apuração de Comissões"
        description="Consulta e auditoria de comissões calculadas automaticamente a partir de vendas concluídas."
        badge={`${totalCount} Comissões`}
      />

      {/* 4 KPIs no Topo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Comissões Geradas"
          value={formatCurrency(indicadores.totalComissoes)}
          subtitle="Registros ativos e quitados"
          icon={Percent}
        />
        <MetricCard
          title="Comissões Pendentes"
          value={formatCurrency(indicadores.comissoesPendentes)}
          subtitle="Aguardando liquidação"
          icon={DollarSign}
        />
        <MetricCard
          title="Comissões Pagas"
          value={formatCurrency(indicadores.comissoesPagas)}
          subtitle="Liquidadas no financeiro"
          icon={CheckCircle2}
        />
        <MetricCard
          title="Vendas Comissionadas"
          value={`${indicadores.totalVendasComissionadas}`}
          subtitle="Total de registros apurados"
          icon={Calendar}
        />
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            Filtros de Apuração
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="h-7 px-2 text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Limpar filtros
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Busca por vendedor */}
          <div className="space-y-1 lg:col-span-1">
            <Label className="text-[11px] font-semibold text-slate-600">Busca por Vendedor</Label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <Input
                placeholder="Nome do vendedor..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setCurrentPage(1)
                }}
                className="pl-8 h-8 text-xs bg-slate-50"
              />
            </div>
          </div>

          {/* Filtro Dropdown de Vendedor */}
          <div className="space-y-1 lg:col-span-1">
            <Label className="text-[11px] font-semibold text-slate-600">Vendedor</Label>
            <Select
              value={vendedorFilter}
              onValueChange={(val) => {
                setVendedorFilter(val)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="h-8 text-xs bg-slate-50">
                <SelectValue placeholder="Todos os vendedores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos" className="text-xs">
                  Todos os Vendedores
                </SelectItem>
                {vendedoresList.map((v) => (
                  <SelectItem key={v.id} value={v.id} className="text-xs">
                    {v.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro Status */}
          <div className="space-y-1 lg:col-span-1">
            <Label className="text-[11px] font-semibold text-slate-600">Status</Label>
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="h-8 text-xs bg-slate-50">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos" className="text-xs">
                  Todos os Status
                </SelectItem>
                <SelectItem value="pendente" className="text-xs">
                  Pendentes
                </SelectItem>
                <SelectItem value="pago" className="text-xs">
                  Pagas
                </SelectItem>
                <SelectItem value="cancelado" className="text-xs">
                  Canceladas
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Data Início */}
          <div className="space-y-1 lg:col-span-1">
            <Label className="text-[11px] font-semibold text-slate-600">Período De</Label>
            <Input
              type="date"
              value={dataInicio}
              onChange={(e) => {
                setDataInicio(e.target.value)
                setCurrentPage(1)
              }}
              className="h-8 text-xs bg-slate-50"
            />
          </div>

          {/* Data Fim */}
          <div className="space-y-1 lg:col-span-1">
            <Label className="text-[11px] font-semibold text-slate-600">Até</Label>
            <Input
              type="date"
              value={dataFim}
              onChange={(e) => {
                setDataFim(e.target.value)
                setCurrentPage(1)
              }}
              className="h-8 text-xs bg-slate-50"
            />
          </div>
        </div>
      </div>

      {/* Tabela de Comissões (Somente Leitura) */}
      {loading ? (
        <TableSkeleton rows={6} cols={7} />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchComissoes} />
      ) : comissoes.length === 0 ? (
        <EmptyState
          icon={Percent}
          title={hasActiveFilters ? 'Nenhuma comissão encontrada' : 'Nenhuma comissão apurada'}
          description={
            hasActiveFilters
              ? 'Nenhum registro corresponde aos filtros selecionados. Tente ajustar ou limpar a pesquisa.'
              : 'Quando vendas forem concluídas por vendedores vinculados com percentual definido, as comissões aparecerão aqui automaticamente.'
          }
          actionLabel={hasActiveFilters ? 'Limpar Filtros' : undefined}
          onAction={hasActiveFilters ? handleClearFilters : undefined}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3.5 px-4">Vendedor</th>
                  <th className="py-3.5 px-4">Venda Ref.</th>
                  <th className="py-3.5 px-4">Valor da Venda</th>
                  <th className="py-3.5 px-4">Alíquota (%)</th>
                  <th className="py-3.5 px-4">Valor Comissão</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Data Apuração</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {comissoes.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-[11px]">
                          {c.vendedores?.nome ? c.vendedores.nome.charAt(0).toUpperCase() : 'V'}
                        </div>
                        <span>{c.vendedores?.nome || 'Vendedor não identificado'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {c.vendas?.numero ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                          <Receipt className="w-3 h-3 text-slate-400" />#{c.vendas.numero}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 tabular-nums text-slate-700">
                      {formatCurrency(c.valor_venda)}
                    </td>
                    <td className="py-3 px-4 font-mono text-teal-700 font-bold">
                      {formatPercent(c.percentual)}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 tabular-nums">
                      {formatCurrency(c.valor_comissao)}
                    </td>
                    <td className="py-3 px-4">{renderStatusBadge(c.status)}</td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {formatDate(c.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-600">
            <div>
              Mostrando{' '}
              <span className="font-semibold text-slate-900">
                {Math.min(totalCount, (currentPage - 1) * PAGE_SIZE + 1)}
              </span>{' '}
              a{' '}
              <span className="font-semibold text-slate-900">
                {Math.min(totalCount, currentPage * PAGE_SIZE)}
              </span>{' '}
              de <span className="font-semibold text-slate-900">{totalCount}</span> comissões
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 px-2.5 text-xs"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                Anterior
              </Button>
              <span className="px-2 text-xs font-medium text-slate-700">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="h-8 px-2.5 text-xs"
              >
                Próxima
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
