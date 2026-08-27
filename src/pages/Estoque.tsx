import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  PageHeader,
  MetricCard,
  TableSkeleton,
  ErrorState,
  EmptyState,
} from '@/components/common/CommonUI'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useEmpresa } from '@/hooks/use-empresa'
import {
  EstoqueService,
  EstoqueIndicadores,
  ProdutoSaldoItem,
  ProdutoParaEntrada,
  FornecedorAtivoItem,
} from '@/services/estoque'
import { toast } from 'sonner'
import {
  Boxes,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  ArrowDownRight,
  ArrowUpRight,
  History,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Calendar,
  X,
} from 'lucide-react'

type StatusFilterSaldo = 'todos' | 'zerados' | 'abaixo_minimo' | 'normal'
type TipoFilterMov = 'todos' | 'entrada' | 'saida'

const PAGE_SIZE = 20

export default function EstoquePage() {
  const { empresaId } = useEmpresa()

  // Tab State
  const [activeTab, setActiveTab] = useState<'saldos' | 'movimentacoes'>('saldos')

  // Indicadores KPI State
  const [indicadores, setIndicadores] = useState<EstoqueIndicadores>({
    total: 0,
    zerados: 0,
    abaixoMinimo: 0,
    normal: 0,
  })
  const [loadingIndicadores, setLoadingIndicadores] = useState(true)

  // Saldos State
  const [saldos, setSaldos] = useState<ProdutoSaldoItem[]>([])
  const [totalSaldosCount, setTotalSaldosCount] = useState(0)
  const [loadingSaldos, setLoadingSaldos] = useState(true)
  const [errorSaldos, setErrorSaldos] = useState<string | null>(null)
  const [searchSaldo, setSearchSaldo] = useState('')
  const [debouncedSearchSaldo, setDebouncedSearchSaldo] = useState('')
  const [statusFilterSaldo, setStatusFilterSaldo] = useState<StatusFilterSaldo>('todos')
  const [pageSaldo, setPageSaldo] = useState(1)

  // Movimentações State
  const [movimentacoes, setMovimentacoes] = useState<any[]>([])
  const [totalMovCount, setTotalMovCount] = useState(0)
  const [loadingMov, setLoadingMov] = useState(true)
  const [errorMov, setErrorMov] = useState<string | null>(null)
  const [searchMov, setSearchMov] = useState('')
  const [debouncedSearchMov, setDebouncedSearchMov] = useState('')
  const [tipoFilterMov, setTipoFilterMov] = useState<TipoFilterMov>('todos')
  const [fornecedorFilterMov, setFornecedorFilterMov] = useState<string>('todos')
  const [listaFornecedores, setListaFornecedores] = useState<FornecedorAtivoItem[]>([])
  const [dataInicioMov, setDataInicioMov] = useState('')
  const [dataFimMov, setDataFimMov] = useState('')
  const [pageMov, setPageMov] = useState(1)

  // Modal Entrada por Fornecedor State
  const [modalEntradaOpen, setModalEntradaOpen] = useState(false)
  const [produtosParaEntrada, setProdutosParaEntrada] = useState<ProdutoParaEntrada[]>([])
  const [fornecedoresParaEntrada, setFornecedoresParaEntrada] = useState<FornecedorAtivoItem[]>([])
  const [loadingModalData, setLoadingModalData] = useState(false)
  const [filtroFornecedorEntrada, setFiltroFornecedorEntrada] = useState('')
  const [filtroProdutoEntrada, setFiltroProdutoEntrada] = useState('')
  const [selectedFornecedorId, setSelectedFornecedorId] = useState('')
  const [selectedProdutoId, setSelectedProdutoId] = useState('')
  const [quantidadeEntrada, setQuantidadeEntrada] = useState('')
  const [precoCustoEntrada, setPrecoCustoEntrada] = useState('')
  const [motivoEntrada, setMotivoEntrada] = useState('Entrada de estoque')
  const [submittingEntrada, setSubmittingEntrada] = useState(false)
  const [entradaErrors, setEntradaErrors] = useState<{
    fornecedor?: string
    produto?: string
    quantidade?: string
    precoCusto?: string
  }>({})

  // Debounce search saldo
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchSaldo(searchSaldo)
      setPageSaldo(1)
    }, 300)
    return () => clearTimeout(handler)
  }, [searchSaldo])

  // Debounce search mov
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchMov(searchMov)
      setPageMov(1)
    }, 300)
    return () => clearTimeout(handler)
  }, [searchMov])

  // Carregar Indicadores
  const loadIndicadores = useCallback(async () => {
    if (!empresaId) return
    setLoadingIndicadores(true)
    try {
      const { data, error } = await EstoqueService.getIndicadores(empresaId)
      if (error) throw error
      if (data) {
        setIndicadores(data)
      }
    } catch {
      // Ignora erro silenciosamente nos KPIs
    } finally {
      setLoadingIndicadores(false)
    }
  }, [empresaId])

  // Carregar Saldos
  const loadSaldos = useCallback(async () => {
    if (!empresaId) return
    setLoadingSaldos(true)
    setErrorSaldos(null)
    try {
      const { data, totalCount, error } = await EstoqueService.listSaldosFiltered(empresaId, {
        search: debouncedSearchSaldo,
        statusFilter: statusFilterSaldo,
        page: pageSaldo,
        pageSize: PAGE_SIZE,
      })
      if (error) throw error
      setSaldos(data || [])
      setTotalSaldosCount(totalCount)
    } catch (e: any) {
      setErrorSaldos(e.message || 'Falha ao carregar saldos de estoque')
    } finally {
      setLoadingSaldos(false)
    }
  }, [empresaId, debouncedSearchSaldo, statusFilterSaldo, pageSaldo])

  // Carregar lista de fornecedores da empresa para filtro do histórico
  const loadFornecedoresFiltro = useCallback(async () => {
    if (!empresaId) return
    try {
      const { data, error } = await EstoqueService.listFornecedoresAtivosParaEntrada(empresaId)
      if (!error && data) {
        setListaFornecedores(data)
      }
    } catch {
      // Falha silenciosa no filtro
    }
  }, [empresaId])

  // Carregar Movimentações
  const loadMovimentacoes = useCallback(async () => {
    if (!empresaId) return
    setLoadingMov(true)
    setErrorMov(null)
    try {
      const { data, totalCount, error } = await EstoqueService.listMovimentacoesFiltered(
        empresaId,
        {
          search: debouncedSearchMov,
          tipo: tipoFilterMov,
          fornecedorId: fornecedorFilterMov,
          dataInicio: dataInicioMov || undefined,
          dataFim: dataFimMov || undefined,
          page: pageMov,
          pageSize: PAGE_SIZE,
        },
      )
      if (error) throw error
      setMovimentacoes(data || [])
      setTotalMovCount(totalCount)
    } catch (e: any) {
      setErrorMov(e.message || 'Falha ao carregar histórico de movimentações')
    } finally {
      setLoadingMov(false)
    }
  }, [
    empresaId,
    debouncedSearchMov,
    tipoFilterMov,
    fornecedorFilterMov,
    dataInicioMov,
    dataFimMov,
    pageMov,
  ])

  // Efeitos de carregamento
  useEffect(() => {
    loadIndicadores()
    loadFornecedoresFiltro()
  }, [loadIndicadores, loadFornecedoresFiltro])

  useEffect(() => {
    if (activeTab === 'saldos') {
      loadSaldos()
    }
  }, [loadSaldos, activeTab])

  useEffect(() => {
    if (activeTab === 'movimentacoes') {
      loadMovimentacoes()
    }
  }, [loadMovimentacoes, activeTab])

  // Carregar lista de produtos e fornecedores ativos para modal de entrada
  const loadModalData = async () => {
    if (!empresaId) return
    setLoadingModalData(true)
    try {
      const [prodRes, fornRes] = await Promise.all([
        EstoqueService.listProdutosAtivosParaEntrada(empresaId),
        EstoqueService.listFornecedoresAtivosParaEntrada(empresaId),
      ])

      if (prodRes.error) throw prodRes.error
      if (fornRes.error) throw fornRes.error

      setProdutosParaEntrada(prodRes.data || [])
      setFornecedoresParaEntrada(fornRes.data || [])
      if (fornRes.data) {
        setListaFornecedores(fornRes.data)
      }
    } catch {
      toast.error('Erro ao carregar dados para entrada de estoque')
    } finally {
      setLoadingModalData(false)
    }
  }

  // Abrir modal de entrada
  const handleOpenModalEntrada = () => {
    setSelectedFornecedorId('')
    setSelectedProdutoId('')
    setQuantidadeEntrada('')
    setPrecoCustoEntrada('')
    setMotivoEntrada('Entrada de estoque')
    setFiltroFornecedorEntrada('')
    setFiltroProdutoEntrada('')
    setEntradaErrors({})
    setModalEntradaOpen(true)
    loadModalData()
  }

  // Ao selecionar um produto, pré-preenche o preço de custo com o valor atual do produto
  const handleSelectProduto = (produtoId: string) => {
    setSelectedProdutoId(produtoId)
    if (entradaErrors.produto) {
      setEntradaErrors((prev) => ({ ...prev, produto: undefined }))
    }
    const prod = produtosParaEntrada.find((p) => p.id === produtoId)
    if (prod && prod.preco_custo !== undefined) {
      setPrecoCustoEntrada(String(prod.preco_custo))
      if (entradaErrors.precoCusto) {
        setEntradaErrors((prev) => ({ ...prev, precoCusto: undefined }))
      }
    }
  }

  // Submeter entrada de estoque por fornecedor via RPC
  const handleSubmitEntrada = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!empresaId) return

    const errors: {
      fornecedor?: string
      produto?: string
      quantidade?: string
      precoCusto?: string
    } = {}

    if (!selectedFornecedorId) {
      errors.fornecedor = 'Selecione um fornecedor.'
    }

    if (!selectedProdutoId) {
      errors.produto = 'Selecione um produto.'
    }

    const qtdNum = parseFloat(quantidadeEntrada.replace(',', '.'))
    if (isNaN(qtdNum) || qtdNum <= 0) {
      errors.quantidade = 'A quantidade deve ser maior que zero.'
    }

    const precoCustoNum = parseFloat(precoCustoEntrada.replace(',', '.'))
    if (isNaN(precoCustoNum) || precoCustoNum < 0) {
      errors.precoCusto = 'O preço de custo não pode ser negativo.'
    }

    if (Object.keys(errors).length > 0) {
      setEntradaErrors(errors)
      return
    }

    setSubmittingEntrada(true)
    try {
      const prodSelected = produtosParaEntrada.find((p) => p.id === selectedProdutoId)
      const motivoFinal = motivoEntrada.trim() || 'Entrada de estoque'

      const { data, error } = await EstoqueService.registrarEntradaPorFornecedor(
        selectedFornecedorId,
        selectedProdutoId,
        qtdNum,
        precoCustoNum,
        motivoFinal,
      )

      if (error) throw error

      // Verificar resposta da RPC
      let resData: any = data
      if (typeof data === 'string') {
        try {
          resData = JSON.parse(data)
        } catch {
          resData = data
        }
      }

      if (resData && typeof resData === 'object' && 'sucesso' in resData) {
        if (resData.sucesso === false) {
          throw new Error(resData.erro || resData.mensagem || 'Falha ao registrar entrada.')
        }
      }

      const nomeProd = resData?.produto_nome || prodSelected?.nome || 'Produto'
      const unProd = prodSelected?.unidade || 'UN'
      const novoEstoque =
        resData?.estoque_atual !== undefined
          ? resData.estoque_atual
          : (prodSelected?.saldoAtual || 0) + qtdNum

      toast.success(
        `Entrada de ${qtdNum} ${unProd} registrada para ${nomeProd}. Novo estoque: ${novoEstoque} ${unProd}.`,
      )

      setModalEntradaOpen(false)
      setSelectedFornecedorId('')
      setSelectedProdutoId('')
      setQuantidadeEntrada('')
      setPrecoCustoEntrada('')
      setMotivoEntrada('Entrada de estoque')

      // Recarrega indicadores e saldos/movimentações
      loadIndicadores()
      if (activeTab === 'saldos') {
        loadSaldos()
      } else {
        loadMovimentacoes()
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao registrar entrada de estoque. Verifique os dados.')
    } finally {
      setSubmittingEntrada(false)
    }
  }

  // Filtrar fornecedores na seleção do modal
  const fornecedoresEntradaFiltrados = useMemo(() => {
    if (!filtroFornecedorEntrada.trim()) return fornecedoresParaEntrada
    const termo = filtroFornecedorEntrada.toLowerCase()
    return fornecedoresParaEntrada.filter((f) => f.nome.toLowerCase().includes(termo))
  }, [fornecedoresParaEntrada, filtroFornecedorEntrada])

  // Filtrar produtos na seleção do modal
  const produtosEntradaFiltrados = useMemo(() => {
    if (!filtroProdutoEntrada.trim()) return produtosParaEntrada
    const termo = filtroProdutoEntrada.toLowerCase()
    return produtosParaEntrada.filter(
      (p) =>
        p.nome.toLowerCase().includes(termo) ||
        (p.codigo && p.codigo.toLowerCase().includes(termo)),
    )
  }, [produtosParaEntrada, filtroProdutoEntrada])

  // Paginação de Saldos
  const totalPagesSaldo = Math.max(1, Math.ceil(totalSaldosCount / PAGE_SIZE))
  const totalPagesMov = Math.max(1, Math.ceil(totalMovCount / PAGE_SIZE))

  // Produto e Fornecedor selecionados no modal de entrada
  const produtoSelecionadoObj = useMemo(() => {
    return produtosParaEntrada.find((p) => p.id === selectedProdutoId)
  }, [produtosParaEntrada, selectedProdutoId])

  const fornecedorSelecionadoObj = useMemo(() => {
    return fornecedoresParaEntrada.find((f) => f.id === selectedFornecedorId)
  }, [fornecedoresParaEntrada, selectedFornecedorId])

  // Cálculo dinâmico para preview de novo estoque
  const parsedQuantidade = parseFloat(quantidadeEntrada.replace(',', '.')) || 0
  const novoEstoqueCalculado =
    produtoSelecionadoObj && !isNaN(parsedQuantidade) && parsedQuantidade > 0
      ? produtoSelecionadoObj.saldoAtual + parsedQuantidade
      : null
  const parsedPrecoCusto = parseFloat(precoCustoEntrada.replace(',', '.'))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Controle de Estoque"
        description="Acompanhamento de posições de saldo, controle de níveis mínimos e histórico de movimentações."
        actions={
          <Button
            onClick={handleOpenModalEntrada}
            className="bg-[#0066FF] hover:bg-[#0052CC] text-white flex items-center gap-1.5 shadow-sm font-medium text-xs h-9 rounded-xl"
          >
            <Plus className="w-4 h-4" /> Nova Entrada
          </Button>
        }
      />

      {/* 2a. Indicadores (KPIs) no topo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {loadingIndicadores ? (
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={`kpi-skeleton-${i}`}
                className="glass-card p-4 rounded-2xl border border-slate-200/80 dark:border-[#1A294A] space-y-2"
              >
                <div className="flex justify-between items-center">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-8 w-8 rounded-lg" />
                </div>
                <Skeleton className="h-7 w-16" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </>
        ) : (
          <>
            <MetricCard
              title="Total em Estoque"
              value={String(indicadores.total)}
              subtitle="Itens ativos cadastrados"
              icon={Boxes}
            />
            <div className="glass-card rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5 transition-all duration-200">
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                  Zerados
                </span>
                <div className="h-9 w-9 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums mt-1">
                {indicadores.zerados}
              </div>
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">
                Saldo zero no momento
              </p>
            </div>

            <div className="glass-card rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 transition-all duration-200">
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Abaixo do Mínimo
                </span>
                <div className="h-9 w-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums mt-1">
                {indicadores.abaixoMinimo}
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">
                Abaixo do estoque seguro
              </p>
            </div>

            <div className="glass-card rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 transition-all duration-200">
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Normal
                </span>
                <div className="h-9 w-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <CheckCircle className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums mt-1">
                {indicadores.normal}
              </div>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
                Estoque acima do mínimo
              </p>
            </div>
          </>
        )}
      </div>

      {/* 2b. Tab Switcher */}
      <div className="flex gap-2 border-b border-slate-200/80 dark:border-[#1A294A]">
        <button
          type="button"
          onClick={() => setActiveTab('saldos')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'saldos'
              ? 'border-[#0066FF] text-[#0066FF] dark:text-[#3B82F6]'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <Boxes className="w-4 h-4" />
          Saldos em Estoque
          <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-[#1A294A] text-slate-700 dark:text-slate-300">
            {totalSaldosCount}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('movimentacoes')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'movimentacoes'
              ? 'border-[#0066FF] text-[#0066FF] dark:text-[#3B82F6]'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <History className="w-4 h-4" />
          Histórico de Movimentações
          <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-[#1A294A] text-slate-700 dark:text-slate-300">
            {totalMovCount}
          </span>
        </button>
      </div>

      {/* 2c. Aba Saldos em Estoque */}
      {activeTab === 'saldos' && (
        <div className="space-y-4">
          {/* Barra de busca e filtros */}
          <div className="glass-card flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between p-4 rounded-2xl border border-slate-200/80 dark:border-[#1A294A]">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <Input
                placeholder="Buscar por nome ou código..."
                value={searchSaldo}
                onChange={(e) => setSearchSaldo(e.target.value)}
                className="pl-9 h-10 bg-slate-50/70 dark:bg-[#0A1328]/50 border-slate-200 dark:border-[#1A294A] text-xs rounded-xl"
              />
              {searchSaldo && (
                <button
                  type="button"
                  onClick={() => setSearchSaldo('')}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="w-full sm:w-56">
              <Select
                value={statusFilterSaldo}
                onValueChange={(val: StatusFilterSaldo) => {
                  setStatusFilterSaldo(val)
                  setPageSaldo(1)
                }}
              >
                <SelectTrigger className="h-10 text-xs bg-slate-50/70 dark:bg-[#0A1328]/50 border-slate-200 dark:border-[#1A294A] rounded-xl">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos" className="text-xs">
                    Todos os Status
                  </SelectItem>
                  <SelectItem value="zerados" className="text-xs text-rose-600 font-medium">
                    Zerados
                  </SelectItem>
                  <SelectItem value="abaixo_minimo" className="text-xs text-amber-600 font-medium">
                    Abaixo do Mínimo
                  </SelectItem>
                  <SelectItem value="normal" className="text-xs text-emerald-600 font-medium">
                    Normal
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tabela de Saldos */}
          {loadingSaldos ? (
            <TableSkeleton rows={5} cols={5} />
          ) : errorSaldos ? (
            <ErrorState message={errorSaldos} onRetry={loadSaldos} />
          ) : saldos.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title={
                debouncedSearchSaldo || statusFilterSaldo !== 'todos'
                  ? 'Nenhum resultado encontrado'
                  : 'Nenhum produto em estoque'
              }
              description={
                debouncedSearchSaldo || statusFilterSaldo !== 'todos'
                  ? 'Nenhum resultado encontrado para os filtros atuais.'
                  : 'Cadastre produtos e registre entradas de estoque para começar.'
              }
              actionLabel={
                debouncedSearchSaldo || statusFilterSaldo !== 'todos' ? undefined : 'Nova Entrada'
              }
              onAction={
                debouncedSearchSaldo || statusFilterSaldo !== 'todos'
                  ? undefined
                  : handleOpenModalEntrada
              }
            />
          ) : (
            <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-[#1A294A] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600 dark:text-[#C0C6CF]">
                  <thead className="bg-slate-50/80 dark:bg-[#0A1328]/80 border-b border-slate-200/80 dark:border-[#1A294A] text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="py-3.5 px-4">Produto</th>
                      <th className="py-3.5 px-4">Unidade</th>
                      <th className="py-3.5 px-4">Estoque Mínimo</th>
                      <th className="py-3.5 px-4">Estoque Atual</th>
                      <th className="py-3.5 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#1A294A]">
                    {saldos.map((item) => {
                      const prod = item.produtos
                      const qtd = Number(item.quantidade) || 0
                      const min = Number(prod?.estoque_minimo) || 0
                      const unidade = prod?.unidade || 'UN'

                      const isZerado = qtd === 0
                      const isAbaixoMinimo = qtd > 0 && qtd <= min
                      const isNormal = qtd > min

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-50/60 dark:hover:bg-white/[0.03] transition-colors"
                        >
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {prod?.nome || 'Produto sem nome'}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {prod?.codigo && (
                                <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                                  #{prod.codigo}
                                </span>
                              )}
                              {prod?.categorias?.nome && (
                                <span className="text-[10px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-[#1A294A] px-1.5 py-0.5 rounded-md">
                                  {prod.categorias.nome}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-medium text-slate-700 dark:text-slate-300">
                            {unidade}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                            {min} {unidade}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white tabular-nums text-sm">
                            {qtd} {unidade}
                          </td>
                          <td className="py-3.5 px-4">
                            {isZerado && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/25">
                                Zerado
                              </span>
                            )}
                            {isAbaixoMinimo && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-500/25">
                                Abaixo do mín.
                              </span>
                            )}
                            {isNormal && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                                Normal
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Paginação Saldos */}
              <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t border-slate-200/80 dark:border-[#1A294A] bg-slate-50/50 dark:bg-[#0A1328]/50 text-xs text-slate-600 dark:text-[#C0C6CF] gap-3">
                <div>
                  Mostrando{' '}
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {Math.min(totalSaldosCount, (pageSaldo - 1) * PAGE_SIZE + 1)}
                  </span>{' '}
                  a{' '}
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {Math.min(totalSaldosCount, pageSaldo * PAGE_SIZE)}
                  </span>{' '}
                  de{' '}
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {totalSaldosCount}
                  </span>{' '}
                  itens
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPageSaldo((p) => Math.max(1, p - 1))}
                    disabled={pageSaldo === 1}
                    className="h-8 px-2.5 text-xs rounded-xl border-slate-200 dark:border-[#1A294A]"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                    Anterior
                  </Button>
                  <span className="px-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                    Página {pageSaldo} de {totalPagesSaldo}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPageSaldo((p) => Math.min(totalPagesSaldo, p + 1))}
                    disabled={pageSaldo >= totalPagesSaldo}
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
      )}

      {/* 2e. Aba Histórico de Movimentações */}
      {activeTab === 'movimentacoes' && (
        <div className="space-y-4">
          {/* Filtros de movimentações */}
          <div className="glass-card flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between p-4 rounded-2xl border border-slate-200/80 dark:border-[#1A294A]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <Input
                placeholder="Buscar produto..."
                value={searchMov}
                onChange={(e) => setSearchMov(e.target.value)}
                className="pl-9 h-10 bg-slate-50/70 dark:bg-[#0A1328]/50 border-slate-200 dark:border-[#1A294A] text-xs rounded-xl"
              />
              {searchMov && (
                <button
                  type="button"
                  onClick={() => setSearchMov('')}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
              <div className="w-full sm:w-36">
                <Select
                  value={tipoFilterMov}
                  onValueChange={(val: TipoFilterMov) => {
                    setTipoFilterMov(val)
                    setPageMov(1)
                  }}
                >
                  <SelectTrigger className="h-10 text-xs bg-slate-50/70 dark:bg-[#0A1328]/50 border-slate-200 dark:border-[#1A294A] rounded-xl">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos" className="text-xs">
                      Todos os Tipos
                    </SelectItem>
                    <SelectItem value="entrada" className="text-xs text-emerald-600 font-medium">
                      Entrada
                    </SelectItem>
                    <SelectItem value="saida" className="text-xs text-amber-600 font-medium">
                      Saída
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro por Fornecedor */}
              <div className="w-full sm:w-48">
                <Select
                  value={fornecedorFilterMov}
                  onValueChange={(val: string) => {
                    setFornecedorFilterMov(val)
                    setPageMov(1)
                  }}
                >
                  <SelectTrigger className="h-10 text-xs bg-slate-50/70 dark:bg-[#0A1328]/50 border-slate-200 dark:border-[#1A294A] rounded-xl">
                    <SelectValue placeholder="Fornecedor" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="todos" className="text-xs">
                      Todos os Fornecedores
                    </SelectItem>
                    {listaFornecedores.map((f) => (
                      <SelectItem key={f.id} value={f.id} className="text-xs">
                        {f.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-36">
                  <Input
                    type="date"
                    value={dataInicioMov}
                    onChange={(e) => {
                      setDataInicioMov(e.target.value)
                      setPageMov(1)
                    }}
                    className="h-10 text-xs bg-slate-50/70 dark:bg-[#0A1328]/50 border-slate-200 dark:border-[#1A294A] rounded-xl"
                    placeholder="Data inicial"
                    title="Data inicial"
                  />
                </div>
                <span className="text-slate-400 text-xs">até</span>
                <div className="relative flex-1 sm:w-36">
                  <Input
                    type="date"
                    value={dataFimMov}
                    onChange={(e) => {
                      setDataFimMov(e.target.value)
                      setPageMov(1)
                    }}
                    className="h-10 text-xs bg-slate-50/70 dark:bg-[#0A1328]/50 border-slate-200 dark:border-[#1A294A] rounded-xl"
                    placeholder="Data final"
                    title="Data final"
                  />
                </div>
              </div>

              {(dataInicioMov || dataFimMov || fornecedorFilterMov !== 'todos') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDataInicioMov('')
                    setDataFimMov('')
                    setFornecedorFilterMov('todos')
                    setPageMov(1)
                  }}
                  className="h-10 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-xl"
                  title="Limpar filtros adicionais"
                >
                  Limpar
                </Button>
              )}
            </div>
          </div>

          {/* Tabela de Movimentações */}
          {loadingMov ? (
            <TableSkeleton rows={5} cols={7} />
          ) : errorMov ? (
            <ErrorState message={errorMov} onRetry={loadMovimentacoes} />
          ) : movimentacoes.length === 0 ? (
            <EmptyState
              icon={History}
              title={
                debouncedSearchMov ||
                tipoFilterMov !== 'todos' ||
                fornecedorFilterMov !== 'todos' ||
                dataInicioMov ||
                dataFimMov
                  ? 'Nenhum resultado encontrado'
                  : 'Nenhuma movimentação registrada'
              }
              description={
                debouncedSearchMov ||
                tipoFilterMov !== 'todos' ||
                fornecedorFilterMov !== 'todos' ||
                dataInicioMov ||
                dataFimMov
                  ? 'Nenhum resultado encontrado para os filtros atuais.'
                  : 'As entradas e saídas aparecerão aqui automaticamente.'
              }
              actionLabel={
                debouncedSearchMov ||
                tipoFilterMov !== 'todos' ||
                fornecedorFilterMov !== 'todos' ||
                dataInicioMov ||
                dataFimMov
                  ? undefined
                  : 'Nova Entrada'
              }
              onAction={
                debouncedSearchMov ||
                tipoFilterMov !== 'todos' ||
                fornecedorFilterMov !== 'todos' ||
                dataInicioMov ||
                dataFimMov
                  ? undefined
                  : handleOpenModalEntrada
              }
            />
          ) : (
            <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-[#1A294A] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600 dark:text-[#C0C6CF]">
                  <thead className="bg-slate-50/80 dark:bg-[#0A1328]/80 border-b border-slate-200/80 dark:border-[#1A294A] text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="py-3.5 px-4">Data / Hora</th>
                      <th className="py-3.5 px-4">Tipo</th>
                      <th className="py-3.5 px-4">Produto</th>
                      <th className="py-3.5 px-4">Fornecedor</th>
                      <th className="py-3.5 px-4">Quantidade</th>
                      <th className="py-3.5 px-4">Motivo</th>
                      <th className="py-3.5 px-4">Usuário</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#1A294A]">
                    {movimentacoes.map((mov) => {
                      const isEntrada = mov.tipo === 'entrada'
                      const dataFormatada = mov.created_at
                        ? new Date(mov.created_at).toLocaleString('pt-BR')
                        : '-'
                      const nomeFornecedor = mov.fornecedores?.nome || '-'

                      return (
                        <tr
                          key={mov.id}
                          className="hover:bg-slate-50/60 dark:hover:bg-white/[0.03] transition-colors"
                        >
                          <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 flex items-center gap-1.5 whitespace-nowrap">
                            <Calendar className="w-3.5 h-3.5 text-[#0066FF]" />
                            {dataFormatada}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                                isEntrada
                                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'
                                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25'
                              }`}
                            >
                              {isEntrada ? (
                                <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <ArrowUpRight className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                              )}
                              <span className="capitalize">{mov.tipo}</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {mov.produtos?.nome || 'Produto'}
                            </span>
                            {mov.produtos?.codigo && (
                              <span className="ml-2 font-mono text-[10px] text-slate-400 dark:text-slate-500">
                                #{mov.produtos.codigo}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {nomeFornecedor}
                          </td>
                          <td
                            className={`py-3.5 px-4 font-bold tabular-nums text-xs whitespace-nowrap ${
                              isEntrada
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {isEntrada ? `+${mov.quantidade}` : `-${mov.quantidade}`}
                          </td>
                          <td
                            className="py-3.5 px-4 text-slate-600 dark:text-slate-400 max-w-xs truncate"
                            title={mov.motivo || ''}
                          >
                            {mov.motivo || '-'}
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {mov.usuarios?.nome || '-'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Paginação Movimentações */}
              <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t border-slate-200/80 dark:border-[#1A294A] bg-slate-50/50 dark:bg-[#0A1328]/50 text-xs text-slate-600 dark:text-[#C0C6CF] gap-3">
                <div>
                  Mostrando{' '}
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {Math.min(totalMovCount, (pageMov - 1) * PAGE_SIZE + 1)}
                  </span>{' '}
                  a{' '}
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {Math.min(totalMovCount, pageMov * PAGE_SIZE)}
                  </span>{' '}
                  de{' '}
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {totalMovCount}
                  </span>{' '}
                  registros
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPageMov((p) => Math.max(1, p - 1))}
                    disabled={pageMov === 1}
                    className="h-8 px-2.5 text-xs rounded-xl border-slate-200 dark:border-[#1A294A]"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                    Anterior
                  </Button>
                  <span className="px-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                    Página {pageMov} de {totalPagesMov}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPageMov((p) => Math.min(totalPagesMov, p + 1))}
                    disabled={pageMov >= totalPagesMov}
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
      )}

      {/* 2d. Modal de Entrada por Fornecedor (Dialog) */}
      <Dialog open={modalEntradaOpen} onOpenChange={setModalEntradaOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Boxes className="w-5 h-5 text-teal-700" />
              Entrada por Fornecedor
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Registre a entrada física de mercadorias vinculadas a um fornecedor ativo e atualize o
              custo unitário.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitEntrada} className="space-y-4 py-2">
            {/* Campo 1: Fornecedor */}
            <div className="space-y-1.5">
              <Label htmlFor="fornecedor-select" className="text-xs font-semibold text-slate-700">
                Fornecedor <span className="text-red-500">*</span>
              </Label>

              {loadingModalData ? (
                <div className="flex items-center gap-2 h-9 px-3 border border-slate-200 rounded-md bg-slate-50 text-xs text-slate-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
                  Carregando fornecedores...
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <Input
                      placeholder="Buscar fornecedor por nome..."
                      value={filtroFornecedorEntrada}
                      onChange={(e) => setFiltroFornecedorEntrada(e.target.value)}
                      className="pl-8 h-8 text-xs bg-slate-50 border-slate-200"
                    />
                  </div>

                  <Select
                    value={selectedFornecedorId}
                    onValueChange={(val) => {
                      setSelectedFornecedorId(val)
                      if (entradaErrors.fornecedor) {
                        setEntradaErrors((prev) => ({ ...prev, fornecedor: undefined }))
                      }
                    }}
                  >
                    <SelectTrigger
                      id="fornecedor-select"
                      className={`h-9 text-xs bg-white ${
                        entradaErrors.fornecedor ? 'border-red-500' : 'border-slate-200'
                      }`}
                    >
                      <SelectValue placeholder="Selecione o fornecedor..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {fornecedoresEntradaFiltrados.length === 0 ? (
                        <div className="p-3 text-xs text-center text-slate-500">
                          Nenhum fornecedor ativo encontrado
                        </div>
                      ) : (
                        fornecedoresEntradaFiltrados.map((f) => (
                          <SelectItem key={f.id} value={f.id} className="text-xs py-2">
                            <span className="font-semibold text-slate-900">{f.nome}</span>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {entradaErrors.fornecedor && (
                <p className="text-[11px] text-red-500">{entradaErrors.fornecedor}</p>
              )}
            </div>

            {/* Campo 2: Produto */}
            <div className="space-y-1.5">
              <Label htmlFor="produto-select" className="text-xs font-semibold text-slate-700">
                Produto <span className="text-red-500">*</span>
              </Label>

              {loadingModalData ? (
                <div className="flex items-center gap-2 h-9 px-3 border border-slate-200 rounded-md bg-slate-50 text-xs text-slate-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
                  Carregando catálogo de produtos...
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <Input
                      placeholder="Filtrar produto por nome ou código..."
                      value={filtroProdutoEntrada}
                      onChange={(e) => setFiltroProdutoEntrada(e.target.value)}
                      className="pl-8 h-8 text-xs bg-slate-50 border-slate-200"
                    />
                  </div>

                  <Select value={selectedProdutoId} onValueChange={handleSelectProduto}>
                    <SelectTrigger
                      id="produto-select"
                      className={`h-9 text-xs bg-white ${
                        entradaErrors.produto ? 'border-red-500' : 'border-slate-200'
                      }`}
                    >
                      <SelectValue placeholder="Selecione o produto..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {produtosEntradaFiltrados.length === 0 ? (
                        <div className="p-3 text-xs text-center text-slate-500">
                          Nenhum produto ativo encontrado
                        </div>
                      ) : (
                        produtosEntradaFiltrados.map((p) => (
                          <SelectItem key={p.id} value={p.id} className="text-xs py-2">
                            <span className="font-semibold text-slate-900">{p.nome}</span>
                            {p.codigo && (
                              <span className="ml-1 text-[11px] text-slate-400 font-mono">
                                ({p.codigo})
                              </span>
                            )}
                            <span className="ml-2 text-slate-500 font-medium">
                              — Saldo: {p.saldoAtual} {p.unidade}
                            </span>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {entradaErrors.produto && (
                <p className="text-[11px] text-red-500">{entradaErrors.produto}</p>
              )}

              {produtoSelecionadoObj && (
                <div className="p-2.5 rounded-lg bg-teal-50/80 border border-teal-100 flex flex-wrap items-center justify-between gap-2 text-xs text-teal-950">
                  <span>
                    Saldo atual:{' '}
                    <strong className="text-teal-900 font-mono">
                      {produtoSelecionadoObj.saldoAtual} {produtoSelecionadoObj.unidade}
                    </strong>
                  </span>
                  <span>
                    Preço de custo atual:{' '}
                    <strong className="text-teal-900 font-mono">
                      R${' '}
                      {produtoSelecionadoObj.preco_custo.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </strong>
                  </span>
                  {novoEstoqueCalculado !== null && (
                    <span className="w-full pt-1 border-t border-teal-200/60 font-semibold text-teal-800">
                      Novo estoque estimado: {novoEstoqueCalculado} {produtoSelecionadoObj.unidade}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Grid com Quantidade e Preço de Custo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Campo 3: Quantidade */}
              <div className="space-y-1.5">
                <Label htmlFor="quantidade" className="text-xs font-semibold text-slate-700">
                  Quantidade <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="quantidade"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={quantidadeEntrada}
                  onChange={(e) => {
                    setQuantidadeEntrada(e.target.value)
                    if (entradaErrors.quantidade) {
                      setEntradaErrors((prev) => ({ ...prev, quantidade: undefined }))
                    }
                  }}
                  placeholder="0,00"
                  className={`h-9 text-xs font-mono ${
                    entradaErrors.quantidade ? 'border-red-500' : ''
                  }`}
                  required
                />
                {entradaErrors.quantidade && (
                  <p className="text-[11px] text-red-500">{entradaErrors.quantidade}</p>
                )}
              </div>

              {/* Campo 4: Preço de Custo Unitário */}
              <div className="space-y-1.5">
                <Label htmlFor="preco-custo" className="text-xs font-semibold text-slate-700">
                  Preço de Custo Unitário (R$) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="preco-custo"
                  type="number"
                  step="0.01"
                  min="0"
                  value={precoCustoEntrada}
                  onChange={(e) => {
                    setPrecoCustoEntrada(e.target.value)
                    if (entradaErrors.precoCusto) {
                      setEntradaErrors((prev) => ({ ...prev, precoCusto: undefined }))
                    }
                  }}
                  placeholder="0,00"
                  className={`h-9 text-xs font-mono ${
                    entradaErrors.precoCusto ? 'border-red-500' : ''
                  }`}
                  required
                />
                {entradaErrors.precoCusto && (
                  <p className="text-[11px] text-red-500">{entradaErrors.precoCusto}</p>
                )}
              </div>
            </div>

            {/* Campo 5: Motivo/Observação */}
            <div className="space-y-1.5">
              <Label htmlFor="motivo" className="text-xs font-semibold text-slate-700">
                Motivo / Observação
              </Label>
              <Input
                id="motivo"
                type="text"
                value={motivoEntrada}
                onChange={(e) => setMotivoEntrada(e.target.value)}
                placeholder="Ex: Entrada de estoque, Nota fiscal 1234..."
                className="h-9 text-xs"
              />
            </div>

            {/* Resumo da Operação */}
            {fornecedorSelecionadoObj && produtoSelecionadoObj && (
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs space-y-1 text-slate-700">
                <div className="font-semibold text-slate-900 mb-1 border-b border-slate-200 pb-1 flex items-center justify-between">
                  <span>Resumo da Entrada</span>
                  <Badge
                    variant="outline"
                    className="bg-teal-50 text-teal-700 border-teal-200 text-[10px]"
                  >
                    Operação Pendente
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                  <div>
                    <span className="text-slate-500">Fornecedor:</span>{' '}
                    <span className="font-medium text-slate-900">
                      {fornecedorSelecionadoObj.nome}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Produto:</span>{' '}
                    <span className="font-medium text-slate-900">{produtoSelecionadoObj.nome}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Quantidade:</span>{' '}
                    <span className="font-medium text-slate-900 font-mono">
                      {parsedQuantidade > 0 ? parsedQuantidade : 0} {produtoSelecionadoObj.unidade}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Custo unitário:</span>{' '}
                    <span className="font-medium text-slate-900 font-mono">
                      R${' '}
                      {!isNaN(parsedPrecoCusto) && parsedPrecoCusto >= 0
                        ? parsedPrecoCusto.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : '0,00'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalEntradaOpen(false)}
                disabled={submittingEntrada}
                className="text-xs h-9"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submittingEntrada}
                className="bg-teal-700 hover:bg-teal-800 text-white text-xs h-9 flex items-center gap-1.5 shadow-xs"
              >
                {submittingEntrada ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Confirmando Entrada...
                  </>
                ) : (
                  'Confirmar Entrada'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
