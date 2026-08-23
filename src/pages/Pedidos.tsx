import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { PageHeader, EmptyState, TableSkeleton, ErrorState } from '@/components/common/CommonUI'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Card, CardContent } from '@/components/ui/card'
import { useEmpresa } from '@/hooks/use-empresa'
import { useAuth } from '@/hooks/use-auth'
import { PedidosService, type CreatePedidoData } from '@/services/pedidos'
import { toast } from 'sonner'
import {
  ClipboardList,
  Plus,
  Search,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Package,
  User,
  Trash2,
  Minus,
  Eye,
  Edit,
  ArrowRightCircle,
  HelpCircle,
  AlertTriangle,
  FileText,
  Percent,
} from 'lucide-react'

interface CartItem {
  produto_id: string
  nome: string
  codigo: string | null
  unidade: string
  preco_unitario: number
  quantidade: number
  desconto: number
  subtotal: number
  estoque_atual: number
}

interface ClienteOption {
  id: string
  nome: string
  documento: string | null
  telefone?: string | null
}

interface VendedorOption {
  id: string
  nome: string
  percentual_comissao: number
}

interface ProdutoOption {
  id: string
  nome: string
  codigo: string | null
  codigo_barras: string | null
  preco_venda: number
  preco_custo: number
  unidade: string
  estoque_minimo: number
  estoques: { quantidade: number }[] | null
}

