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
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
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
  const { usuario } = useAuth()

  const isVendedor = usuario?.perfil === 'vendedor'
  const [resolvedVendedorId, setResolvedVendedorId] = useState<string | null>(null)
  const [resolvedVendedorNome, setResolvedVendedorNome] = useState<string | null>(null)

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

  // Resolução de vendedor_id se perfil for vendedor
  useEffect(() => {
    if (!empresaId || !usuario) return

    if (isVendedor) {
      supabase
        .from('vendedores')
        .select('id, nome')
        .eq('empresa_id', empresaId)
        .eq('usuario_id', usuario.id)
        .maybeSingle()
        .then(({ data }) => {
          const vId = data?.id || '00000000-0000-0000-0000-000000000000'
          setResolvedVendedorId(vId)
          setResolvedVendedorNome(data?.nome || usuario.nome || 'Meu Usuário')
          setVendedorFilter(vId)
        })
    } else {
      setResolvedVendedorId(null)
      setResolvedVendedorNome(null)
    }
  }, [empresaId, usuario, isVendedor])

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
    if (isVendedor && resolvedVendedorId === null) return

    setLoadingKpis(true)
    try {
      const vIdForIndicadores = isVendedor ? resolvedVendedorId : undefined
      const { data, error: err } = await ComissoesService.getIndicadores(
        empresaId,
        vIdForIndicadores,
      )
      if (err) throw err
      if (data) {
        setIndicadores(data)
      }
    } catch {
      // Indicadores mantêm zeros padrão se falhar
    } finally {
      setLoadingKpis(false)
    }
  }, [empresaId, isVendedor, resolvedVendedorId])

  // Carrega comissões filtradas e paginadas
  const fetchComissoes = useCallback(async () => {
    if (!empresaId) return
    if (isVendedor && resolvedVendedorId === null) return

    setLoading(true)
    setError(null)
    try {
      const effectiveVendedorFilter = isVendedor ? resolvedVendedorId : vendedorFilter

      const {
        data,
        count,
        error: err,
      } = await ComissoesService.listFiltered(empresaId, {
        termo: search,
        status: statusFilter,
        vendedorId: effectiveVendedorFilter || undefined,
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
  }, [
    empresaId,
    search,
    statusFilter,
    vendedorFilter,
    dataInicio,
    dataFim,
    currentPage,
    isVendedor,
    resolvedVendedorId,
  ])

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
    setVendedorFilter(isVendedor && resolvedVendedorId ? resolvedVendedorId : 'todos')
    setDataInicio('')
    setDataFim('')
    setCurrentPage(1)
  }

  const hasActiveFilters = Boolean(
    search.trim() ||
    statusFilter !== 'todos' ||
    (!isVendedor && vendedorFilter !== 'todos') ||
    dataInicio ||
    dataFim,
  )

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  // Renderizador de badge de status
  const renderStatusBadge = (status: string) => {
    const s = status?.toLowerCase()
    if (s === 'pago') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
          Pago
        </span>
      )
    }
    if (s === 'pendente') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25">
          Pendente
        </span>
      )
    }
    if (s === 'cancelado') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20">
          Cancelado
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20">
        {status}
      </span>
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
          value={indicadores.totalComissoes}
          subtitle="Registros ativos e quitados"
          icon={Percent}
          animate={true}
        />
        <MetricCard
          title="Comissões Pendentes"
          value={indicadores.comissoesPendentes}
          subtitle="Aguardando liquidação"
          icon={DollarSign}
          animate={true}
        />
        <MetricCard
          title="Comissões Pagas"
          value={indicadores.comissoesPagas}
          subtitle="Liquidadas no financeiro"
          icon={CheckCircle2}
          animate={true}
        />
        <MetricCard
          title="Vendas Comissionadas"
          value={indicadores.totalVendasComissionadas}
          subtitle="Total de registros apurados"
          icon={Calendar}
          animate={true}
        />
      </div>

      {/* Barra de Filtros */}
      <div className="glass-card p-4 rounded-2xl border border-slate-200/80 dark:border-[#1A294A] space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-[#1A294A]">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            <Filter className="w-3.5 h-3.5 text-[#0066FF]" />
            Filtros de Apuração
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="h-7 px-2 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Limpar filtros
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Busca por vendedor */}
          <div className="space-y-1 lg:col-span-1">
            <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              Busca por Vendedor
            </Label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <Input
                placeholder="Nome do vendedor..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setCurrentPage(1)
                }}
                className="pl-8 h-9 text-xs bg-slate-50/70 dark:bg-[#0A1328]/50 border-slate-200 dark:border-[#1A294A] rounded-xl"
              />
            </div>
          </div>

          {/* Filtro Dropdown de Vendedor */}
          <div className="space-y-1 lg:col-span-1">
            <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              Vendedor
            </Label>
            <Select
              value={isVendedor ? resolvedVendedorId || 'vendedor_atual' : vendedorFilter}
              onValueChange={(val) => {
                if (!isVendedor) {
                  setVendedorFilter(val)
                  setCurrentPage(1)
                }
              }}
              disabled={isVendedor}
            >
              <SelectTrigger className="h-9 text-xs bg-slate-50/70 dark:bg-[#0A1328]/50 border-slate-200 dark:border-[#1A294A] rounded-xl disabled:opacity-80 disabled:cursor-not-allowed">
                <SelectValue placeholder="Todos os vendedores" />
              </SelectTrigger>
              <SelectContent>
                {isVendedor ? (
                  <SelectItem value={resolvedVendedorId || 'vendedor_atual'} className="text-xs">
                    {resolvedVendedorNome || 'Meu Usuário'}
                  </SelectItem>
                ) : (
                  <>
                    <SelectItem value="todos" className="text-xs">
                      Todos os Vendedores
                    </SelectItem>
                    {vendedoresList.map((v) => (
                      <SelectItem key={v.id} value={v.id} className="text-xs">
                        {v.nome}
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro Status */}
          <div className="space-y-1 lg:col-span-1">
            <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              Status
            </Label>
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="h-9 text-xs bg-slate-50/70 dark:bg-[#0A1328]/50 border-slate-200 dark:border-[#1A294A] rounded-xl">
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
            <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              Período De
            </Label>
            <Input
              type="date"
              value={dataInicio}
              onChange={(e) => {
                setDataInicio(e.target.value)
                setCurrentPage(1)
              }}
              className="h-9 text-xs bg-slate-50/70 dark:bg-[#0A1328]/50 border-slate-200 dark:border-[#1A294A] rounded-xl"
            />
          </div>

          {/* Data Fim */}
          <div className="space-y-1 lg:col-span-1">
            <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              Até
            </Label>
            <Input
              type="date"
              value={dataFim}
              onChange={(e) => {
                setDataFim(e.target.value)
                setCurrentPage(1)
              }}
              className="h-9 text-xs bg-slate-50/70 dark:bg-[#0A1328]/50 border-slate-200 dark:border-[#1A294A] rounded-xl"
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
        <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-[#1A294A] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-[#C0C6CF]">
              <thead className="bg-slate-50/80 dark:bg-[#0A1328]/80 border-b border-slate-200/80 dark:border-[#1A294A] text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
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
              <tbody className="divide-y divide-slate-100 dark:divide-[#1A294A]">
                {comissoes.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#0066FF]/10 text-[#0066FF] dark:text-[#3B82F6] flex items-center justify-center font-bold text-[11px]">
                          {c.vendedores?.nome ? c.vendedores.nome.charAt(0).toUpperCase() : 'V'}
                        </div>
                        <span>{c.vendedores?.nome || 'Vendedor não identificado'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-300">
                      {c.vendas?.numero ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200">
                          <Receipt className="w-3 h-3 text-[#0066FF]" />#{c.vendas.numero}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 tabular-nums text-slate-700 dark:text-slate-300">
                      {formatCurrency(c.valor_venda)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[#0066FF] dark:text-[#3B82F6] font-bold">
                      {formatPercent(c.percentual)}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white tabular-nums">
                      {formatCurrency(c.valor_comissao)}
                    </td>
                    <td className="py-3.5 px-4">{renderStatusBadge(c.status)}</td>
                    <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      {formatDate(c.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200/80 dark:border-[#1A294A] bg-slate-50/50 dark:bg-[#0A1328]/50 text-xs text-slate-600 dark:text-[#C0C6CF]">
            <div>
              Mostrando{' '}
              <span className="font-semibold text-slate-900 dark:text-white">
                {Math.min(totalCount, (currentPage - 1) * PAGE_SIZE + 1)}
              </span>{' '}
              a{' '}
              <span className="font-semibold text-slate-900 dark:text-white">
                {Math.min(totalCount, currentPage * PAGE_SIZE)}
              </span>{' '}
              de <span className="font-semibold text-slate-900 dark:text-white">{totalCount}</span>{' '}
              comissões
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 px-2.5 text-xs rounded-xl border-slate-200 dark:border-[#1A294A]"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                Anterior
              </Button>
              <span className="px-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="h-8 px-2.5 text-xs rounded-xl border-slate-200 dark:border-[#1A294A]"
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
