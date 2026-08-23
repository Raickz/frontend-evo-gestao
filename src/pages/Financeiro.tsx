import { useState, useEffect, useCallback } from 'react'
import {
  PageHeader,
  EmptyState,
  TableSkeleton,
  ErrorState,
  MetricCard,
} from '@/components/common/CommonUI'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useEmpresa } from '@/hooks/use-empresa'
import {
  FinanceiroService,
  type ContasReceberItem,
  type ContasPagarItem,
  type FinanceiroIndicadores,
} from '@/services/financeiro'
import {
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Search,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Info,
} from 'lucide-react'

export default function FinanceiroPage() {
  const { empresaId } = useEmpresa()

  // Tab: 'receber' | 'pagar'
  const [activeTab, setActiveTab] = useState<'receber' | 'pagar'>('receber')

  // Indicadores
  const [indicadoresReceber, setIndicadoresReceber] = useState<FinanceiroIndicadores>({
    total: 0,
    recebidoOuPago: 0,
    vencido: 0,
    aVencer: 0,
  })
  const [indicadoresPagar, setIndicadoresPagar] = useState<FinanceiroIndicadores>({
    total: 0,
    recebidoOuPago: 0,
    vencido: 0,
    aVencer: 0,
  })

  // Listas e paginação
  const [contasReceber, setContasReceber] = useState<ContasReceberItem[]>([])
  const [totalContasReceber, setTotalContasReceber] = useState(0)

  const [contasPagar, setContasPagar] = useState<ContasPagarItem[]>([])
  const [totalContasPagar, setTotalContasPagar] = useState(0)

  // Filtros
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20

  // Loading / Erro
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Reset page when tab changes
  const handleTabChange = (tab: 'receber' | 'pagar') => {
    setActiveTab(tab)
    setCurrentPage(1)
  }

  // Limpar filtros
  const limparFiltros = () => {
    setSearch('')
    setDebouncedSearch('')
    setStatusFilter('todos')
    setDataInicio('')
    setDataFim('')
    setCurrentPage(1)
  }

  const temFiltroAtivo =
    debouncedSearch !== '' || statusFilter !== 'todos' || dataInicio !== '' || dataFim !== ''

  // Carregar Indicadores
  const loadIndicadores = useCallback(async () => {
    if (!empresaId) return
    try {
      const [indRec, indPag] = await Promise.all([
        FinanceiroService.getIndicadoresReceber(empresaId),
        FinanceiroService.getIndicadoresPagar(empresaId),
      ])
      setIndicadoresReceber(indRec)
      setIndicadoresPagar(indPag)
    } catch (err) {
      console.error('Erro ao carregar indicadores financeiros:', err)
    }
  }, [empresaId])

  // Carregar Lista da Aba Ativa
  const loadLista = useCallback(async () => {
    if (!empresaId) return
    setLoading(true)
    setError(null)

    const filterOpts = {
      search: debouncedSearch,
      status: statusFilter,
      dataInicio: dataInicio || undefined,
      dataFim: dataFim || undefined,
      page: currentPage,
      pageSize,
    }

    try {
      if (activeTab === 'receber') {
        const [dataRes, countRes] = await Promise.all([
          FinanceiroService.listContasReceberFiltered(empresaId, filterOpts),
          FinanceiroService.countContasReceberFiltered(empresaId, filterOpts),
        ])

        if (dataRes.error) throw dataRes.error
        if (countRes.error) throw countRes.error

        setContasReceber((dataRes.data as unknown as ContasReceberItem[]) || [])
        setTotalContasReceber(countRes.count || 0)
      } else {
        const [dataRes, countRes] = await Promise.all([
          FinanceiroService.listContasPagarFiltered(empresaId, filterOpts),
          FinanceiroService.countContasPagarFiltered(empresaId, filterOpts),
        ])

        if (dataRes.error) throw dataRes.error
        if (countRes.error) throw countRes.error

        setContasPagar((dataRes.data as unknown as ContasPagarItem[]) || [])
        setTotalContasPagar(countRes.count || 0)
      }
    } catch (e: any) {
      console.error('Erro ao buscar lançamentos financeiros:', e)
      setError(e.message || 'Falha ao buscar dados financeiros.')
    } finally {
      setLoading(false)
    }
  }, [empresaId, activeTab, debouncedSearch, statusFilter, dataInicio, dataFim, currentPage])

  useEffect(() => {
    loadIndicadores()
  }, [loadIndicadores])

  useEffect(() => {
    loadLista()
  }, [loadLista])

  // Formatação
  const formatCurrency = (val: number | null | undefined) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-'
    const cleanStr = dateStr.split('T')[0]
    const [year, month, day] = cleanStr.split('-')
    if (!year || !month || !day) return '-'
    return `${day}/${month}/${year}`
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pago':
        return (
          <Badge
            variant="outline"
            className="bg-emerald-50 text-emerald-700 border-emerald-200 font-medium"
          >
            Pago
          </Badge>
        )
      case 'atrasado':
        return (
          <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 font-medium">
            Atrasado
          </Badge>
        )
      case 'cancelado':
        return (
          <Badge
            variant="outline"
            className="bg-slate-100 text-slate-700 border-slate-200 font-medium"
          >
            Cancelado
          </Badge>
        )
      case 'pendente':
      default:
        return (
          <Badge
            variant="outline"
            className="bg-amber-50 text-amber-700 border-amber-200 font-medium"
          >
            Pendente
          </Badge>
        )
    }
  }

  const currentTotal = activeTab === 'receber' ? totalContasReceber : totalContasPagar
  const totalPages = Math.max(1, Math.ceil(currentTotal / pageSize))

  // Indicadores da aba ativa
  const currentIndicadores = activeTab === 'receber' ? indicadoresReceber : indicadoresPagar

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financeiro"
        description="Acompanhamento gerencial de contas a receber de clientes e contas a pagar a fornecedores."
      />

      {/* Info Box Informativo sobre baixas */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 shadow-xs">
        <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed">
          <p className="font-semibold text-amber-950">Módulo em modo de consulta</p>
          <p className="text-amber-800 mt-0.5">
            As baixas de recebimento e pagamento serão implementadas em breve. Por enquanto, os
            lançamentos originados de vendas a prazo (fiado) aparecem automaticamente aqui.
          </p>
        </div>
      </div>

      {/* 4 KPIs dinâmicos conforme a aba ativa */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {activeTab === 'receber' ? (
          <>
            <MetricCard
              title="Total a Receber"
              value={formatCurrency(currentIndicadores.total)}
              subtitle="Soma de títulos ativos"
              icon={TrendingUp}
            />
            <MetricCard
              title="Total Recebido"
              value={formatCurrency(currentIndicadores.recebidoOuPago)}
              subtitle="Valores liquidados"
              icon={CheckCircle2}
            />
            <MetricCard
              title="Vencidos"
              value={formatCurrency(currentIndicadores.vencido)}
              subtitle="Saldo devedor vencido"
              icon={AlertTriangle}
            />
            <MetricCard
              title="A Vencer"
              value={formatCurrency(currentIndicadores.aVencer)}
              subtitle="Saldo com prazo vigente"
              icon={Calendar}
            />
          </>
        ) : (
          <>
            <MetricCard
              title="Total a Pagar"
              value={formatCurrency(currentIndicadores.total)}
              subtitle="Soma de títulos ativos"
              icon={TrendingDown}
            />
            <MetricCard
              title="Total Pago"
              value={formatCurrency(currentIndicadores.recebidoOuPago)}
              subtitle="Valores liquidados"
              icon={CheckCircle2}
            />
            <MetricCard
              title="Vencidos"
              value={formatCurrency(currentIndicadores.vencido)}
              subtitle="Saldo devedor vencido"
              icon={AlertTriangle}
            />
            <MetricCard
              title="A Vencer"
              value={formatCurrency(currentIndicadores.aVencer)}
              subtitle="Saldo com prazo vigente"
              icon={Calendar}
            />
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => handleTabChange('receber')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'receber'
              ? 'border-teal-600 text-teal-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Contas a Receber
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('pagar')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'pagar'
              ? 'border-teal-600 text-teal-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Contas a Pagar
        </button>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Busca por cliente ou fornecedor */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder={
                activeTab === 'receber'
                  ? 'Buscar por cliente ou descrição...'
                  : 'Buscar por fornecedor ou descrição...'
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-slate-50/50 border-slate-200 focus:bg-white text-xs h-9"
            />
          </div>

          {/* Select de Status */}
          <div>
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="text-xs h-9 bg-slate-50/50 border-slate-200">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="atrasado">Atrasado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Botão Limpar Filtros */}
          <div className="flex items-center">
            {temFiltroAtivo ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={limparFiltros}
                className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1.5 h-9 w-full justify-center"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Limpar filtros
              </Button>
            ) : (
              <div className="text-xs text-slate-400 text-center w-full hidden lg:block">
                Filtros desativados
              </div>
            )}
          </div>
        </div>

        {/* Linha 2: Datas de Vencimento */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 whitespace-nowrap">Vencimento de:</span>
            <Input
              type="date"
              value={dataInicio}
              onChange={(e) => {
                setDataInicio(e.target.value)
                setCurrentPage(1)
              }}
              className="text-xs h-8 bg-slate-50/50 border-slate-200"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 whitespace-nowrap">Vencimento até:</span>
            <Input
              type="date"
              value={dataFim}
              onChange={(e) => {
                setDataFim(e.target.value)
                setCurrentPage(1)
              }}
              className="text-xs h-8 bg-slate-50/50 border-slate-200"
            />
          </div>
        </div>
      </div>

      {/* Conteúdo da Tabela */}
      {loading ? (
        <TableSkeleton rows={6} cols={activeTab === 'receber' ? 9 : 8} />
      ) : error ? (
        <ErrorState message={error} onRetry={loadLista} />
      ) : activeTab === 'receber' ? (
        contasReceber.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title={
              temFiltroAtivo
                ? 'Nenhuma conta a receber encontrada'
                : 'Nenhuma conta a receber registrada'
            }
            description={
              temFiltroAtivo
                ? 'Ajuste os filtros de busca ou período de vencimento para visualizar outros títulos.'
                : 'Títulos originados de vendas a prazo (fiado) aparecerão automaticamente nesta lista.'
            }
            actionLabel={temFiltroAtivo ? 'Limpar Filtros' : undefined}
            onAction={temFiltroAtivo ? limparFiltros : undefined}
          />
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-3.5 px-4">Cliente</th>
                    <th className="py-3.5 px-4">Descrição</th>
                    <th className="py-3.5 px-4 text-center">Venda</th>
                    <th className="py-3.5 px-4 text-right">Valor</th>
                    <th className="py-3.5 px-4 text-right">Valor Pago</th>
                    <th className="py-3.5 px-4 text-right">Saldo</th>
                    <th className="py-3.5 px-4">Vencimento</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4">Data Pagto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {contasReceber.map((item) => {
                    const valor = Number(item.valor) || 0
                    const valorPago = Number(item.valor_pago) || 0
                    const saldo = Math.max(0, valor - valorPago)

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          {item.clientes?.nome || (
                            <span className="text-slate-400 font-normal italic">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">{item.descricao}</td>
                        <td className="py-3.5 px-4 text-center">
                          {item.vendas?.numero ? (
                            <span className="font-mono bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-[11px] font-bold">
                              #{item.vendas.numero}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900 tabular-nums text-right">
                          {formatCurrency(valor)}
                        </td>
                        <td className="py-3.5 px-4 tabular-nums text-slate-600 text-right">
                          {formatCurrency(valorPago)}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-amber-800 tabular-nums text-right">
                          {formatCurrency(saldo)}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">
                          {formatDate(item.vencimento)}
                        </td>
                        <td className="py-3.5 px-4 text-center">{getStatusBadge(item.status)}</td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {formatDate(item.data_pagamento)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            <div className="py-3 px-4 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
              <div>
                Mostrando{' '}
                <span className="font-semibold text-slate-900">
                  {Math.min((currentPage - 1) * pageSize + 1, totalContasReceber)}
                </span>{' '}
                a{' '}
                <span className="font-semibold text-slate-900">
                  {Math.min(currentPage * pageSize, totalContasReceber)}
                </span>{' '}
                de <span className="font-semibold text-slate-900">{totalContasReceber}</span>{' '}
                títulos
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs px-2 font-medium">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )
      ) : contasPagar.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title={
            temFiltroAtivo ? 'Nenhuma conta a pagar encontrada' : 'Nenhuma conta a pagar registrada'
          }
          description={
            temFiltroAtivo
              ? 'Ajuste os filtros de busca ou período de vencimento para visualizar outros títulos.'
              : 'Nenhum título a pagar cadastrado no momento.'
          }
          actionLabel={temFiltroAtivo ? 'Limpar Filtros' : undefined}
          onAction={temFiltroAtivo ? limparFiltros : undefined}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3.5 px-4">Fornecedor</th>
                  <th className="py-3.5 px-4">Descrição</th>
                  <th className="py-3.5 px-4 text-right">Valor</th>
                  <th className="py-3.5 px-4 text-right">Valor Pago</th>
                  <th className="py-3.5 px-4 text-right">Saldo</th>
                  <th className="py-3.5 px-4">Vencimento</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4">Data Pagto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contasPagar.map((item) => {
                  const valor = Number(item.valor) || 0
                  const valorPago = Number(item.valor_pago) || 0
                  const saldo = Math.max(0, valor - valorPago)

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {item.fornecedores?.nome || (
                          <span className="text-slate-400 font-normal italic">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">{item.descricao}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 tabular-nums text-right">
                        {formatCurrency(valor)}
                      </td>
                      <td className="py-3.5 px-4 tabular-nums text-slate-600 text-right">
                        {formatCurrency(valorPago)}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-amber-800 tabular-nums text-right">
                        {formatCurrency(saldo)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">{formatDate(item.vencimento)}</td>
                      <td className="py-3.5 px-4 text-center">{getStatusBadge(item.status)}</td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {formatDate(item.data_pagamento)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          <div className="py-3 px-4 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div>
              Mostrando{' '}
              <span className="font-semibold text-slate-900">
                {Math.min((currentPage - 1) * pageSize + 1, totalContasPagar)}
              </span>{' '}
              a{' '}
              <span className="font-semibold text-slate-900">
                {Math.min(currentPage * pageSize, totalContasPagar)}
              </span>{' '}
              de <span className="font-semibold text-slate-900">{totalContasPagar}</span> títulos
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs px-2 font-medium">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