export default function PedidosPage() {
  const { empresaId } = useEmpresa()
  const { usuario } = useAuth()

  // Permissões
  const perfil = usuario?.perfil?.toLowerCase()
  const podeGerenciar = perfil === 'master' || perfil === 'admin' || perfil === 'gerente'

  // =========================================================================
  // ESTADO DA LISTAGEM
  // =========================================================================
  const [pedidos, setPedidos] = useState<any[]>([])
  const [totalPedidos, setTotalPedidos] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtros
  const [filtroSearch, setFiltroSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [filtroDataInicio, setFiltroDataInicio] = useState<string>('')
  const [filtroDataFim, setFiltroDataFim] = useState<string>('')
  const [pagina, setPagina] = useState(1)
  const limitePorPagina = 20

  // Debounce de busca na listagem (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(filtroSearch)
      setPagina(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [filtroSearch])

  // Carregamento de pedidos
  const loadPedidos = useCallback(async () => {
    if (!empresaId) return
    setLoading(true)
    setError(null)
    try {
      const filters = {
        search: debouncedSearch,
        status: filtroStatus,
        dataInicio: filtroDataInicio,
        dataFim: filtroDataFim,
        pagina,
        limite: limitePorPagina,
      }

      const [dataRes, countRes] = await Promise.all([
        PedidosService.listFiltered(empresaId, filters),
        PedidosService.countFiltered(empresaId, filters),
      ])

      if (dataRes.error) throw dataRes.error
      if (countRes.error) throw countRes.error

      setPedidos(dataRes.data || [])
      setTotalPedidos(countRes.count || 0)
    } catch (e: any) {
      console.error('Erro ao buscar pedidos:', e)
      setError(e.message || 'Falha ao buscar pedidos')
    } finally {
      setLoading(false)
    }
  }, [empresaId, debouncedSearch, filtroStatus, filtroDataInicio, filtroDataFim, pagina])

  useEffect(() => {
    loadPedidos()
  }, [loadPedidos])

  // =========================================================================
  // DADOS DE SUPORTE (Clientes, Vendedores, Produtos)
  // =========================================================================
  const [clientes, setClientes] = useState<ClienteOption[]>([])
  const [vendedores, setVendedores] = useState<VendedorOption[]>([])
  const [produtos, setProdutos] = useState<ProdutoOption[]>([])
  const [loadingProdutos, setLoadingProdutos] = useState(false)

  const [buscaClienteModal, setBuscaClienteModal] = useState('')
  const [buscaVendedorModal, setBuscaVendedorModal] = useState('')
  const [buscaProdutoCatalogo, setBuscaProdutoCatalogo] = useState('')
  const [debouncedBuscaProduto, setDebouncedBuscaProduto] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedBuscaProduto(buscaProdutoCatalogo)
    }, 300)
    return () => clearTimeout(timer)
  }, [buscaProdutoCatalogo])

  const carregarClientes = async () => {
    if (!empresaId) return
    try {
      const { data, error: err } = await PedidosService.listClientesAtivos(empresaId)
      if (err) throw err
      setClientes((data as unknown as ClienteOption[]) || [])
    } catch (e) {
      console.error('Erro ao carregar clientes:', e)
    }
  }

  const carregarVendedores = async () => {
    if (!empresaId) return
    try {
      const { data, error: err } = await PedidosService.listVendedoresAtivos(empresaId)
      if (err) throw err
      setVendedores((data as unknown as VendedorOption[]) || [])
    } catch (e) {
      console.error('Erro ao carregar vendedores:', e)
    }
  }

  const carregarProdutos = async (search?: string) => {
    if (!empresaId) return
    setLoadingProdutos(true)
    try {
      const { data, error: err } = await PedidosService.listProdutosDisponiveis(empresaId, search)
      if (err) throw err
      setProdutos((data as unknown as ProdutoOption[]) || [])
    } catch (e) {
      console.error('Erro ao carregar produtos:', e)
    } finally {
      setLoadingProdutos(false)
    }
  }

  // =========================================================================
  // MODAL: NOVO PEDIDO
  // =========================================================================
  const [modalNovoAberto, setModalNovoAberto] = useState(false)
  const [novoClienteId, setNovoClienteId] = useState<string | null>(null)
  const [novoVendedorId, setNovoVendedorId] = useState<string | null>(null)
  const [novoObservacoes, setNovoObservacoes] = useState('')
  const [carrinho, setCarrinho] = useState<CartItem[]>([])
  const [descontoTotal, setDescontoTotal] = useState<number>(0)
  const [descontoTotalInput, setDescontoTotalInput] = useState<string>('0')
  const [submetendoNovo, setSubmetendoNovo] = useState(false)

  const abrirModalNovo = () => {
    if (!podeGerenciar) {
      toast.error('Você não tem permissão para criar pedidos.')
      return
    }
    setNovoClienteId(null)
    setNovoVendedorId(null)
    setNovoObservacoes('')
    setCarrinho([])
    setDescontoTotal(0)
    setDescontoTotalInput('0')
    setBuscaClienteModal('')
    setBuscaVendedorModal('')
    setBuscaProdutoCatalogo('')
    carregarClientes()
    carregarVendedores()
    carregarProdutos()
    setModalNovoAberto(true)
  }

  useEffect(() => {
    if (modalNovoAberto && empresaId) {
      carregarProdutos(debouncedBuscaProduto)
    }
  }, [modalNovoAberto, debouncedBuscaProduto, empresaId])

  // Manipulação do Carrinho no Novo Pedido
  const adicionarAoCarrinho = (prod: ProdutoOption) => {
    setCarrinho((prev) => {
      const jaExiste = prev.find((item) => item.produto_id === prod.id)
      if (jaExiste) {
        return prev.map((item) =>
          item.produto_id === prod.id
            ? {
                ...item,
                quantidade: item.quantidade + 1,
                subtotal: (item.quantidade + 1) * item.preco_unitario,
              }
            : item,
        )
      }

      const precoUnit = prod.preco_venda || 0
      const estoqueAtual = prod.estoques?.[0]?.quantidade ?? 0
      return [
        ...prev,
        {
          produto_id: prod.id,
          nome: prod.nome,
          codigo: prod.codigo,
          unidade: prod.unidade || 'UN',
          preco_unitario: precoUnit,
          quantidade: 1,
          desconto: 0,
          subtotal: precoUnit,
          estoque_atual: estoqueAtual,
        },
      ]
    })
  }

  const alterarQuantidadeCarrinho = (produtoId: string, delta: number) => {
    setCarrinho((prev) =>
      prev.map((item) => {
        if (item.produto_id === produtoId) {
          const novaQtd = Math.max(1, item.quantidade + delta)
          return {
            ...item,
            quantidade: novaQtd,
            subtotal: novaQtd * item.preco_unitario,
          }
        }
        return item
      }),
    )
  }

  const setQuantidadeItemCarrinho = (produtoId: string, qtd: number) => {
    const val = isNaN(qtd) || qtd <= 0 ? 1 : Math.floor(qtd)
    setCarrinho((prev) =>
      prev.map((item) =>
        item.produto_id === produtoId
          ? {
              ...item,
              quantidade: val,
              subtotal: val * item.preco_unitario,
            }
          : item,
      ),
    )
  }

  const removerDoCarrinho = (produtoId: string) => {
    setCarrinho((prev) => prev.filter((item) => item.produto_id !== produtoId))
  }

  const handleDescontoTotalChange = (val: string) => {
    setDescontoTotalInput(val)
    const num = parseFloat(val.replace(',', '.'))
    if (!isNaN(num) && num >= 0) {
      setDescontoTotal(num)
    } else if (val === '') {
      setDescontoTotal(0)
    }
  }

  const subtotalNovo = useMemo(() => {
    return carrinho.reduce((acc, it) => acc + it.subtotal, 0)
  }, [carrinho])

  const totalNovo = useMemo(() => {
    return Math.max(0, subtotalNovo - (descontoTotal || 0))
  }, [subtotalNovo, descontoTotal])

  // Submissão do Novo Pedido
  const handleSubmitNovoPedido = async () => {
    if (!empresaId) return

    if (carrinho.length === 0) {
      toast.error('Adicione pelo menos um produto ao orçamento/pedido.')
      return
    }

    if (descontoTotal > subtotalNovo) {
      toast.error('O desconto não pode ser maior que o subtotal.')
      return
    }

    setSubmetendoNovo(true)

    try {
      const payload: CreatePedidoData = {
        cliente_id: novoClienteId,
        vendedor_id: novoVendedorId,
        total: totalNovo,
        status: 'pendente',
        observacoes: novoObservacoes.trim() || null,
        itens: carrinho.map((c) => ({
          produto_id: c.produto_id,
          quantidade: c.quantidade,
          preco_unitario: c.preco_unitario,
          desconto: 0,
          subtotal: c.subtotal,
        })),
      }

      const result = await PedidosService.create(empresaId, payload)

      if (result.error) {
        // Se falhou nos itens devido à falta de policy de INSERT em itens_pedido:
        if (result.itensFailed) {
          toast.error(
            'Não foi possível criar o pedido com itens: a política de segurança do banco não permite inserir em itens_pedido. É necessário criar uma RPC no backend para criar pedidos com itens.',
            { duration: 6000 },
          )
          // Realizar cleanup do pedido cabeçalho órfão criado se aplicável
          if (result.data?.id) {
            await PedidosService.delete(empresaId, result.data.id)
          }
          return
        }
        throw result.error
      }

      toast.success('Pedido criado com sucesso!')
      setModalNovoAberto(false)
      loadPedidos()
    } catch (err: any) {
      console.error('Erro ao submeter pedido:', err)
      toast.error(err.message || 'Falha ao criar o pedido.')
    } finally {
      setSubmetendoNovo(false)
    }
  }

  // =========================================================================
  // MODAL: DETALHES DO PEDIDO
  // =========================================================================
  const [modalDetalhesAberto, setModalDetalhesAberto] = useState(false)
  const [pedidoDetalhe, setPedidoDetalhe] = useState<any | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)

  const abrirDetalhes = async (pedidoId: string) => {
    if (!empresaId) return
    setModalDetalhesAberto(true)
    setLoadingDetalhes(true)
    try {
      const { data, error: err } = await PedidosService.getById(empresaId, pedidoId)
      if (err) throw err
      setPedidoDetalhe(data)
    } catch (e: any) {
      console.error('Erro ao carregar detalhes do pedido:', e)
      toast.error('Falha ao carregar os detalhes do pedido.')
      setModalDetalhesAberto(false)
    } finally {
      setLoadingDetalhes(false)
    }
  }

  // =========================================================================
  // MODAL: EDIÇÃO DE PEDIDO (Somente cabeçalho de pedidos 'pendente')
  // =========================================================================
  const [modalEdicaoAberto, setModalEdicaoAberto] = useState(false)
  const [editPedidoId, setEditPedidoId] = useState<string | null>(null)
  const [editNumero, setEditNumero] = useState<number | null>(null)
  const [editClienteId, setEditClienteId] = useState<string | null>(null)
  const [editVendedorId, setEditVendedorId] = useState<string | null>(null)
  const [editObservacoes, setEditObservacoes] = useState<string>('')
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)

  const abrirEdicao = (pedido: any) => {
    if (!podeGerenciar) {
      toast.error('Você não tem permissão para editar pedidos.')
      return
    }
    if (pedido.status !== 'pendente') {
      toast.error('Apenas pedidos com status "pendente" podem ser editados.')
      return
    }
    setEditPedidoId(pedido.id)
    setEditNumero(pedido.numero)
    setEditClienteId(pedido.cliente_id || null)
    setEditVendedorId(pedido.vendedor_id || null)
    setEditObservacoes(pedido.observacoes || '')
    carregarClientes()
    carregarVendedores()
    setModalDetalhesAberto(false)
    setModalEdicaoAberto(true)
  }

  const handleSalvarEdicao = async () => {
    if (!empresaId || !editPedidoId) return
    setSalvandoEdicao(true)
    try {
      const { error: err } = await PedidosService.update(empresaId, editPedidoId, {
        cliente_id: editClienteId,
        vendedor_id: editVendedorId,
        observacoes: editObservacoes.trim() || null,
      })

      if (err) throw err

      toast.success('Pedido atualizado com sucesso!')
      setModalEdicaoAberto(false)
      loadPedidos()
    } catch (err: any) {
      console.error('Erro ao atualizar pedido:', err)
      toast.error(err.message || 'Falha ao salvar alterações do pedido.')
    } finally {
      setSalvandoEdicao(false)
    }
  }

  // =========================================================================
  // AUXILIARES
  // =========================================================================
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusBadge = (status: string) => {
    const s = status?.toLowerCase() || 'pendente'
    switch (s) {
      case 'aprovado':
        return (
          <Badge
            variant="outline"
            className="bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold"
          >
            Aprovado
          </Badge>
        )
      case 'pendente':
        return (
          <Badge
            variant="outline"
            className="bg-amber-50 text-amber-700 border-amber-200 font-semibold"
          >
            Pendente
          </Badge>
        )
      case 'cancelado':
        return (
          <Badge
            variant="outline"
            className="bg-rose-50 text-rose-700 border-rose-200 font-semibold"
          >
            Cancelado
          </Badge>
        )
      case 'convertido':
        return (
          <Badge
            variant="outline"
            className="bg-purple-50 text-purple-700 border-purple-200 font-semibold"
          >
            Convertido
          </Badge>
        )
      default:
        return (
          <Badge
            variant="outline"
            className="bg-slate-100 text-slate-700 border-slate-200 font-semibold uppercase"
          >
            {status}
          </Badge>
        )
    }
  }

  const limparFiltros = () => {
    setFiltroSearch('')
    setDebouncedSearch('')
    setFiltroStatus('todos')
    setFiltroDataInicio('')
    setFiltroDataFim('')
    setPagina(1)
  }

  const temFiltroAtivo =
    debouncedSearch !== '' ||
    filtroStatus !== 'todos' ||
    filtroDataInicio !== '' ||
    filtroDataFim !== ''

  const totalPaginas = Math.ceil(totalPedidos / limitePorPagina) || 1

  // Filtros de seleção dentro dos selects
  const clientesFiltradosModal = useMemo(() => {
    if (!buscaClienteModal.trim()) return clientes
    const t = buscaClienteModal.toLowerCase()
    return clientes.filter(
      (c) => c.nome.toLowerCase().includes(t) || (c.documento && c.documento.includes(t)),
    )
  }, [clientes, buscaClienteModal])

  const vendedoresFiltradosModal = useMemo(() => {
    if (!buscaVendedorModal.trim()) return vendedores
    const t = buscaVendedorModal.toLowerCase()
    return vendedores.filter((v) => v.nome.toLowerCase().includes(t))
  }, [vendedores, buscaVendedorModal])

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* PAGE HEADER */}
        <PageHeader
          title="Gestão de Pedidos & Orçamentos"
          description="Acompanhe orçamentos e pedidos comerciais antes da emissão e faturamento final."
          badge={
            totalPedidos > 0
              ? `${totalPedidos} ${totalPedidos === 1 ? 'pedido' : 'pedidos'}`
              : undefined
          }
          actions={
            podeGerenciar && (
              <Button
                onClick={abrirModalNovo}
                className="bg-teal-700 hover:bg-teal-800 text-white flex items-center gap-1.5 shadow-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Novo Pedido
              </Button>
            )
          }
        />

        {/* BARRA DE FILTROS */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Busca textual */}
            <div className="lg:col-span-2 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Buscar por cliente, nº do pedido ou obs..."
                value={filtroSearch}
                onChange={(e) => setFiltroSearch(e.target.value)}
                className="pl-9 bg-slate-50/50 border-slate-200 focus:bg-white text-xs h-9"
              />
            </div>

            {/* Filtro Status */}
            <div>
              <Select
                value={filtroStatus}
                onValueChange={(val) => {
                  setFiltroStatus(val)
                  setPagina(1)
                }}
              >
                <SelectTrigger className="text-xs h-9 bg-slate-50/50 border-slate-200">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="aprovado">Aprovado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                  <SelectItem value="convertido">Convertido</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Período: De */}
            <div>
              <Input
                type="date"
                value={filtroDataInicio}
                onChange={(e) => {
                  setFiltroDataInicio(e.target.value)
                  setPagina(1)
                }}
                className="text-xs h-9 bg-slate-50/50 border-slate-200"
                title="Data inicial"
              />
            </div>

            {/* Período: Até */}
            <div>
              <Input
                type="date"
                value={filtroDataFim}
                onChange={(e) => {
                  setFiltroDataFim(e.target.value)
                  setPagina(1)
                }}
                className="text-xs h-9 bg-slate-50/50 border-slate-200"
                title="Data final"
              />
            </div>
          </div>

          {temFiltroAtivo && (
            <div className="flex justify-end pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={limparFiltros}
                className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1.5 h-7"
              >
                <RotateCcw className="w-3 h-3" />
                Limpar filtros
              </Button>
            </div>
          )}
        </div>

        {/* TABELA DE PEDIDOS OU ESTADOS */}
        {loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={loadPedidos} />
        ) : pedidos.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={temFiltroAtivo ? 'Nenhum pedido encontrado' : 'Nenhum pedido gerado'}
            description={
              temFiltroAtivo
                ? 'Nenhum pedido corresponde aos filtros informados. Tente ajustar os termos de busca.'
                : 'Crie orçamentos e pré-pedidos de clientes para aprovação comercial e acompanhamento.'
            }
            actionLabel={
              temFiltroAtivo ? 'Limpar Filtros' : podeGerenciar ? '+ Novo Pedido' : undefined
            }
            onAction={temFiltroAtivo ? limparFiltros : podeGerenciar ? abrirModalNovo : undefined}
          />
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-3.5 px-4">Nº Pedido</th>
                    <th className="py-3.5 px-4">Cliente</th>
                    <th className="py-3.5 px-4">Vendedor</th>
                    <th className="py-3.5 px-4">Data</th>
                    <th className="py-3.5 px-4 text-right">Valor Total</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pedidos.map((ped) => {
                    const isPendenteOuAprovado =
                      ped.status === 'pendente' || ped.status === 'aprovado'
                    const isPendente = ped.status === 'pendente'

                    return (
                      <tr
                        key={ped.id}
                        className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                        onClick={() => abrirDetalhes(ped.id)}
                      >
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          #{ped.numero}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {ped.clientes?.nome || (
                            <span className="text-slate-400 font-normal italic">
                              Cliente não informado
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {ped.vendedores?.nome || <span className="text-slate-400">-</span>}
                        </td>
                        <td className="py-3 px-4 text-slate-500">{formatDate(ped.created_at)}</td>
                        <td className="py-3 px-4 font-bold text-slate-900 tabular-nums text-right text-sm">
                          {formatCurrency(ped.total || 0)}
                        </td>
                        <td className="py-3 px-4 text-center">{getStatusBadge(ped.status)}</td>
                        <td
                          className="py-3 px-4 text-right"
                          onClick={
                            (e) => e.stopPropagation() /* não abrir modal ao clicar nas ações */
                          }
                        >
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Botão Visualizar Detalhes */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => abrirDetalhes(ped.id)}
                              className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900"
                              title="Ver Detalhes"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>

                            {/* Botão Editar (Apenas status pendente) */}
                            {podeGerenciar && isPendente && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => abrirEdicao(ped)}
                                className="h-8 w-8 p-0 text-slate-500 hover:text-teal-700"
                                title="Editar Pedido"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            )}

                            {/* Botão Converter em Venda (Desabilitado com Tooltip) */}
                            {isPendenteOuAprovado && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span tabIndex={0} className="inline-block">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled
                                      className="h-8 text-[11px] px-2.5 bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed flex items-center gap-1"
                                    >
                                      <ArrowRightCircle className="w-3.5 h-3.5" />
                                      Converter em Venda
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs text-xs">
                                  <p>Conversão será implementada após criação da RPC no backend</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* PAGINAÇÃO */}
            <div className="py-3 px-4 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
              <div>
                Mostrando{' '}
                <span className="font-semibold text-slate-900">
                  {Math.min((pagina - 1) * limitePorPagina + 1, totalPedidos)}
                </span>{' '}
                a{' '}
                <span className="font-semibold text-slate-900">
                  {Math.min(pagina * limitePorPagina, totalPedidos)}
                </span>{' '}
                de <span className="font-semibold text-slate-900">{totalPedidos}</span> pedidos
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagina <= 1}
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs px-2 font-medium">
                  Página {pagina} de {totalPaginas}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagina >= totalPaginas}
                  onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            MODAL 1: NOVO PEDIDO (UI COMPLETA COM CATÁLOGO E CARRINHO)
            ========================================================================= */}
        <Dialog open={modalNovoAberto} onOpenChange={setModalNovoAberto}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
                <ClipboardList className="w-5 h-5 text-teal-700" />
                Novo Pedido / Orçamento
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Preencha os dados do cliente, vendedor e selecione os produtos para montar o pedido.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-2">
              {/* COLUNA ESQUERDA: CATÁLOGO DE PRODUTOS (7 colunas) */}
              <div className="md:col-span-7 space-y-4">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-teal-700" />
                      <span className="text-xs font-bold text-slate-900">Catálogo de Produtos</span>
                    </div>
                    <div className="w-48 relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <Input
                        placeholder="Buscar produto..."
                        value={buscaProdutoCatalogo}
                        onChange={(e) => setBuscaProdutoCatalogo(e.target.value)}
                        className="pl-8 h-8 text-xs bg-white"
                      />
                    </div>
                  </div>

                  {/* Lista de produtos no catálogo */}
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {loadingProdutos ? (
                      <div className="py-8 text-center text-xs text-slate-400">
                        Carregando produtos...
                      </div>
                    ) : produtos.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400">
                        Nenhum produto ativo encontrado.
                      </div>
                    ) : (
                      produtos.map((prod) => {
                        const estoqueAtual = prod.estoques?.[0]?.quantidade ?? 0
                        const itemNoCarrinho = carrinho.find((c) => c.produto_id === prod.id)

                        return (
                          <div
                            key={prod.id}
                            className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-3 transition-colors ${
                              itemNoCarrinho
                                ? 'bg-teal-50/50 border-teal-200'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 truncate">
                                  {prod.nome}
                                </span>
                                {prod.codigo && (
                                  <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1 py-0.2 rounded shrink-0">
                                    {prod.codigo}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                                <span>Estoque: {estoqueAtual}</span>
                                <span>•</span>
                                <span className="font-semibold text-teal-700">
                                  {formatCurrency(prod.preco_venda || 0)} / {prod.unidade || 'UN'}
                                </span>
                              </div>
                            </div>

                            <div className="shrink-0">
                              {itemNoCarrinho ? (
                                <div className="flex items-center gap-1 bg-white border border-teal-300 rounded p-0.5">
                                  <button
                                    type="button"
                                    onClick={() => alterarQuantidadeCarrinho(prod.id, -1)}
                                    className="w-5 h-5 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <span className="w-6 text-center font-bold text-xs text-teal-900">
                                    {itemNoCarrinho.quantidade}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => alterarQuantidadeCarrinho(prod.id, 1)}
                                    className="w-5 h-5 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => adicionarAoCarrinho(prod)}
                                  className="h-7 text-xs bg-teal-700 hover:bg-teal-800 text-white px-2.5"
                                >
                                  <Plus className="w-3 h-3 mr-1" />
                                  Adicionar
                                </Button>
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* Observações */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Observações do Pedido (opcional)
                  </Label>
                  <Textarea
                    placeholder="Condições comerciais, prazos de entrega, observações gerais..."
                    value={novoObservacoes}
                    onChange={(e) => setNovoObservacoes(e.target.value)}
                    rows={2}
                    className="text-xs resize-none"
                  />
                </div>
              </div>

              {/* COLUNA DIREITA: CLIENTE, VENDEDOR E RESUMO/CARRINHO (5 colunas) */}
              <div className="md:col-span-5 space-y-4">
                {/* Select Cliente */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    Cliente
                  </Label>
                  <Select
                    value={novoClienteId || 'sem_cliente'}
                    onValueChange={(val) => setNovoClienteId(val === 'sem_cliente' ? null : val)}
                  >
                    <SelectTrigger className="text-xs h-9 bg-white border-slate-200">
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      <div className="p-1 border-b border-slate-100">
                        <Input
                          placeholder="Pesquisar cliente..."
                          value={buscaClienteModal}
                          onChange={(e) => setBuscaClienteModal(e.target.value)}
                          className="h-7 text-xs"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                      </div>
                      <SelectItem value="sem_cliente" className="text-xs">
                        Nenhum cliente selecionado
                      </SelectItem>
                      {clientesFiltradosModal.map((cli) => (
                        <SelectItem key={cli.id} value={cli.id} className="text-xs">
                          {cli.nome} {cli.documento ? `(${cli.documento})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Select Vendedor */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <Percent className="w-3.5 h-3.5 text-slate-500" />
                    Vendedor
                  </Label>
                  <Select
                    value={novoVendedorId || 'sem_vendedor'}
                    onValueChange={(val) => setNovoVendedorId(val === 'sem_vendedor' ? null : val)}
                  >
                    <SelectTrigger className="text-xs h-9 bg-white border-slate-200">
                      <SelectValue placeholder="Selecione o vendedor" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      <div className="p-1 border-b border-slate-100">
                        <Input
                          placeholder="Pesquisar vendedor..."
                          value={buscaVendedorModal}
                          onChange={(e) => setBuscaVendedorModal(e.target.value)}
                          className="h-7 text-xs"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                      </div>
                      <SelectItem value="sem_vendedor" className="text-xs">
                        Sem vendedor vinculado
                      </SelectItem>
                      {vendedoresFiltradosModal.map((vend) => (
                        <SelectItem key={vend.id} value={vend.id} className="text-xs">
                          {vend.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Carrinho / Itens */}
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                    <span>Itens do Pedido ({carrinho.length})</span>
                    {carrinho.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setCarrinho([])}
                        className="text-[11px] text-rose-600 hover:underline"
                      >
                        Limpar
                      </button>
                    )}
                  </div>

                  {carrinho.length === 0 ? (
                    <div className="py-6 text-center border border-dashed border-slate-200 rounded-lg bg-slate-50/50 text-xs text-slate-400">
                      Nenhum item adicionado ao pedido
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {carrinho.map((item) => (
                        <div
                          key={item.produto_id}
                          className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100 text-xs"
                        >
                          <div className="flex-1 min-w-0 mr-2">
                            <p className="font-semibold text-slate-900 truncate">{item.nome}</p>
                            <p className="text-[10px] text-slate-500">
                              {formatCurrency(item.preco_unitario)} un.
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              value={item.quantidade}
                              onChange={(e) =>
                                setQuantidadeItemCarrinho(
                                  item.produto_id,
                                  parseInt(e.target.value, 10),
                                )
                              }
                              className="w-10 text-center text-xs font-bold bg-white border border-slate-200 rounded py-0.5"
                            />
                            <span className="font-bold text-slate-900 tabular-nums w-14 text-right">
                              {formatCurrency(item.subtotal)}
                            </span>
                            <button
                              type="button"
                              onClick={() => removerDoCarrinho(item.produto_id)}
                              className="text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Totais & Desconto */}
                <div className="space-y-2 pt-2 border-t border-slate-200 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-semibold text-slate-900 tabular-nums">
                      {formatCurrency(subtotalNovo)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-600">Desconto Total (R$):</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={descontoTotalInput}
                      onChange={(e) => handleDescontoTotalChange(e.target.value)}
                      className="w-24 h-7 text-xs text-right"
                    />
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                    <span className="text-sm font-bold text-slate-900">Total do Pedido:</span>
                    <span className="text-lg font-black text-teal-700 tabular-nums">
                      {formatCurrency(totalNovo)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                type="button"
                disabled={submetendoNovo}
                onClick={() => setModalNovoAberto(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={submetendoNovo || carrinho.length === 0}
                onClick={handleSubmitNovoPedido}
                className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center gap-2"
              >
                {submetendoNovo ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>Salvar Pedido • {formatCurrency(totalNovo)}</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* =========================================================================
            MODAL 2: DETALHES DO PEDIDO
            ========================================================================= */}
        <Dialog open={modalDetalhesAberto} onOpenChange={setModalDetalhesAberto}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-teal-700" />
                  <DialogTitle className="text-base font-bold text-slate-900">
                    Pedido #{pedidoDetalhe?.numero}
                  </DialogTitle>
                </div>
                {pedidoDetalhe?.status && getStatusBadge(pedidoDetalhe.status)}
              </div>
              <DialogDescription className="text-xs text-slate-500">
                Criado em {formatDateTime(pedidoDetalhe?.created_at)}
              </DialogDescription>
            </DialogHeader>

            {loadingDetalhes ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Carregando detalhes do pedido...
              </div>
            ) : pedidoDetalhe ? (
              <div className="space-y-4 text-xs">
                {/* Informações do Cliente & Vendedor */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase block mb-1">
                      Cliente
                    </span>
                    <p className="font-bold text-slate-900 text-sm">
                      {pedidoDetalhe.clientes?.nome || 'Consumidor / Não informado'}
                    </p>
                    {pedidoDetalhe.clientes?.documento && (
                      <p className="text-slate-600">Doc: {pedidoDetalhe.clientes.documento}</p>
                    )}
                    {pedidoDetalhe.clientes?.telefone && (
                      <p className="text-slate-600">Tel: {pedidoDetalhe.clientes.telefone}</p>
                    )}
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase block mb-1">
                      Vendedor Responsável
                    </span>
                    <p className="font-bold text-slate-900 text-sm">
                      {pedidoDetalhe.vendedores?.nome || 'Nenhum vendedor associado'}
                    </p>
                  </div>
                </div>

                {/* Tabela de Itens */}
                <div className="space-y-2">
                  <span className="font-bold text-slate-900 block">Itens do Pedido</span>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Produto</th>
                          <th className="py-2.5 px-3 text-center">Qtd</th>
                          <th className="py-2.5 px-3 text-right">Preço Unit.</th>
                          <th className="py-2.5 px-3 text-right">Desconto</th>
                          <th className="py-2.5 px-3 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {!pedidoDetalhe.itens_pedido || pedidoDetalhe.itens_pedido.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-4 text-center text-slate-400 italic">
                              Nenhum item registrado para este pedido.
                            </td>
                          </tr>
                        ) : (
                          pedidoDetalhe.itens_pedido.map((item: any) => (
                            <tr key={item.id}>
                              <td className="py-2.5 px-3">
                                <p className="font-semibold text-slate-900">
                                  {item.produtos?.nome || 'Produto não identificado'}
                                </p>
                                {item.produtos?.codigo && (
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    Cód: {item.produtos.codigo}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center font-semibold">
                                {item.quantidade} {item.produtos?.unidade || ''}
                              </td>
                              <td className="py-2.5 px-3 text-right tabular-nums">
                                {formatCurrency(item.preco_unitario)}
                              </td>
                              <td className="py-2.5 px-3 text-right tabular-nums text-slate-500">
                                {formatCurrency(item.desconto || 0)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums">
                                {formatCurrency(item.subtotal)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Resumo do Total */}
                <div className="flex justify-end pt-2">
                  <div className="w-64 space-y-1.5 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex justify-between items-center text-slate-900 font-bold text-sm">
                      <span>Total do Pedido:</span>
                      <span className="text-teal-700 font-black">
                        {formatCurrency(pedidoDetalhe.total || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Observações */}
                {pedidoDetalhe.observacoes && (
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="font-semibold text-slate-700 block mb-1">Observações:</span>
                    <p className="text-slate-600 whitespace-pre-wrap">
                      {pedidoDetalhe.observacoes}
                    </p>
                  </div>
                )}
              </div>
            ) : null}

            <DialogFooter className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-2 justify-between items-center">
              <div className="flex items-center gap-2">
                {/* Botão Converter em Venda no modal */}
                {(pedidoDetalhe?.status === 'pendente' || pedidoDetalhe?.status === 'aprovado') && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0} className="inline-block">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled
                          className="text-xs bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed flex items-center gap-1.5"
                        >
                          <ArrowRightCircle className="w-3.5 h-3.5" />
                          Converter em Venda
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">
                      <p>Conversão será implementada após criação da RPC no backend</p>
                    </TooltipContent>
                  </Tooltip>
                )}

                {/* Botão Editar se pendente */}
                {podeGerenciar && pedidoDetalhe?.status === 'pendente' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => abrirEdicao(pedidoDetalhe)}
                    className="text-xs border-teal-300 text-teal-800 hover:bg-teal-50 flex items-center gap-1.5"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    Editar Pedido
                  </Button>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalDetalhesAberto(false)}
                className="text-xs"
              >
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* =========================================================================
            MODAL 3: EDIÇÃO DE PEDIDO (Apenas cabeçalho de pedidos 'pendente')
            ========================================================================= */}
        <Dialog open={modalEdicaoAberto} onOpenChange={setModalEdicaoAberto}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
                <Edit className="w-4 h-4 text-teal-700" />
                Editar Pedido #{editNumero}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Altere os dados de cliente, vendedor ou observações. (Os itens são fixos neste
                pedido).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              {/* Select Cliente */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Cliente</Label>
                <Select
                  value={editClienteId || 'sem_cliente'}
                  onValueChange={(val) => setEditClienteId(val === 'sem_cliente' ? null : val)}
                >
                  <SelectTrigger className="text-xs h-9 bg-white border-slate-200">
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    <SelectItem value="sem_cliente" className="text-xs">
                      Nenhum cliente selecionado
                    </SelectItem>
                    {clientes.map((cli) => (
                      <SelectItem key={cli.id} value={cli.id} className="text-xs">
                        {cli.nome} {cli.documento ? `(${cli.documento})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Select Vendedor */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Vendedor</Label>
                <Select
                  value={editVendedorId || 'sem_vendedor'}
                  onValueChange={(val) => setEditVendedorId(val === 'sem_vendedor' ? null : val)}
                >
                  <SelectTrigger className="text-xs h-9 bg-white border-slate-200">
                    <SelectValue placeholder="Selecione o vendedor" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    <SelectItem value="sem_vendedor" className="text-xs">
                      Sem vendedor vinculado
                    </SelectItem>
                    {vendedores.map((vend) => (
                      <SelectItem key={vend.id} value={vend.id} className="text-xs">
                        {vend.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Observações */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Observações</Label>
                <Textarea
                  placeholder="Informações adicionais..."
                  value={editObservacoes}
                  onChange={(e) => setEditObservacoes(e.target.value)}
                  rows={3}
                  className="text-xs resize-none"
                />
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                type="button"
                disabled={salvandoEdicao}
                onClick={() => setModalEdicaoAberto(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={salvandoEdicao}
                onClick={handleSalvarEdicao}
                className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold"
              >
                {salvandoEdicao ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
