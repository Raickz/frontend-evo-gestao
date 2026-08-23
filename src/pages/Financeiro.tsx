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
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useEmpresa } from '@/hooks/use-empresa'
import { useAuth } from '@/hooks/use-auth'
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
  Banknote,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

export default function FinanceiroPage() {
  const { empresaId } = useEmpresa()
  const { usuario } = useAuth()

  // Permissão de baixa: apenas master, admin e gerente
  const perfilUsuario = usuario?.perfil?.toLowerCase()
  const podeFazerBaixa =
    perfilUsuario === 'master' || perfilUsuario === 'admin' || perfilUsuario === 'gerente'

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

  // Estados dos Modais de Baixa
  const [modalRecebimentoOpen, setModalRecebimentoOpen] = useState(false)
  const [contaReceberSelecionada, setContaReceberSelecionada] = useState<ContasReceberItem | null>(
    null,
  )
  const [valorRecebimento, setValorRecebimento] = useState('')
  const [dataRecebimento, setDataRecebimento] = useState('')
  const [submittingRecebimento, setSubmittingRecebimento] = useState(false)

  const [modalPagamentoOpen, setModalPagamentoOpen] = useState(false)
  const [contaPagarSelecionada, setContaPagarSelecionada] = useState<ContasPagarItem | null>(null)
  const [valorPagamento, setValorPagamento] = useState('')
  const [dataPagamento, setDataPagamento] = useState('')
  const [submittingPagamento, setSubmittingPagamento] = useState(false)

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

  // Funções de abertura de modais
  const getTodayDateStr = () => new Date().toISOString().split('T')[0]

  const handleOpenRecebimento = (conta: ContasReceberItem) => {
    const valor = Number(conta.valor) || 0
    const valorPago = Number(conta.valor_pago) || 0
    const saldo = Math.max(0, valor - valorPago)

    setContaReceberSelecionada(conta)
    setValorRecebimento(saldo > 0 ? saldo.toFixed(2) : '0.00')
    setDataRecebimento(getTodayDateStr())
    setModalRecebimentoOpen(true)
  }

  const handleOpenPagamento = (conta: ContasPagarItem) => {
    const valor = Number(conta.valor) || 0
    const valorPago = Number(conta.valor_pago) || 0
    const saldo = Math.max(0, valor - valorPago)

    setContaPagarSelecionada(conta)
    setValorPagamento(saldo > 0 ? saldo.toFixed(2) : '0.00')
    setDataPagamento(getTodayDateStr())
    setModalPagamentoOpen(true)
  }

  // Submissão de Recebimento
  const handleConfirmarRecebimento = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!empresaId || !contaReceberSelecionada) return

    const valor = parseFloat(valorRecebimento)
    const saldoRestante = Math.max(
      0,
      (Number(contaReceberSelecionada.valor) || 0) -
        (Number(contaReceberSelecionada.valor_pago) || 0),
    )

    if (isNaN(valor) || valor <= 0) {
      toast.error('O valor recebido deve ser maior que zero.')
      return
    }

    if (valor > saldoRestante + 0.001) {
      toast.error('O valor recebido é maior que o saldo restante.')
      return
    }

    if (!dataRecebimento) {
      toast.error('Informe a data do pagamento.')
      return
    }

    setSubmittingRecebimento(true)
    try {
      const { data, error: rpcError } = await FinanceiroService.registrarRecebimento(
        empresaId,
        contaReceberSelecionada.id,
        valor,
        dataRecebimento,
      )

      if (rpcError) {
        toast.error(rpcError.message || 'Falha ao registrar recebimento.')
        return
      }

      const res = data as any
      const valorRecebidoFmt = formatCurrency(res?.valor_recebido ?? valor)
      const totalPagoFmt = formatCurrency(
        res?.valor_pago ?? (Number(contaReceberSelecionada.valor_pago) || 0) + valor,
      )
      const saldoRestanteFmt = formatCurrency(
        res?.saldo_restante ?? Math.max(0, saldoRestante - valor),
      )
      const statusFmt = res?.status ? res.status.toUpperCase() : 'ATUALIZADO'

      toast.success('Recebimento registrado com sucesso.', {
        description: `Recebido: ${valorRecebidoFmt} | Total Pago: ${totalPagoFmt} | Saldo: ${saldoRestanteFmt} | Status: ${statusFmt}`,
      })

      setModalRecebimentoOpen(false)
      setContaReceberSelecionada(null)
      loadLista()
      loadIndicadores()
    } catch (err: any) {
      console.error('Erro ao registrar recebimento:', err)
      toast.error(err.message || 'Erro inesperado ao registrar recebimento.')
    } finally {
      setSubmittingRecebimento(false)
    }
  }

  // Submissão de Pagamento
  const handleConfirmarPagamento = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!empresaId || !contaPagarSelecionada) return

    const valor = parseFloat(valorPagamento)
    const saldoRestante = Math.max(
      0,
      (Number(contaPagarSelecionada.valor) || 0) - (Number(contaPagarSelecionada.valor_pago) || 0),
    )

    if (isNaN(valor) || valor <= 0) {
      toast.error('O valor do pagamento deve ser maior que zero.')
      return
    }

    if (valor > saldoRestante + 0.001) {
      toast.error('O valor pago é maior que o saldo restante.')
      return
    }

    if (!dataPagamento) {
      toast.error('Informe a data do pagamento.')
      return
    }

    setSubmittingPagamento(true)
    try {
      const { data, error: rpcError } = await FinanceiroService.registrarPagamento(
        empresaId,
        contaPagarSelecionada.id,
        valor,
        dataPagamento,
      )

      if (rpcError) {
        toast.error(rpcError.message || 'Falha ao registrar pagamento.')
        return
      }

      const res = data as any
      const valorPagoFmt = formatCurrency(res?.valor_pago ?? valor)
      const totalPagoFmt = formatCurrency(
        res?.total_pago ?? (Number(contaPagarSelecionada.valor_pago) || 0) + valor,
      )
      const saldoRestanteFmt = formatCurrency(
        res?.saldo_restante ?? Math.max(0, saldoRestante - valor),
      )
      const statusFmt = res?.status ? res.status.toUpperCase() : 'ATUALIZADO'

      toast.success('Pagamento registrado com sucesso.', {
        description: `Pago: ${valorPagoFmt} | Total Pago: ${totalPagoFmt} | Saldo: ${saldoRestanteFmt} | Status: ${statusFmt}`,
      })

      setModalPagamentoOpen(false)
      setContaPagarSelecionada(null)
      loadLista()
      loadIndicadores()
    } catch (err: any) {
      console.error('Erro ao registrar pagamento:', err)
      toast.error(err.message || 'Erro inesperado ao registrar pagamento.')
    } finally {
      setSubmittingPagamento(false)
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
        <TableSkeleton rows={6} cols={activeTab === 'receber' ? 10 : 9} />
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
                    <th className="py-3.5 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {contasReceber.map((item) => {
                    const valor = Number(item.valor) || 0
                    const valorPago = Number(item.valor_pago) || 0
                    const saldo = Math.max(0, valor - valorPago)
                    const podeBaixarLinha =
                      podeFazerBaixa &&
                      saldo > 0 &&
                      item.status !== 'cancelado' &&
                      item.status !== 'pago'

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
                        <td className="py-3.5 px-4 text-right">
                          {podeBaixarLinha ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenRecebimento(item)}
                              className="h-8 px-2.5 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 font-medium inline-flex items-center gap-1.5"
                            >
                              <Banknote className="w-3.5 h-3.5" />
                              <span>Registrar recebimento</span>
                            </Button>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
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
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contasPagar.map((item) => {
                  const valor = Number(item.valor) || 0
                  const valorPago = Number(item.valor_pago) || 0
                  const saldo = Math.max(0, valor - valorPago)
                  const podeBaixarLinha =
                    podeFazerBaixa &&
                    saldo > 0 &&
                    item.status !== 'cancelado' &&
                    item.status !== 'pago'

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
                      <td className="py-3.5 px-4 text-right">
                        {podeBaixarLinha ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenPagamento(item)}
                            className="h-8 px-2.5 text-xs text-blue-700 border-blue-300 hover:bg-blue-50 hover:text-blue-800 font-medium inline-flex items-center gap-1.5"
                          >
                            <Banknote className="w-3.5 h-3.5" />
                            <span>Registrar pagamento</span>
                          </Button>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
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

      {/* Modal de Recebimento */}
      <Dialog
        open={modalRecebimentoOpen}
        onOpenChange={(open) => {
          if (!submittingRecebimento) {
            setModalRecebimentoOpen(open)
            if (!open) setContaReceberSelecionada(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Banknote className="w-5 h-5 text-emerald-600" />
              Registrar Recebimento
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Informe o valor e a data do recebimento do título selecionado.
            </DialogDescription>
          </DialogHeader>

          {contaReceberSelecionada && (
            <form onSubmit={handleConfirmarRecebimento} className="space-y-4 pt-2">
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Cliente:</span>
                  <span className="font-semibold text-slate-900">
                    {contaReceberSelecionada.clientes?.nome || 'Não informado'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Descrição:</span>
                  <span className="text-slate-700 text-right font-medium">
                    {contaReceberSelecionada.descricao}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                  <span className="text-slate-500 font-medium">Valor da conta:</span>
                  <span className="tabular-nums text-slate-700 font-medium">
                    {formatCurrency(Number(contaReceberSelecionada.valor))}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Valor já recebido:</span>
                  <span className="tabular-nums text-slate-600 font-medium">
                    {formatCurrency(Number(contaReceberSelecionada.valor_pago))}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-200/60 bg-emerald-50/50 p-1.5 rounded -mx-1.5">
                  <span className="text-emerald-900 font-bold">Saldo restante:</span>
                  <span className="tabular-nums font-bold text-emerald-700 text-sm">
                    {formatCurrency(
                      Math.max(
                        0,
                        (Number(contaReceberSelecionada.valor) || 0) -
                          (Number(contaReceberSelecionada.valor_pago) || 0),
                      ),
                    )}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="rec-valor" className="text-xs font-semibold text-slate-700">
                    Valor do recebimento (R$) *
                  </Label>
                  <Input
                    id="rec-valor"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={Math.max(
                      0,
                      (Number(contaReceberSelecionada.valor) || 0) -
                        (Number(contaReceberSelecionada.valor_pago) || 0),
                    )}
                    required
                    value={valorRecebimento}
                    onChange={(e) => setValorRecebimento(e.target.value)}
                    disabled={submittingRecebimento}
                    placeholder="0.00"
                    className="text-sm font-semibold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="rec-data" className="text-xs font-semibold text-slate-700">
                    Data do pagamento *
                  </Label>
                  <Input
                    id="rec-data"
                    type="date"
                    required
                    value={dataRecebimento}
                    onChange={(e) => setDataRecebimento(e.target.value)}
                    disabled={submittingRecebimento}
                    className="text-sm"
                  />
                </div>
              </div>

              <DialogFooter className="pt-3 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={submittingRecebimento}
                  onClick={() => setModalRecebimentoOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submittingRecebimento}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2"
                >
                  {submittingRecebimento ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processando...</span>
                    </>
                  ) : (
                    <span>Confirmar recebimento</span>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Pagamento */}
      <Dialog
        open={modalPagamentoOpen}
        onOpenChange={(open) => {
          if (!submittingPagamento) {
            setModalPagamentoOpen(open)
            if (!open) setContaPagarSelecionada(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Banknote className="w-5 h-5 text-blue-600" />
              Registrar Pagamento
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Informe o valor e a data do pagamento do título selecionado.
            </DialogDescription>
          </DialogHeader>

          {contaPagarSelecionada && (
            <form onSubmit={handleConfirmarPagamento} className="space-y-4 pt-2">
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Fornecedor:</span>
                  <span className="font-semibold text-slate-900">
                    {contaPagarSelecionada.fornecedores?.nome || 'Não informado'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Descrição:</span>
                  <span className="text-slate-700 text-right font-medium">
                    {contaPagarSelecionada.descricao}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                  <span className="text-slate-500 font-medium">Valor da conta:</span>
                  <span className="tabular-nums text-slate-700 font-medium">
                    {formatCurrency(Number(contaPagarSelecionada.valor))}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Valor já pago:</span>
                  <span className="tabular-nums text-slate-600 font-medium">
                    {formatCurrency(Number(contaPagarSelecionada.valor_pago))}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-200/60 bg-blue-50/50 p-1.5 rounded -mx-1.5">
                  <span className="text-blue-900 font-bold">Saldo restante:</span>
                  <span className="tabular-nums font-bold text-blue-700 text-sm">
                    {formatCurrency(
                      Math.max(
                        0,
                        (Number(contaPagarSelecionada.valor) || 0) -
                          (Number(contaPagarSelecionada.valor_pago) || 0),
                      ),
                    )}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pag-valor" className="text-xs font-semibold text-slate-700">
                    Valor do pagamento (R$) *
                  </Label>
                  <Input
                    id="pag-valor"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={Math.max(
                      0,
                      (Number(contaPagarSelecionada.valor) || 0) -
                        (Number(contaPagarSelecionada.valor_pago) || 0),
                    )}
                    required
                    value={valorPagamento}
                    onChange={(e) => setValorPagamento(e.target.value)}
                    disabled={submittingPagamento}
                    placeholder="0.00"
                    className="text-sm font-semibold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="pag-data" className="text-xs font-semibold text-slate-700">
                    Data do pagamento *
                  </Label>
                  <Input
                    id="pag-data"
                    type="date"
                    required
                    value={dataPagamento}
                    onChange={(e) => setDataPagamento(e.target.value)}
                    disabled={submittingPagamento}
                    className="text-sm"
                  />
                </div>
              </div>

              <DialogFooter className="pt-3 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={submittingPagamento}
                  onClick={() => setModalPagamentoOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submittingPagamento}
                  className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                >
                  {submittingPagamento ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processando...</span>
                    </>
                  ) : (
                    <span>Confirmar pagamento</span>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
