import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PageHeader,
  EmptyState,
  TableSkeleton,
  ErrorState,
  AnimatedNumber,
} from '@/components/common/CommonUI'
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
import { TooltipProvider } from '@/components/ui/tooltip'
import { Card, CardContent } from '@/components/ui/card'
import { useEmpresa } from '@/hooks/use-empresa'
import { useAuth } from '@/hooks/use-auth'
import { PedidosService } from '@/services/pedidos'
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
  AlertTriangle,
  FileText,
  Percent,
  CheckCircle2,
  Receipt,
  Calendar,
  CreditCard,
  ExternalLink,
  Loader2,
  Printer,
} from 'lucide-react'
import { PrintPreviewDialog } from '@/components/print/PrintPreviewDialog'
import { PedidoPrintDocument } from '@/components/print/PedidoPrintDocument'

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
  const navigate = useNavigate()
  const { empresaId, empresa } = useEmpresa()
  const { usuario } = useAuth()

  // Permissões
  const perfil = usuario?.perfil?.toLowerCase()
  const podeGerenciar = perfil === 'master' || perfil === 'admin' || perfil === 'gerente'

  // =========================================================================
  // ESTADO DA LISTAGEM & MAPA DE VENDAS
  // =========================================================================
  const [pedidos, setPedidos] = useState<any[]>([])
  const [vendasMap, setVendasMap] = useState<Record<string, any>>({})
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

  // Carregamento de pedidos e vendas relacionadas
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

      const listaPedidos = dataRes.data || []
      setPedidos(listaPedidos)
      setTotalPedidos(countRes.count || 0)

      // Coletar IDs dos pedidos com status 'faturado' para buscar vendas relacionadas em lote
      const faturadosIds = listaPedidos
        .filter((p: any) => p.status === 'faturado')
        .map((p: any) => p.id)

      if (faturadosIds.length > 0) {
        try {
          const { data: vendasData, error: vendasErr } = await PedidosService.getVendasPorPedidos(
            empresaId,
            faturadosIds,
          )
          if (vendasErr) {
            if (import.meta.env.DEV) {
              console.error('Erro ao buscar vendas relacionadas:', vendasErr)
            }
          } else if (vendasData) {
            const map: Record<string, any> = {}
            vendasData.forEach((v: any) => {
              if (v.pedido_id) {
                map[v.pedido_id] = v
              }
            })
            setVendasMap(map)
          }
        } catch (vErr) {
          if (import.meta.env.DEV) {
            console.error('Erro ao processar vendas relacionadas:', vErr)
          }
        }
      } else {
        setVendasMap({})
      }
    } catch (e: any) {
      if (import.meta.env.DEV) {
        console.error('Erro ao buscar pedidos:', e)
      }
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
      if (import.meta.env.DEV) {
        console.error('Erro ao carregar clientes:', e)
      }
    }
  }

  const carregarVendedores = async () => {
    if (!empresaId) return
    try {
      const { data, error: err } = await PedidosService.listVendedoresAtivos(empresaId)
      if (err) throw err
      setVendedores((data as unknown as VendedorOption[]) || [])
    } catch (e) {
      if (import.meta.env.DEV) {
        console.error('Erro ao carregar vendedores:', e)
      }
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
      if (import.meta.env.DEV) {
        console.error('Erro ao carregar produtos:', e)
      }
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

    setSubmetendoNovo(true)

    try {
      const payload = {
        cliente_id: novoClienteId,
        vendedor_id: novoVendedorId,
        itens: carrinho.map((c) => ({
          produto_id: c.produto_id,
          quantidade: c.quantidade,
          desconto: 0,
        })),
        observacoes: novoObservacoes.trim() || null,
      }

      const { data: rpcResult, error: rpcErr } = await PedidosService.criarViaRpc(
        empresaId,
        payload,
      )

      if (rpcErr) {
        throw rpcErr
      }

      const res = rpcResult as any
      if (res && res.sucesso === false) {
        throw new Error(res.erro || res.mensagem || 'Falha ao criar pedido.')
      }

      const numPedido = res?.numero || ''
      const totalFormatado = formatCurrency(res?.total || 0)
      const qtdItens = res?.quantidade_itens ?? carrinho.length

      toast.success(
        `Pedido #${numPedido} criado com sucesso. Total: ${totalFormatado}, ${qtdItens} itens.`,
      )
      setModalNovoAberto(false)
      loadPedidos()
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.error('Erro ao submeter pedido:', err)
      }
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
  const [vendaRelacionada, setVendaRelacionada] = useState<any | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)
  const [printPreviewAberto, setPrintPreviewAberto] = useState(false)
  const [showFotosPrint, setShowFotosPrint] = useState(false)

  const abrirDetalhes = async (pedidoId: string) => {
    if (!empresaId) return
    setModalDetalhesAberto(true)
    setLoadingDetalhes(true)
    setVendaRelacionada(null)
    try {
      const [detalhesRes, vendaRes] = await Promise.all([
        PedidosService.getById(empresaId, pedidoId),
        PedidosService.getVendaRelacionada(empresaId, pedidoId),
      ])

      if (detalhesRes.error) throw detalhesRes.error
      setPedidoDetalhe(detalhesRes.data)
      setVendaRelacionada(vendaRes.data || null)
    } catch (e: any) {
      if (import.meta.env.DEV) {
        console.error('Erro ao carregar detalhes do pedido:', e)
      }
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
      if (import.meta.env.DEV) {
        console.error('Erro ao atualizar pedido:', err)
      }
      toast.error(err.message || 'Falha ao salvar alterações do pedido.')
    } finally {
      setSalvandoEdicao(false)
    }
  }

  // =========================================================================
  // MODAL: CONFIRMAÇÃO DE AÇÃO (CONFIRMAR / FATURAR)
  // =========================================================================
  const [modalConfirmarAcaoAberto, setModalConfirmarAcaoAberto] = useState(false)
  const [acaoPedido, setAcaoPedido] = useState<{
    pedido: any
    acao: 'confirmar' | 'faturar'
  } | null>(null)
  const [executandoAcao, setExecutandoAcao] = useState(false)

  const abrirConfirmarPedido = (ped: any) => {
    setAcaoPedido({ pedido: ped, acao: 'confirmar' })
    setModalConfirmarAcaoAberto(true)
  }

  const abrirFaturarPedido = (ped: any) => {
    setAcaoPedido({ pedido: ped, acao: 'faturar' })
    setModalConfirmarAcaoAberto(true)
  }

  const handleExecutarAcao = async () => {
    if (!empresaId || !acaoPedido) return
    setExecutandoAcao(true)
    try {
      const novoStatus = acaoPedido.acao === 'confirmar' ? 'confirmado' : 'faturado'
      const { error: err } = await PedidosService.updateStatus(
        empresaId,
        acaoPedido.pedido.id,
        novoStatus,
      )
      if (err) throw err
      const label = acaoPedido.acao === 'confirmar' ? 'confirmado' : 'faturado'
      toast.success(`Pedido #${acaoPedido.pedido.numero} ${label} com sucesso.`)
      setModalConfirmarAcaoAberto(false)
      loadPedidos()
    } catch (err: any) {
      toast.error(err.message || 'Falha ao atualizar o pedido.')
    } finally {
      setExecutandoAcao(false)
    }
  }

  // =========================================================================
  // MODAL: CONVERTER EM VENDA & CONFIRMAÇÃO
  // =========================================================================
  const [modalConversaoAberto, setModalConversaoAberto] = useState(false)
  const [modalConfirmacaoAberto, setModalConfirmacaoAberto] = useState(false)
  const [pedidoParaConverter, setPedidoParaConverter] = useState<any | null>(null)
  const [formaPagamentoConversao, setFormaPagamentoConversao] = useState<string>('pix')
  const [vencimentoConversao, setVencimentoConversao] = useState<string>('')
  const [convertendo, setConvertendo] = useState(false)

  const abrirModalConversao = (pedido: any) => {
    if (!podeGerenciar) {
      toast.error('Você não tem permissão para converter pedidos em venda.')
      return
    }
    if (pedido.status !== 'faturado') {
      toast.error('Apenas pedidos com status "faturado" podem ser convertidos em venda.')
      return
    }

    setPedidoParaConverter(pedido)
    setFormaPagamentoConversao('pix')
    // Data default para fiado: hoje
    const hojeStr = new Date().toISOString().split('T')[0]
    setVencimentoConversao(hojeStr)
    setModalConversaoAberto(true)
  }

  const validarEAvancarConfirmacao = () => {
    if (!pedidoParaConverter?.id) {
      toast.error('Pedido inválido para conversão.')
      return
    }

    const formasValidas = ['pix', 'dinheiro', 'cartao', 'fiado']
    if (!formasValidas.includes(formaPagamentoConversao)) {
      toast.error('Selecione uma forma de pagamento válida.')
      return
    }

    if (formaPagamentoConversao === 'fiado') {
      if (!vencimentoConversao) {
        toast.error('Data de vencimento é obrigatória para pagamento Fiado.')
        return
      }

      const hoje = new Date()
      hoje.setHours(0, 0, 0, 0)
      const [y, m, d] = vencimentoConversao.split('-').map(Number)
      const dataVenc = new Date(y, m - 1, d)
      dataVenc.setHours(0, 0, 0, 0)

      if (dataVenc < hoje) {
        toast.error('A data de vencimento para venda fiado deve ser hoje ou uma data futura.')
        return
      }
    }

    setModalConfirmacaoAberto(true)
  }

  const handleExecutarConversao = async () => {
    if (!pedidoParaConverter?.id) return
    setConvertendo(true)
    try {
      const { data, error: errRpc } = await PedidosService.converterEmVenda(
        pedidoParaConverter.id,
        formaPagamentoConversao,
        formaPagamentoConversao === 'fiado' ? vencimentoConversao : null,
      )

      if (errRpc) {
        throw errRpc
      }

      const res = data as any
      if (res && res.sucesso === false) {
        throw new Error(res.erro || res.mensagem || 'Falha ao converter pedido em venda.')
      }

      const numPedido = res?.numero_pedido || pedidoParaConverter.numero || ''
      const numVenda = res?.numero_venda ? `#${res.numero_venda}` : ''

      toast.success(`Pedido #${numPedido} convertido na Venda ${numVenda} com sucesso.`)

      setModalConfirmacaoAberto(false)
      setModalConversaoAberto(false)
      setModalDetalhesAberto(false)
      setPedidoParaConverter(null)

      // Recarregar pedidos mantendo filtros atuais
      loadPedidos()
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.error('Erro na conversão em venda:', err)
      }
      const msg = err.message || err.details || 'Erro ao converter pedido em venda.'
      toast.error(msg)
      setModalConfirmacaoAberto(false)
    } finally {
      setConvertendo(false)
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
      case 'confirmado':
        return (
          <Badge
            variant="outline"
            className="bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold"
          >
            Confirmado
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
      case 'faturado':
        return (
          <Badge
            variant="outline"
            className="bg-purple-50 text-purple-700 border-purple-200 font-semibold"
          >
            Faturado
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
        {/* =========================================================================
            MODAL DE IMPRESSÃO DO PEDIDO
            ========================================================================= */}
        {pedidoDetalhe && (
          <PrintPreviewDialog
            open={printPreviewAberto}
            onOpenChange={setPrintPreviewAberto}
            title={`Impressão - Pedido #${pedidoDetalhe.numero}`}
            showPhotos={showFotosPrint}
            onShowPhotosChange={setShowFotosPrint}
          >
            <PedidoPrintDocument
              empresa={{
                nome: empresa?.nome || 'EVO Gestão Comercial',
                nome_fantasia: empresa?.nome_fantasia,
                cnpj: empresa?.cnpj,
                telefone: empresa?.telefone,
                email: empresa?.email,
                logo_url: empresa?.logo_url,
              }}
              pedido={pedidoDetalhe}
              vendaRelacionada={vendaRelacionada}
              showPhotos={showFotosPrint}
            />
          </PrintPreviewDialog>
        )}

        {/* =========================================================================
            PAGE HEADER
            ========================================================================= */}
        <PageHeader
          title="Gestão de Pedidos & Orçamentos"
          description="Acompanhe orçamentos e pedidos comerciais antes da emissão e faturamento final."
          badge={
            totalPedidos > 0 ? (
              <span>
                <AnimatedNumber value={totalPedidos} /> {totalPedidos === 1 ? 'pedido' : 'pedidos'}
              </span>
            ) : undefined
          }
          actions={
            podeGerenciar && (
              <Button
                onClick={abrirModalNovo}
                className="bg-[#0066FF] hover:bg-[#0052CC] text-white flex items-center gap-1.5 shadow-sm font-medium rounded-xl"
              >
                <Plus className="w-4 h-4" />
                Novo Pedido
              </Button>
            )
          }
        />

        {/* BARRA DE FILTROS */}
        <div className="glass-card p-4 rounded-2xl border border-slate-200/80 dark:border-[#1A294A] space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Busca textual */}
            <div className="lg:col-span-2 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Buscar por cliente, nº do pedido ou obs..."
                value={filtroSearch}
                onChange={(e) => setFiltroSearch(e.target.value)}
                className="pl-9 bg-slate-50/70 dark:bg-[#0A1328]/50 border-slate-200 dark:border-[#1A294A] focus:bg-white dark:focus:bg-[#0A1328] text-xs h-9 rounded-xl"
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
                <SelectTrigger className="text-xs h-9 bg-slate-50/70 dark:bg-[#0A1328]/50 border-slate-200 dark:border-[#1A294A] rounded-xl">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="confirmado">Confirmado</SelectItem>
                  <SelectItem value="faturado">Faturado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
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
                className="text-xs h-9 bg-slate-50/70 dark:bg-[#0A1328]/50 border-slate-200 dark:border-[#1A294A] rounded-xl"
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
                className="text-xs h-9 bg-slate-50/70 dark:bg-[#0A1328]/50 border-slate-200 dark:border-[#1A294A] rounded-xl"
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
                className="text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 h-7 rounded-lg"
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
              temFiltroAtivo ? 'Limpar Filtros' : podeGerenciar ? 'Novo Pedido' : undefined
            }
            onAction={temFiltroAtivo ? limparFiltros : podeGerenciar ? abrirModalNovo : undefined}
          />
        ) : (
          <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-[#1A294A] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 dark:text-[#C0C6CF]">
                <thead className="bg-slate-50/80 dark:bg-[#0A1328]/80 border-b border-slate-200/80 dark:border-[#1A294A] text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
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
                <tbody className="divide-y divide-slate-100 dark:divide-[#1A294A]">
                  {pedidos.map((ped) => {
                    const isPendente = ped.status === 'pendente'

                    return (
                      <tr
                        key={ped.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
                        onClick={() => abrirDetalhes(ped.id)}
                      >
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                          #{ped.numero}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                          {ped.clientes?.nome || (
                            <span className="text-slate-400 dark:text-slate-500 font-normal italic">
                              Cliente não informado
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                          {ped.vendedores?.nome || (
                            <span className="text-slate-400 dark:text-slate-500">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">
                          {formatDate(ped.created_at)}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white tabular-nums text-right text-sm">
                          {formatCurrency(ped.total || 0)}
                        </td>
                        <td className="py-3.5 px-4 text-center">{getStatusBadge(ped.status)}</td>
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Botão Visualizar Detalhes */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => abrirDetalhes(ped.id)}
                              className="h-8 w-8 p-0 text-slate-500 hover:text-[#0066FF] hover:bg-[#0066FF]/10 rounded-lg"
                              title="Ver Detalhes"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>

                            {/* Botão Imprimir Direto da Listagem */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                await abrirDetalhes(ped.id)
                                setPrintPreviewAberto(true)
                              }}
                              className="h-8 w-8 p-0 text-slate-500 hover:text-[#0066FF] hover:bg-[#0066FF]/10 rounded-lg"
                              title="Imprimir Pedido / Orçamento"
                            >
                              <Printer className="w-4 h-4" />
                            </Button>

                            {/* Botão Confirmar Pedido (Apenas status pendente e podeGerenciar) */}
                            {podeGerenciar && isPendente && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => abrirConfirmarPedido(ped)}
                                className="h-8 text-[11px] px-2.5 border-[#0066FF]/40 text-[#0066FF] dark:text-[#3B82F6] hover:bg-[#0066FF]/10 font-medium flex items-center gap-1 rounded-xl"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#0066FF] dark:text-[#3B82F6]" />
                                Confirmar Pedido
                              </Button>
                            )}

                            {/* Botão Editar (Apenas status pendente) */}
                            {podeGerenciar && isPendente && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => abrirEdicao(ped)}
                                className="h-8 w-8 p-0 text-slate-500 hover:text-[#0066FF] hover:bg-[#0066FF]/10 rounded-lg"
                                title="Editar Pedido"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            )}

                            {/* Botão Faturar Pedido (Apenas status confirmado e podeGerenciar) */}
                            {podeGerenciar && ped.status === 'confirmado' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => abrirFaturarPedido(ped)}
                                className="h-8 text-[11px] px-2.5 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 font-medium flex items-center gap-1 rounded-xl"
                              >
                                <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                                Faturar Pedido
                              </Button>
                            )}

                            {/* Pedido faturado: Identificar se já foi convertido em venda */}
                            {ped.status === 'faturado' && vendasMap[ped.id] ? (
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span>✓ Venda #{vendasMap[ped.id].numero} gerada</span>
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => navigate('/app/vendas')}
                                  className="h-8 text-[11px] px-2.5 border-slate-200 dark:border-[#1A294A] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium flex items-center gap-1 rounded-xl"
                                  title="Ir para Vendas"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                                  Ver Venda
                                </Button>
                              </div>
                            ) : (
                              podeGerenciar &&
                              ped.status === 'faturado' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => abrirModalConversao(ped)}
                                  className="h-8 text-[11px] px-2.5 border-[#0066FF]/40 text-[#0066FF] dark:text-[#3B82F6] hover:bg-[#0066FF]/10 font-medium flex items-center gap-1 rounded-xl"
                                >
                                  <ArrowRightCircle className="w-3.5 h-3.5 text-[#0066FF]" />
                                  Converter em Venda
                                </Button>
                              )
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
            <div className="py-3 px-4 bg-slate-50/50 dark:bg-[#0A1328]/50 border-t border-slate-200/80 dark:border-[#1A294A] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 dark:text-[#C0C6CF]">
              <div>
                Mostrando{' '}
                <span className="font-semibold text-slate-900 dark:text-white">
                  {Math.min((pagina - 1) * limitePorPagina + 1, totalPedidos)}
                </span>{' '}
                a{' '}
                <span className="font-semibold text-slate-900 dark:text-white">
                  {Math.min(pagina * limitePorPagina, totalPedidos)}
                </span>{' '}
                de{' '}
                <span className="font-semibold text-slate-900 dark:text-white">{totalPedidos}</span>{' '}
                pedidos
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagina <= 1}
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  className="h-8 px-2.5 text-xs rounded-xl border-slate-200 dark:border-[#1A294A]"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Anterior
                </Button>
                <span className="text-xs px-2 font-medium text-slate-700 dark:text-slate-300">
                  Página {pagina} de {totalPaginas}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagina >= totalPaginas}
                  onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                  className="h-8 px-2.5 text-xs rounded-xl border-slate-200 dark:border-[#1A294A]"
                >
                  Próxima
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            MODAL 1: NOVO PEDIDO (UI COMPLETA COM CATÁLOGO E CARRINHO)
            ========================================================================= */}
        <Dialog open={modalNovoAberto} onOpenChange={setModalNovoAberto}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-[#0A1328]/95 dark:backdrop-blur-xl border border-slate-200/80 dark:border-[#1A294A] rounded-2xl p-6 shadow-2xl">
            <DialogHeader className="pb-3 border-b border-slate-100 dark:border-[#1A294A]">
              <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
                <ClipboardList className="w-5 h-5 text-[#0066FF] dark:text-[#3B82F6]" />
                Novo Pedido / Orçamento
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-[#C0C6CF]/80">
                Preencha os dados do cliente, vendedor e selecione os produtos para montar o pedido.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-2">
              {/* COLUNA ESQUERDA: CATÁLOGO DE PRODUTOS (7 colunas) */}
              <div className="md:col-span-7 space-y-4">
                <div className="p-3.5 bg-slate-50/80 dark:bg-[#071126]/60 border border-slate-200/80 dark:border-[#1A294A] rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-[#0066FF] dark:text-[#3B82F6]" />
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Catálogo de Produtos
                      </span>
                    </div>
                    <div className="w-48 relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <Input
                        placeholder="Buscar produto..."
                        value={buscaProdutoCatalogo}
                        onChange={(e) => setBuscaProdutoCatalogo(e.target.value)}
                        className="pl-8 h-8 text-xs rounded-xl bg-white dark:bg-[#0A1328] border-slate-200 dark:border-[#1A294A] dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Lista de produtos no catálogo */}
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {loadingProdutos ? (
                      <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                        Carregando produtos...
                      </div>
                    ) : produtos.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                        Nenhum produto ativo encontrado.
                      </div>
                    ) : (
                      produtos.map((prod) => {
                        const estoqueAtual = prod.estoques?.[0]?.quantidade ?? 0
                        const itemNoCarrinho = carrinho.find((c) => c.produto_id === prod.id)

                        return (
                          <div
                            key={prod.id}
                            className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-3 transition-colors ${
                              itemNoCarrinho
                                ? 'bg-[#0066FF]/10 border-[#0066FF]/30 dark:bg-[#0066FF]/15'
                                : 'bg-white/80 dark:bg-[#0A1328]/80 border-slate-200/80 dark:border-[#1A294A] hover:border-slate-300 dark:hover:border-slate-700'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 dark:text-white truncate">
                                  {prod.nome}
                                </span>
                                {prod.codigo && (
                                  <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-[#071126] px-1.5 py-0.5 rounded-md shrink-0">
                                    {prod.codigo}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-[#C0C6CF]/80 mt-0.5">
                                <span>Estoque: {estoqueAtual}</span>
                                <span>•</span>
                                <span className="font-semibold text-[#0066FF] dark:text-[#3B82F6]">
                                  {formatCurrency(prod.preco_venda || 0)} / {prod.unidade || 'UN'}
                                </span>
                              </div>
                            </div>

                            <div className="shrink-0">
                              {itemNoCarrinho ? (
                                <div className="flex items-center gap-1 bg-white dark:bg-[#0A1328] border border-[#0066FF]/40 rounded-xl p-0.5">
                                  <button
                                    type="button"
                                    onClick={() => alterarQuantidadeCarrinho(prod.id, -1)}
                                    className="w-5 h-5 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1A294A] rounded-lg"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <span className="w-6 text-center font-bold text-xs text-[#0066FF] dark:text-[#3B82F6]">
                                    {itemNoCarrinho.quantidade}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => alterarQuantidadeCarrinho(prod.id, 1)}
                                    className="w-5 h-5 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1A294A] rounded-lg"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => adicionarAoCarrinho(prod)}
                                  className="h-7 text-xs bg-[#0066FF] hover:bg-[#0052CC] text-white px-2.5 rounded-xl shadow-xs"
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
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Observações do Pedido (opcional)
                  </Label>
                  <Textarea
                    placeholder="Condições comerciais, prazos de entrega, observações gerais..."
                    value={novoObservacoes}
                    onChange={(e) => setNovoObservacoes(e.target.value)}
                    rows={2}
                    className="text-xs resize-none rounded-xl bg-slate-50/80 dark:bg-[#071126]/60 border-slate-200 dark:border-[#1A294A] dark:text-white"
                  />
                </div>
              </div>

              {/* COLUNA DIREITA: CLIENTE, VENDEDOR E RESUMO/CARRINHO (5 colunas) */}
              <div className="md:col-span-5 space-y-4">
                {/* Select Cliente */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-[#0066FF] dark:text-[#3B82F6]" />
                    Cliente
                  </Label>
                  <Select
                    value={novoClienteId || 'sem_cliente'}
                    onValueChange={(val) => setNovoClienteId(val === 'sem_cliente' ? null : val)}
                  >
                    <SelectTrigger className="text-xs h-9 bg-slate-50/80 dark:bg-[#071126]/60 border-slate-200 dark:border-[#1A294A] rounded-xl dark:text-white">
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56 bg-white dark:bg-[#0A1328] border-slate-200 dark:border-[#1A294A]">
                      <div className="p-1 border-b border-slate-100 dark:border-[#1A294A]">
                        <Input
                          placeholder="Pesquisar cliente..."
                          value={buscaClienteModal}
                          onChange={(e) => setBuscaClienteModal(e.target.value)}
                          className="h-7 text-xs rounded-lg dark:text-white"
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
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                    <Percent className="w-3.5 h-3.5 text-[#0066FF] dark:text-[#3B82F6]" />
                    Vendedor
                  </Label>
                  <Select
                    value={novoVendedorId || 'sem_vendedor'}
                    onValueChange={(val) => setNovoVendedorId(val === 'sem_vendedor' ? null : val)}
                  >
                    <SelectTrigger className="text-xs h-9 bg-slate-50/80 dark:bg-[#071126]/60 border-slate-200 dark:border-[#1A294A] rounded-xl dark:text-white">
                      <SelectValue placeholder="Selecione o vendedor" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56 bg-white dark:bg-[#0A1328] border-slate-200 dark:border-[#1A294A]">
                      <div className="p-1 border-b border-slate-100 dark:border-[#1A294A]">
                        <Input
                          placeholder="Pesquisar vendedor..."
                          value={buscaVendedorModal}
                          onChange={(e) => setBuscaVendedorModal(e.target.value)}
                          className="h-7 text-xs rounded-lg dark:text-white"
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
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-[#1A294A]">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
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
                    <div className="py-6 text-center border border-dashed border-slate-200 dark:border-[#1A294A] rounded-xl bg-slate-50/50 dark:bg-[#071126]/40 text-xs text-slate-400 dark:text-slate-500">
                      Nenhum item adicionado ao pedido
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {carrinho.map((item) => (
                        <div
                          key={item.produto_id}
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-50/80 dark:bg-[#071126]/60 border border-slate-100 dark:border-[#1A294A] text-xs"
                        >
                          <div className="flex-1 min-w-0 mr-2">
                            <p className="font-semibold text-slate-900 dark:text-white truncate">
                              {item.nome}
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-[#C0C6CF]/80">
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
                              className="w-10 text-center text-xs font-bold bg-white dark:bg-[#0A1328] border border-slate-200 dark:border-[#1A294A] rounded-lg py-0.5 dark:text-white"
                            />
                            <span className="font-bold text-slate-900 dark:text-white tabular-nums w-14 text-right">
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
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-[#1A294A] text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-[#C0C6CF]">
                    <span>Subtotal:</span>
                    <span className="font-semibold text-slate-900 dark:text-white tabular-nums">
                      {formatCurrency(subtotalNovo)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-600 dark:text-[#C0C6CF]">Desconto Total (R$):</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={descontoTotalInput}
                      onChange={(e) => handleDescontoTotalChange(e.target.value)}
                      className="w-24 h-7 text-xs text-right rounded-lg bg-slate-50/80 dark:bg-[#071126]/60 border-slate-200 dark:border-[#1A294A] dark:text-white"
                    />
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-[#1A294A]">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      Total do Pedido:
                    </span>
                    <span className="text-lg font-black text-[#0066FF] dark:text-[#3B82F6] tabular-nums">
                      {formatCurrency(totalNovo)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-slate-100 dark:border-[#1A294A] flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                type="button"
                disabled={submetendoNovo}
                onClick={() => setModalNovoAberto(false)}
                className="text-xs rounded-xl border-slate-200 dark:border-[#1A294A] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1A294A]"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={submetendoNovo || carrinho.length === 0}
                onClick={handleSubmitNovoPedido}
                className="bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-bold flex items-center gap-2 rounded-xl px-4 shadow-sm"
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
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-[#0A1328]/95 dark:backdrop-blur-xl border border-slate-200/80 dark:border-[#1A294A] rounded-2xl p-6 shadow-2xl">
            <DialogHeader className="pb-3 border-b border-slate-100 dark:border-[#1A294A]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#0066FF] dark:text-[#3B82F6]" />
                  <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
                    Pedido #{pedidoDetalhe?.numero}
                  </DialogTitle>
                </div>
                {pedidoDetalhe?.status && getStatusBadge(pedidoDetalhe.status)}
              </div>
              <DialogDescription className="text-xs text-slate-500 dark:text-[#C0C6CF]/80">
                Criado em {formatDateTime(pedidoDetalhe?.created_at)}
              </DialogDescription>
            </DialogHeader>

            {loadingDetalhes ? (
              <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500">
                Carregando detalhes do pedido...
              </div>
            ) : pedidoDetalhe ? (
              <div className="space-y-4 text-xs">
                {/* Informações do Cliente & Vendedor */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50/80 dark:bg-[#071126]/60 rounded-xl border border-slate-200/80 dark:border-[#1A294A]">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-[#C0C6CF]/80 uppercase block mb-1">
                      Cliente
                    </span>
                    <p className="font-bold text-slate-900 dark:text-white text-sm">
                      {pedidoDetalhe.clientes?.nome || 'Consumidor / Não informado'}
                    </p>
                    {pedidoDetalhe.clientes?.documento && (
                      <p className="text-slate-600 dark:text-slate-300">
                        Doc: {pedidoDetalhe.clientes.documento}
                      </p>
                    )}
                    {pedidoDetalhe.clientes?.telefone && (
                      <p className="text-slate-600 dark:text-slate-300">
                        Tel: {pedidoDetalhe.clientes.telefone}
                      </p>
                    )}
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-[#C0C6CF]/80 uppercase block mb-1">
                      Vendedor Responsável
                    </span>
                    <p className="font-bold text-slate-900 dark:text-white text-sm">
                      {pedidoDetalhe.vendedores?.nome || 'Nenhum vendedor associado'}
                    </p>
                  </div>
                </div>

                {/* Tabela de Itens */}
                <div className="space-y-2">
                  <span className="font-bold text-slate-900 dark:text-white block">
                    Itens do Pedido
                  </span>
                  <div className="border border-slate-200/80 dark:border-[#1A294A] rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs text-slate-600 dark:text-[#C0C6CF]">
                      <thead className="bg-slate-50/80 dark:bg-[#0A1328]/80 text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-[#1A294A]">
                        <tr>
                          <th className="py-2.5 px-3">Produto</th>
                          <th className="py-2.5 px-3 text-center">Qtd</th>
                          <th className="py-2.5 px-3 text-right">Preço Unit.</th>
                          <th className="py-2.5 px-3 text-right">Desconto</th>
                          <th className="py-2.5 px-3 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-[#1A294A]">
                        {!pedidoDetalhe.itens_pedido || pedidoDetalhe.itens_pedido.length === 0 ? (
                          <tr>
                            <td
                              colSpan={5}
                              className="py-4 text-center text-slate-400 dark:text-slate-500 italic"
                            >
                              Nenhum item registrado para este pedido.
                            </td>
                          </tr>
                        ) : (
                          pedidoDetalhe.itens_pedido.map((item: any) => (
                            <tr
                              key={item.id}
                              className="hover:bg-slate-50/50 dark:hover:bg-white/[0.03]"
                            >
                              <td className="py-2.5 px-3">
                                <p className="font-semibold text-slate-900 dark:text-white">
                                  {item.produtos?.nome || 'Produto não identificado'}
                                </p>
                                {item.produtos?.codigo && (
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                                    Cód: {item.produtos.codigo}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center font-semibold text-slate-800 dark:text-slate-200">
                                {item.quantidade} {item.produtos?.unidade || ''}
                              </td>
                              <td className="py-2.5 px-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                                {formatCurrency(item.preco_unitario)}
                              </td>
                              <td className="py-2.5 px-3 text-right tabular-nums text-slate-500 dark:text-slate-400">
                                {formatCurrency(item.desconto || 0)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white tabular-nums">
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
                  <div className="w-64 space-y-1.5 p-3.5 bg-slate-50/80 dark:bg-[#071126]/60 rounded-xl border border-slate-200/80 dark:border-[#1A294A]">
                    <div className="flex justify-between items-center text-slate-900 dark:text-white font-bold text-sm">
                      <span>Total do Pedido:</span>
                      <span className="text-[#0066FF] dark:text-[#3B82F6] font-black">
                        {formatCurrency(pedidoDetalhe.total || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Venda Relacionada (se houver) */}
                {vendaRelacionada && (
                  <div className="border border-[#0066FF]/30 bg-[#0066FF]/5 dark:bg-[#0066FF]/10 rounded-xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-[#0066FF] dark:text-[#3B82F6]" />
                        <span className="font-bold text-slate-900 dark:text-white text-xs">
                          Venda Gerada #{vendaRelacionada.numero}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-semibold text-[10px]"
                        >
                          {vendaRelacionada.status || 'Concluída'}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate('/app/vendas')}
                          className="h-7 text-[11px] px-2.5 rounded-xl border-slate-200 dark:border-[#1A294A] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1A294A] flex items-center gap-1 font-medium"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Ver Venda
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] text-slate-600 dark:text-[#C0C6CF] border-t border-[#0066FF]/15">
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 block text-[10px]">
                          Data da Venda
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {formatDateTime(vendaRelacionada.created_at)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 block text-[10px]">
                          Total da Venda
                        </span>
                        <span className="font-bold text-[#0066FF] dark:text-[#3B82F6] tabular-nums">
                          {formatCurrency(vendaRelacionada.total || 0)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 block text-[10px]">
                          Forma de Pagto
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 uppercase">
                          {vendaRelacionada.forma_pagamento || '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 block text-[10px]">
                          Status
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
                          {vendaRelacionada.status || 'Finalizada'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Observações */}
                {pedidoDetalhe.observacoes && (
                  <div className="p-3.5 bg-slate-50/80 dark:bg-[#071126]/60 rounded-xl border border-slate-200/80 dark:border-[#1A294A]">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Observações:
                    </span>
                    <p className="text-slate-600 dark:text-[#C0C6CF] whitespace-pre-wrap">
                      {pedidoDetalhe.observacoes}
                    </p>
                  </div>
                )}
              </div>
            ) : null}

            <DialogFooter className="pt-4 border-t border-slate-100 dark:border-[#1A294A] flex flex-col sm:flex-row gap-2 justify-between items-center">
              <div className="flex items-center gap-2">
                {/* Botão Imprimir Pedido */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPrintPreviewAberto(true)}
                  className="text-xs rounded-xl border-slate-200 dark:border-[#1A294A] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1A294A] flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5 text-[#0066FF] dark:text-[#3B82F6]" />
                  Imprimir
                </Button>

                {/* Botão Converter em Venda no modal (Apenas status faturado, sem venda vinculada e podeGerenciar) */}
                {podeGerenciar && pedidoDetalhe?.status === 'faturado' && !vendaRelacionada && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => abrirModalConversao(pedidoDetalhe)}
                    className="text-xs rounded-xl border-[#0066FF]/40 text-[#0066FF] dark:text-[#3B82F6] hover:bg-[#0066FF]/10 font-medium flex items-center gap-1.5"
                  >
                    <ArrowRightCircle className="w-3.5 h-3.5 text-[#0066FF] dark:text-[#3B82F6]" />
                    Converter em Venda
                  </Button>
                )}

                {/* Botão Editar se pendente */}
                {podeGerenciar && pedidoDetalhe?.status === 'pendente' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => abrirEdicao(pedidoDetalhe)}
                    className="text-xs rounded-xl border-slate-200 dark:border-[#1A294A] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1A294A] flex items-center gap-1.5"
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
                className="text-xs rounded-xl border-slate-200 dark:border-[#1A294A] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1A294A]"
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
          <DialogContent className="max-w-md bg-white dark:bg-[#0A1328]/95 dark:backdrop-blur-xl border border-slate-200/80 dark:border-[#1A294A] rounded-2xl p-6 shadow-2xl">
            <DialogHeader className="pb-3 border-b border-slate-100 dark:border-[#1A294A]">
              <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
                <Edit className="w-4 h-4 text-[#0066FF] dark:text-[#3B82F6]" />
                Editar Pedido #{editNumero}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-[#C0C6CF]/80">
                Altere os dados de cliente, vendedor ou observações. (Os itens são fixos neste
                pedido).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              {/* Select Cliente */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Cliente
                </Label>
                <Select
                  value={editClienteId || 'sem_cliente'}
                  onValueChange={(val) => setEditClienteId(val === 'sem_cliente' ? null : val)}
                >
                  <SelectTrigger className="text-xs h-9 bg-slate-50/80 dark:bg-[#071126]/60 border-slate-200 dark:border-[#1A294A] rounded-xl dark:text-white">
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56 bg-white dark:bg-[#0A1328] border-slate-200 dark:border-[#1A294A]">
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
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Vendedor
                </Label>
                <Select
                  value={editVendedorId || 'sem_vendedor'}
                  onValueChange={(val) => setEditVendedorId(val === 'sem_vendedor' ? null : val)}
                >
                  <SelectTrigger className="text-xs h-9 bg-slate-50/80 dark:bg-[#071126]/60 border-slate-200 dark:border-[#1A294A] rounded-xl dark:text-white">
                    <SelectValue placeholder="Selecione o vendedor" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56 bg-white dark:bg-[#0A1328] border-slate-200 dark:border-[#1A294A]">
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
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Observações
                </Label>
                <Textarea
                  placeholder="Informações adicionais..."
                  value={editObservacoes}
                  onChange={(e) => setEditObservacoes(e.target.value)}
                  rows={3}
                  className="text-xs resize-none rounded-xl bg-slate-50/80 dark:bg-[#071126]/60 border-slate-200 dark:border-[#1A294A] dark:text-white"
                />
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-slate-100 dark:border-[#1A294A] flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                type="button"
                disabled={salvandoEdicao}
                onClick={() => setModalEdicaoAberto(false)}
                className="text-xs rounded-xl border-slate-200 dark:border-[#1A294A] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1A294A]"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={salvandoEdicao}
                onClick={handleSalvarEdicao}
                className="bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-bold rounded-xl px-4 shadow-sm"
              >
                {salvandoEdicao ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* =========================================================================
            MODAL GENÉRICO: CONFIRMAR / FATURAR PEDIDO
            ========================================================================= */}
        <Dialog
          open={modalConfirmarAcaoAberto}
          onOpenChange={(open) => {
            if (!executandoAcao) setModalConfirmarAcaoAberto(open)
          }}
        >
          <DialogContent className="max-w-md w-full bg-white dark:bg-[#0A1328]/95 dark:backdrop-blur-xl border border-slate-200/80 dark:border-[#1A294A] rounded-2xl p-6 shadow-2xl">
            <DialogHeader className="pb-3 border-b border-slate-100 dark:border-[#1A294A]">
              <div className="flex items-center gap-2 text-[#0066FF] dark:text-[#3B82F6]">
                {acaoPedido?.acao === 'confirmar' ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Receipt className="w-5 h-5" />
                )}
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
                  {acaoPedido?.acao === 'confirmar' ? 'Confirmar Pedido' : 'Faturar Pedido'}
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-slate-500 dark:text-[#C0C6CF]/80 pt-2 leading-relaxed">
                {acaoPedido?.acao === 'confirmar'
                  ? 'Confirmar este pedido? O pedido será marcado como confirmado e poderá ser faturado em seguida.'
                  : 'Faturar este pedido? O pedido ficará disponível para conversão em venda.'}
              </DialogDescription>
            </DialogHeader>

            {acaoPedido?.pedido && (
              <div className="p-3.5 bg-slate-50/80 dark:bg-[#071126]/60 rounded-xl border border-slate-200/80 dark:border-[#1A294A] text-xs space-y-1.5 my-2">
                <div className="flex justify-between text-slate-600 dark:text-[#C0C6CF]">
                  <span>Número do Pedido:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    #{acaoPedido.pedido.numero}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-[#C0C6CF]">
                  <span>Cliente:</span>
                  <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[200px]">
                    {acaoPedido.pedido.clientes?.nome || 'Consumidor / Não informado'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-700 dark:text-slate-300 pt-1 border-t border-slate-200/80 dark:border-[#1A294A] font-bold">
                  <span>Total:</span>
                  <span className="text-[#0066FF] dark:text-[#3B82F6] font-black">
                    {formatCurrency(acaoPedido.pedido.total || 0)}
                  </span>
                </div>
              </div>
            )}

            <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                type="button"
                disabled={executandoAcao}
                onClick={() => setModalConfirmarAcaoAberto(false)}
                className="text-xs rounded-xl border-slate-200 dark:border-[#1A294A] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1A294A]"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={executandoAcao}
                onClick={handleExecutarAcao}
                className="bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-bold flex items-center gap-2 rounded-xl px-4 shadow-sm"
              >
                {executandoAcao ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {acaoPedido?.acao === 'confirmar' ? 'Confirmando...' : 'Faturando...'}
                  </>
                ) : acaoPedido?.acao === 'confirmar' ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Confirmar Pedido
                  </>
                ) : (
                  <>
                    <Receipt className="w-3.5 h-3.5" />
                    Faturar Pedido
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* =========================================================================
            MODAL 4: CONVERTER PEDIDO EM VENDA
            ========================================================================= */}
        <Dialog
          open={modalConversaoAberto}
          onOpenChange={(open) => {
            if (!convertendo) setModalConversaoAberto(open)
          }}
        >
          <DialogContent className="max-w-md w-full sm:max-w-lg bg-white dark:bg-[#0A1328]/95 dark:backdrop-blur-xl border border-slate-200/80 dark:border-[#1A294A] rounded-2xl p-6 shadow-2xl">
            <DialogHeader className="pb-3 border-b border-slate-100 dark:border-[#1A294A]">
              <div className="flex items-center gap-2">
                <ArrowRightCircle className="w-5 h-5 text-[#0066FF] dark:text-[#3B82F6]" />
                <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Converter Pedido #{pedidoParaConverter?.numero} em Venda
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-slate-500 dark:text-[#C0C6CF]/80">
                Selecione a forma de pagamento para faturar este pedido e gerar a venda.
              </DialogDescription>
            </DialogHeader>

            {pedidoParaConverter && (
              <div className="space-y-4 py-2 text-xs">
                {/* Resumo do Pedido */}
                <div className="p-3.5 bg-slate-50/80 dark:bg-[#071126]/60 rounded-xl border border-slate-200/80 dark:border-[#1A294A] space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">
                        Cliente
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white truncate block">
                        {pedidoParaConverter.clientes?.nome || 'Consumidor / Não informado'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">
                        Vendedor
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white truncate block">
                        {pedidoParaConverter.vendedores?.nome || 'Nenhum vendedor'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 dark:border-[#1A294A] text-slate-900 dark:text-white">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">
                        Itens
                      </span>
                      <span className="font-semibold">
                        {pedidoParaConverter.itens_pedido?.length ??
                          (pedidoParaConverter.itens?.length || 'Itens inclusos')}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">
                        Total do Pedido
                      </span>
                      <span className="text-sm sm:text-base font-black text-[#0066FF] dark:text-[#3B82F6] tabular-nums">
                        {formatCurrency(pedidoParaConverter.total || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Aviso Importante */}
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5 text-amber-900 dark:text-amber-200 text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Esta operação irá registrar a venda e realizar a baixa dos produtos no estoque.
                  </p>
                </div>

                {/* Campo: Forma de Pagamento */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-[#0066FF] dark:text-[#3B82F6]" />
                    Forma de Pagamento <span className="text-rose-500">*</span>
                  </Label>
                  <Select
                    value={formaPagamentoConversao}
                    onValueChange={(val) => setFormaPagamentoConversao(val)}
                    disabled={convertendo}
                  >
                    <SelectTrigger className="text-xs h-9 bg-slate-50/80 dark:bg-[#071126]/60 border-slate-200 dark:border-[#1A294A] rounded-xl dark:text-white">
                      <SelectValue placeholder="Selecione a forma de pagamento" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-[#0A1328] border-slate-200 dark:border-[#1A294A]">
                      <SelectItem value="pix" className="text-xs">
                        Pix
                      </SelectItem>
                      <SelectItem value="dinheiro" className="text-xs">
                        Dinheiro
                      </SelectItem>
                      <SelectItem value="cartao" className="text-xs">
                        Cartão
                      </SelectItem>
                      <SelectItem value="fiado" className="text-xs">
                        Fiado
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Campo Condicional: Data de Vencimento (apenas Fiado) */}
                {formaPagamentoConversao === 'fiado' && (
                  <div className="space-y-1.5 p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      Data de Vencimento <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      type="date"
                      value={vencimentoConversao}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setVencimentoConversao(e.target.value)}
                      disabled={convertendo}
                      className="text-xs h-9 bg-slate-50/80 dark:bg-[#071126]/60 border-slate-200 dark:border-[#1A294A] rounded-xl dark:text-white"
                    />
                    <p className="text-[11px] text-slate-500 dark:text-[#C0C6CF]/80">
                      Informe a data limite para o pagamento da conta a receber do cliente.
                    </p>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="pt-3 border-t border-slate-100 dark:border-[#1A294A] flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                type="button"
                disabled={convertendo}
                onClick={() => setModalConversaoAberto(false)}
                className="text-xs rounded-xl border-slate-200 dark:border-[#1A294A] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1A294A]"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={convertendo}
                onClick={validarEAvancarConfirmacao}
                className="bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-bold flex items-center gap-2 rounded-xl px-4 shadow-sm"
              >
                {convertendo ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Convertendo...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Continuar para Conversão
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* =========================================================================
            MODAL 5: DIALOG DE CONFIRMAÇÃO DE CONVERSÃO
            ========================================================================= */}
        <Dialog
          open={modalConfirmacaoAberto}
          onOpenChange={(open) => {
            if (!convertendo) setModalConfirmacaoAberto(open)
          }}
        >
          <DialogContent className="max-w-md w-full bg-white dark:bg-[#0A1328]/95 dark:backdrop-blur-xl border border-slate-200/80 dark:border-[#1A294A] rounded-2xl p-6 shadow-2xl">
            <DialogHeader className="pb-3 border-b border-slate-100 dark:border-[#1A294A]">
              <div className="flex items-center gap-2 text-amber-500">
                <AlertTriangle className="w-5 h-5" />
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
                  Confirmar Conversão
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-slate-500 dark:text-[#C0C6CF]/80 pt-2 leading-relaxed">
                Converter este pedido em venda? Esta operação irá registrar a venda e realizar a
                baixa dos produtos no estoque.
              </DialogDescription>
            </DialogHeader>

            <div className="p-3.5 bg-slate-50/80 dark:bg-[#071126]/60 rounded-xl border border-slate-200/80 dark:border-[#1A294A] text-xs space-y-1 my-2">
              <div className="flex justify-between text-slate-600 dark:text-[#C0C6CF]">
                <span>Pedido:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  #{pedidoParaConverter?.numero}
                </span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-[#C0C6CF]">
                <span>Forma de Pagamento:</span>
                <span className="font-bold text-slate-900 dark:text-white uppercase">
                  {formaPagamentoConversao}
                </span>
              </div>
              {formaPagamentoConversao === 'fiado' && vencimentoConversao && (
                <div className="flex justify-between text-slate-600 dark:text-[#C0C6CF]">
                  <span>Vencimento:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatDate(vencimentoConversao)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-slate-700 dark:text-slate-300 pt-1 border-t border-slate-200/80 dark:border-[#1A294A] font-bold">
                <span>Total a Faturar:</span>
                <span className="text-[#0066FF] dark:text-[#3B82F6] font-black">
                  {formatCurrency(pedidoParaConverter?.total || 0)}
                </span>
              </div>
            </div>

            <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                type="button"
                disabled={convertendo}
                onClick={() => setModalConfirmacaoAberto(false)}
                className="text-xs rounded-xl border-slate-200 dark:border-[#1A294A] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1A294A]"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={convertendo}
                onClick={handleExecutarConversao}
                className="bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-bold flex items-center gap-2 rounded-xl px-4 shadow-sm"
              >
                {convertendo ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Convertendo...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Converter em Venda
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
