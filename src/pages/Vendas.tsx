import React, { useState, useEffect, useMemo } from 'react'
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
import { Card, CardContent } from '@/components/ui/card'
import { useEmpresa } from '@/hooks/use-empresa'
import { useAuth } from '@/hooks/use-auth'
import { VendasService, type FinalizarVendaPayloadItem } from '@/services/vendas'
import {
  ShoppingCart,
  Plus,
  ArrowLeft,
  Search,
  CheckCircle2,
  AlertCircle,
  Banknote,
  CreditCard,
  QrCode,
  Clock,
  Trash2,
  Minus,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Package,
  User,
  Percent,
  Printer,
} from 'lucide-react'
import { PrintPreviewDialog } from '@/components/print/PrintPreviewDialog'
import { VendaPrintDocument } from '@/components/print/VendaPrintDocument'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface CartItem {
  produto_id: string
  nome: string
  codigo: string | null
  preco_venda: number
  quantidade: number
  estoque_atual: number
}

interface ClienteOption {
  id: string
  nome: string
  documento: string | null
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
  foto_url?: string | null
  estoques: { quantidade: number }[] | null
}

export default function VendasPage() {
  const { empresaId, empresa, moduloCestas, moduloCrediario } = useEmpresa()
  const { usuario } = useAuth()

  // Resolução do vendedor_id quando perfil for 'vendedor'
  const [vendedorId, setVendedorId] = useState<string | null>(null)

  useEffect(() => {
    async function resolveVendedor() {
      if (!empresaId || usuario?.perfil !== 'vendedor') {
        setVendedorId(null)
        return
      }
      const { data } = await supabase
        .from('vendedores')
        .select('id')
        .eq('empresa_id', empresaId)
        .eq('usuario_id', usuario.id)
        .eq('ativo', true)
        .maybeSingle()
      if (data) {
        setVendedorId(data.id)
      } else {
        setVendedorId('00000000-0000-0000-0000-000000000000')
      }
    }
    resolveVendedor()
  }, [empresaId, usuario])

  // Modo de visualização: 'listagem' ou 'nova'
  const [modo, setModo] = useState<'listagem' | 'nova'>('listagem')

  // Estado da listagem
  const [vendas, setVendas] = useState<any[]>([])
  const [totalVendas, setTotalVendas] = useState(0)
  const [loadingList, setLoadingList] = useState(true)
  const [errorList, setErrorList] = useState<string | null>(null)

  // Estados de Impressão
  const [printVendaAberto, setPrintVendaAberto] = useState(false)
  const [vendaDetalhe, setVendaDetalhe] = useState<any | null>(null)
  const [contasReceberVenda, setContasReceberVenda] = useState<any[] | null>(null)
  const [loadingPrint, setLoadingPrint] = useState(false)
  const [showFotosPrint, setShowFotosPrint] = useState(false)

  // Filtros de listagem
  const [filtroSearch, setFiltroSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [filtroFormaPagamento, setFiltroFormaPagamento] = useState<string>('todas')
  const [filtroDataInicio, setFiltroDataInicio] = useState<string>('')
  const [filtroDataFim, setFiltroDataFim] = useState<string>('')
  const [pagina, setPagina] = useState(1)
  const limitePorPagina = 20

  // Estado da Nova Venda
  const [produtosDisponiveis, setProdutosDisponiveis] = useState<ProdutoOption[]>([])
  const [loadingProdutos, setLoadingProdutos] = useState(false)
  const [buscaProduto, setBuscaProduto] = useState('')
  const [debouncedBuscaProduto, setDebouncedBuscaProduto] = useState('')

  const [clientes, setClientes] = useState<ClienteOption[]>([])
  const [vendedores, setVendedores] = useState<VendedorOption[]>([])
  const [buscaCliente, setBuscaCliente] = useState('')
  const [buscaVendedor, setBuscaVendedor] = useState('')

  const [clienteSelecionadoId, setClienteSelecionadoId] = useState<string | null>(null)
  const [vendedorSelecionadoId, setVendedorSelecionadoId] = useState<string | null>(null)
  const [carrinho, setCarrinho] = useState<CartItem[]>([])
  const [desconto, setDesconto] = useState<number>(0)
  const [descontoInput, setDescontoInput] = useState<string>('0')
  const [formaPagamento, setFormaPagamento] = useState<string>('pix')
  const [vencimento, setVencimento] = useState<string>('')
  const [observacoes, setObservacoes] = useState<string>('')

  // Estados de Pagamento Avançado (Crediário / Dividido / Parcelado)
  const [tipoPagamento, setTipoPagamento] = useState<'simples' | 'dividido' | 'parcelado'>(
    'simples',
  )
  const [pagamentosDivididos, setPagamentosDivididos] = useState<
    Array<{ id: string; forma: string; valor: number; referencia?: string }>
  >([
    { id: '1', forma: 'dinheiro', valor: 0 },
    { id: '2', forma: 'pix', valor: 0 },
  ])
  const [numParcelas, setNumParcelas] = useState<number>(3)
  const [intervaloDias, setIntervaloDias] = useState<number>(30)
  const [entradaValor, setEntradaValor] = useState<number>(0)
  const [entradaForma, setEntradaForma] = useState<string>('dinheiro')
  const [autorizadorId, setAutorizadorId] = useState<string | null>(null)
  const [gerentesAutorizadores, setGerentesAutorizadores] = useState<
    Array<{ id: string; nome: string }>
  >([])
  const [clienteAvisos, setClienteAvisos] = useState<{
    limite?: number
    temVencida?: boolean
    saldoAberto?: number
  } | null>(null)

  const [submetendoVenda, setSubmetendoVenda] = useState(false)
  const [erroVenda, setErroVenda] = useState<string | null>(null)

  // Modal de sucesso pós-venda
  const [resultadoModal, setResultadoModal] = useState<{
    aberto: boolean
    dados?: {
      venda_id: string
      numero: number
      subtotal: number
      desconto: number
      total: number
      forma_pagamento: string
      comissao: number
    }
  }>({ aberto: false })

  // Debounce busca na listagem
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(filtroSearch)
      setPagina(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [filtroSearch])

  // Debounce busca de produtos na nova venda
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedBuscaProduto(buscaProduto)
    }, 300)
    return () => clearTimeout(timer)
  }, [buscaProduto])

  // Carregar lista de vendas
  const carregarVendas = async () => {
    if (!empresaId) return
    setLoadingList(true)
    setErrorList(null)
    try {
      const filters = {
        search: debouncedSearch,
        status: filtroStatus,
        formaPagamento: filtroFormaPagamento,
        dataInicio: filtroDataInicio,
        dataFim: filtroDataFim,
        pagina,
        limite: limitePorPagina,
        vendedorId,
      }

      const [dataRes, countRes] = await Promise.all([
        VendasService.listFiltered(empresaId, filters),
        VendasService.countFiltered(empresaId, filters),
      ])

      if (dataRes.error) throw dataRes.error
      if (countRes.error) throw countRes.error

      setVendas(dataRes.data || [])
      setTotalVendas(countRes.count || 0)
    } catch (e: any) {
      if (import.meta.env.DEV) {
        console.error('Erro ao carregar vendas:', e)
      }
      setErrorList(e.message || 'Falha ao carregar o histórico de vendas.')
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => {
    if (modo === 'listagem') {
      carregarVendas()
    }
  }, [
    empresaId,
    modo,
    debouncedSearch,
    filtroStatus,
    filtroFormaPagamento,
    filtroDataInicio,
    filtroDataFim,
    pagina,
    vendedorId,
  ])

  // Carregar dados de suporte para nova venda (produtos, clientes, vendedores)
  const carregarProdutosDisponiveis = async (search?: string) => {
    if (!empresaId) return
    setLoadingProdutos(true)
    try {
      const { data, error } = await VendasService.listProdutosDisponiveis(
        empresaId,
        search,
        moduloCestas,
      )
      if (error) throw error
      setProdutosDisponiveis((data as unknown as ProdutoOption[]) || [])
    } catch (e: any) {
      if (import.meta.env.DEV) {
        console.error('Erro ao carregar produtos:', e)
      }
    } finally {
      setLoadingProdutos(false)
    }
  }

  const carregarClientes = async (search?: string) => {
    if (!empresaId) return
    try {
      const { data, error } = await VendasService.listClientesAtivos(empresaId, search)
      if (error) throw error
      setClientes((data as unknown as ClienteOption[]) || [])
    } catch (e: any) {
      if (import.meta.env.DEV) {
        console.error('Erro ao carregar clientes:', e)
      }
    }
  }

  const carregarVendedores = async (search?: string) => {
    if (!empresaId) return
    try {
      const { data, error } = await VendasService.listVendedoresAtivos(empresaId, search)
      if (error) throw error
      setVendedores((data as unknown as VendedorOption[]) || [])
    } catch (e: any) {
      if (import.meta.env.DEV) {
        console.error('Erro ao carregar vendedores:', e)
      }
    }
  }

  // Carregar usuários gerentes/admins autorizadores para caso de estouro de limite
  const carregarAutorizadores = async () => {
    if (!empresaId) return
    try {
      const { data } = await supabase
        .from('usuarios')
        .select('id, nome, perfil')
        .eq('empresa_id', empresaId)
        .in('perfil', ['admin', 'gerente', 'master'])
        .eq('ativo', true)
      if (data) {
        setGerentesAutorizadores(data.map((u) => ({ id: u.id, nome: u.nome })))
      }
    } catch (e) {
      if (import.meta.env.DEV) console.error('Erro ao carregar autorizadores:', e)
    }
  }

  // Verificar histórico financeiro do cliente selecionado (parcelas vencidas, saldo em aberto)
  useEffect(() => {
    async function checarCliente() {
      if (!empresaId || !clienteSelecionadoId) {
        setClienteAvisos(null)
        return
      }
      try {
        const cli = clientes.find((c) => c.id === clienteSelecionadoId)
        const limite = cli?.limite_credito ?? 0

        const { data: contas } = await supabase
          .from('contas_receber')
          .select('valor, saldo, vencimento, status')
          .eq('empresa_id', empresaId)
          .eq('cliente_id', clienteSelecionadoId)
          .in('status', ['aberto', 'parcial'])

        const hojeStr = new Date().toISOString().slice(0, 10)
        let temVencida = false
        let saldoAberto = 0

        if (contas) {
          for (const c of contas) {
            saldoAberto += Number(c.saldo || 0)
            if (c.vencimento < hojeStr) {
              temVencida = true
            }
          }
        }

        setClienteAvisos({ limite, temVencida, saldoAberto })
      } catch (e) {
        if (import.meta.env.DEV) console.error('Erro ao checar cliente:', e)
      }
    }
    checarCliente()
  }, [empresaId, clienteSelecionadoId, clientes])

  // Efeito ao entrar no modo 'nova'
  useEffect(() => {
    if (modo === 'nova' && empresaId) {
      carregarProdutosDisponiveis(debouncedBuscaProduto)
      carregarClientes()
      carregarVendedores()
      carregarAutorizadores()
    }
  }, [modo, empresaId, debouncedBuscaProduto])

  // Filtragem de clientes e vendedores no cliente
  const clientesFiltrados = useMemo(() => {
    if (!buscaCliente.trim()) return clientes
    const termo = buscaCliente.toLowerCase()
    return clientes.filter(
      (c) =>
        c.nome.toLowerCase().includes(termo) ||
        (c.documento && c.documento.toLowerCase().includes(termo)),
    )
  }, [clientes, buscaCliente])

  const vendedoresFiltrados = useMemo(() => {
    if (!buscaVendedor.trim()) return vendedores
    const termo = buscaVendedor.toLowerCase()
    return vendedores.filter((v) => v.nome.toLowerCase().includes(termo))
  }, [vendedores, buscaVendedor])

  // Funções do carrinho
  const adicionarAoCarrinho = (produto: ProdutoOption) => {
    setCarrinho((prev) => {
      const jaExiste = prev.find((item) => item.produto_id === produto.id)
      if (jaExiste) return prev

      const estoqueAtual = produto.estoques?.[0]?.quantidade ?? 0

      return [
        ...prev,
        {
          produto_id: produto.id,
          nome: produto.nome,
          codigo: produto.codigo,
          preco_venda: produto.preco_venda || 0,
          quantidade: 1,
          estoque_atual: estoqueAtual,
        },
      ]
    })
  }

  const alterarQuantidade = (produtoId: string, delta: number) => {
    setCarrinho((prev) =>
      prev.map((item) => {
        if (item.produto_id === produtoId) {
          const novaQtd = Math.max(1, item.quantidade + delta)
          return { ...item, quantidade: novaQtd }
        }
        return item
      }),
    )
  }

  const setQuantidadeItem = (produtoId: string, quantidade: number) => {
    const val = isNaN(quantidade) || quantidade <= 0 ? 1 : Math.floor(quantidade)
    setCarrinho((prev) =>
      prev.map((item) => (item.produto_id === produtoId ? { ...item, quantidade: val } : item)),
    )
  }

  const removerDoCarrinho = (produtoId: string) => {
    setCarrinho((prev) => prev.filter((item) => item.produto_id !== produtoId))
  }

  const limparNovaVenda = () => {
    setCarrinho([])
    setClienteSelecionadoId(null)
    setVendedorSelecionadoId(null)
    setDesconto(0)
    setDescontoInput('0')
    setFormaPagamento('pix')
    setTipoPagamento('simples')
    setPagamentosDivididos([
      { id: '1', forma: 'dinheiro', valor: 0 },
      { id: '2', forma: 'pix', valor: 0 },
    ])
    setNumParcelas(3)
    setIntervaloDias(30)
    setEntradaValor(0)
    setEntradaForma('dinheiro')
    setAutorizadorId(null)
    setVencimento('')
    setObservacoes('')
    setErroVenda(null)
    setBuscaProduto('')
    setBuscaCliente('')
    setBuscaVendedor('')
  }

  // Cálculos visuais da venda
  const subtotalVisual = useMemo(() => {
    return carrinho.reduce((acc, item) => acc + item.quantidade * item.preco_venda, 0)
  }, [carrinho])

  const totalVisual = useMemo(() => {
    return Math.max(0, subtotalVisual - (desconto || 0))
  }, [subtotalVisual, desconto])

  const handleDescontoChange = (valorTexto: string) => {
    setDescontoInput(valorTexto)
    const parsed = parseFloat(valorTexto.replace(',', '.'))
    if (!isNaN(parsed) && parsed >= 0) {
      setDesconto(parsed)
    } else if (valorTexto === '') {
      setDesconto(0)
    }
  }

  // Função para abrir modal de impressão de venda
  const abrirImpressaoVenda = async (vendaId: string) => {
    if (!empresaId) return
    setLoadingPrint(true)
    try {
      const { data: vendaData, error: vendaErr } = await VendasService.getById(empresaId, vendaId)
      if (vendaErr) throw vendaErr
      if (!vendaData) throw new Error('Venda não encontrada.')

      // Se houver pedido_id e não tiver pedidos vinculado, buscar dados do pedido
      let vendaFinal: any = { ...vendaData }
      if (vendaData.pedido_id && !(vendaData as any).pedidos) {
        try {
          const { data: pedData } = await supabase
            .from('pedidos')
            .select('numero')
            .eq('id', vendaData.pedido_id)
            .maybeSingle()
          if (pedData) {
            vendaFinal.pedidos = pedData
          }
        } catch (pedErr) {
          if (import.meta.env.DEV) {
            console.error('Erro ao buscar dados do pedido vinculado:', pedErr)
          }
        }
      }

      // Buscar contas_receber se for venda fiado ou a prazo
      let contas: any[] | null = null
      const isFiado =
        vendaData.forma_pagamento === 'fiado' || vendaData.forma_pagamento === 'a_prazo'
      if (isFiado) {
        try {
          const { data: crData } = await supabase
            .from('contas_receber')
            .select('*')
            .eq('empresa_id', empresaId)
            .eq('cliente_id', vendaData.cliente_id)
            .ilike('descricao', `%Venda #${vendaData.numero}%`)

          if (crData && crData.length > 0) {
            contas = crData
          }
        } catch (crErr) {
          if (import.meta.env.DEV) {
            console.error('Erro ao buscar contas a receber vinculadas:', crErr)
          }
        }
      }

      setVendaDetalhe(vendaFinal)
      setContasReceberVenda(contas)
      setPrintVendaAberto(true)
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.error('Erro ao preparar impressão de venda:', err)
      }
      toast.error(err.message || 'Falha ao carregar dados da venda para impressão.')
    } finally {
      setLoadingPrint(false)
    }
  }

  // Finalização de venda chamando a RPC
  const handleFinalizarVenda = async () => {
    if (submetendoVenda) return
    setErroVenda(null)

    // Validações locais amigáveis
    if (carrinho.length === 0) {
      setErroVenda('Adicione pelo menos um produto ao carrinho.')
      return
    }

    const itemInvalido = carrinho.find((item) => !item.quantidade || item.quantidade <= 0)
    if (itemInvalido) {
      setErroVenda(`A quantidade para o produto "${itemInvalido.nome}" deve ser maior que zero.`)
      return
    }

    if (tipoPagamento === 'parcelado') {
      if (!clienteSelecionadoId) {
        setErroVenda('Para vendas parceladas, é obrigatório selecionar um cliente cadastrado.')
        return
      }
      const cliSel = clientes.find((c) => c.id === clienteSelecionadoId)
      if (!cliSel?.telefone && !cliSel?.whatsapp) {
        setErroVenda('Venda parcelada exige cliente identificado COM TELEFONE para cobrança.')
        return
      }
      if (numParcelas < 1) {
        setErroVenda('O número de parcelas deve ser pelo menos 1.')
        return
      }
    } else if (tipoPagamento === 'dividido') {
      const somaDiv = pagamentosDivididos.reduce((acc, p) => acc + (Number(p.valor) || 0), 0)
      if (Math.abs(somaDiv - totalVisual) > 0.01) {
        setErroVenda(
          `A soma dos pagamentos divididos (R$ ${somaDiv.toFixed(2)}) deve fechar com o total da venda (R$ ${totalVisual.toFixed(2)}).`,
        )
        return
      }
    } else if (formaPagamento === 'fiado') {
      if (!clienteSelecionadoId) {
        setErroVenda(
          'Para vendas na forma "Fiado", é obrigatório selecionar um cliente cadastrado.',
        )
        return
      }
      if (!vencimento) {
        setErroVenda('Para vendas na forma "Fiado", a data de vencimento é obrigatória.')
        return
      }
    }

    if (desconto < 0) {
      setErroVenda('O desconto não pode ser negativo.')
      return
    }

    if (desconto > subtotalVisual) {
      setErroVenda('O desconto não pode ser maior que o subtotal da venda.')
      return
    }

    setSubmetendoVenda(true)

    try {
      // Montar apenas {produto_id, quantidade} para cada item
      const payloadItens: FinalizarVendaPayloadItem[] = carrinho.map((item) => ({
        produto_id: item.produto_id,
        quantidade: item.quantidade,
      }))

      // Preparar argumentos conforme o tipo de pagamento
      let rpcPagamentos: Array<{ forma: string; valor: number; referencia?: string }> | null = null
      let rpcCondicao: 'a_vista' | 'parcelado' = 'a_vista'

      if (tipoPagamento === 'dividido') {
        rpcPagamentos = pagamentosDivididos.map((p) => ({
          forma: p.forma,
          valor: Number(p.valor) || 0,
          referencia: p.referencia || undefined,
        }))
      } else if (tipoPagamento === 'parcelado') {
        rpcCondicao = 'parcelado'
      }

      const { data, error } = await VendasService.finalizarVendaViaRpc({
        clienteId: clienteSelecionadoId,
        vendedorId: vendedorSelecionadoId,
        itens: payloadItens,
        desconto,
        formaPagamento: tipoPagamento === 'parcelado' ? 'crediario' : formaPagamento,
        vencimento: formaPagamento === 'fiado' ? vencimento : null,
        observacoes: observacoes.trim() ? observacoes.trim() : null,
        condicao: rpcCondicao,
        pagamentos: rpcPagamentos,
        entradaValor: tipoPagamento === 'parcelado' ? entradaValor : 0,
        entradaForma: tipoPagamento === 'parcelado' ? entradaForma : 'dinheiro',
        numParcelas: tipoPagamento === 'parcelado' ? numParcelas : 1,
        intervaloDias: tipoPagamento === 'parcelado' ? intervaloDias : 30,
        autorizadorId: autorizadorId || null,
      })

      if (error) {
        throw error
      }

      // data é o json retornado pela RPC: {sucesso, venda_id, numero, subtotal, desconto, total, forma_pagamento, comissao}
      const res = data as any
      if (res && res.sucesso) {
        setResultadoModal({
          aberto: true,
          dados: {
            venda_id: res.venda_id,
            numero: res.numero,
            subtotal: Number(res.subtotal || 0),
            desconto: Number(res.desconto || 0),
            total: Number(res.total || 0),
            forma_pagamento: res.forma_pagamento || formaPagamento,
            comissao: Number(res.comissao || 0),
          },
        })
      } else {
        throw new Error('Não foi possível confirmar a finalização da venda.')
      }
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.error('Erro ao finalizar venda na RPC:', err)
      }
      let msgAmigavel = err.message || 'Falha ao finalizar venda.'

      if (msgAmigavel.includes('Estoque insuficiente')) {
        msgAmigavel =
          'Estoque insuficiente para um ou mais produtos selecionados. Verifique o saldo.'
      } else if (msgAmigavel.includes('Venda fiada precisa possuir um cliente')) {
        msgAmigavel = 'Para vendas fiadas, selecione um cliente cadastrado.'
      } else if (msgAmigavel.includes('não possui permissão')) {
        msgAmigavel = 'Você não possui permissão para registrar vendas nesta empresa.'
      } else if (msgAmigavel.includes('Desconto não pode ser maior')) {
        msgAmigavel = 'O desconto aplicado é superior ao valor total dos produtos.'
      } else if (msgAmigavel.includes('limite') || msgAmigavel.includes('Limite de crédito')) {
        msgAmigavel =
          'Limite de crédito do cliente ultrapassado. Selecione um Gerente ou Admin para autorizar a venda.'
      } else if (msgAmigavel.includes('telefone')) {
        msgAmigavel = 'Venda parcelada exige cliente identificado com telefone cadastrado.'
      }

      setErroVenda(msgAmigavel)
    } finally {
      setSubmetendoVenda(false)
    }
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
  }

  const limparFiltros = () => {
    setFiltroSearch('')
    setDebouncedSearch('')
    setFiltroStatus('todos')
    setFiltroFormaPagamento('todas')
    setFiltroDataInicio('')
    setFiltroDataFim('')
    setPagina(1)
  }

  const temFiltroAtivo =
    debouncedSearch !== '' ||
    filtroStatus !== 'todos' ||
    filtroFormaPagamento !== 'todas' ||
    filtroDataInicio !== '' ||
    filtroDataFim !== ''

  const totalPaginas = Math.ceil(totalVendas / limitePorPagina) || 1

  const getFormaPagamentoBadge = (forma: string | null) => {
    const f = forma?.toLowerCase() || 'pix'
    switch (f) {
      case 'dinheiro':
        return (
          <span className="inline-flex items-center gap-1 uppercase text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
            <Banknote className="w-3 h-3" />
            Dinheiro
          </span>
        )
      case 'pix':
        return (
          <span className="inline-flex items-center gap-1 uppercase text-[11px] font-semibold bg-[#0066FF]/10 text-[#0066FF] dark:text-[#3B82F6] border border-[#0066FF]/25 px-2 py-0.5 rounded-lg">
            <QrCode className="w-3 h-3" />
            PIX
          </span>
        )
      case 'cartao':
        return (
          <span className="inline-flex items-center gap-1 uppercase text-[11px] font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-lg">
            <CreditCard className="w-3 h-3" />
            Cartão
          </span>
        )
      case 'fiado':
        return (
          <span className="inline-flex items-center gap-1 uppercase text-[11px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-lg">
            <Clock className="w-3 h-3" />
            Fiado
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 uppercase text-[11px] font-semibold bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20 px-2 py-0.5 rounded-lg">
            {f}
          </span>
        )
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'finalizada':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
            Finalizada
          </span>
        )
      case 'cancelada':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/25">
            Cancelada
          </span>
        )
      case 'rascunho':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25">
            Rascunho
          </span>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* HEADER DINÂMICO */}
      {modo === 'listagem' ? (
        <PageHeader
          title="Vendas Comerciais"
          description="Histórico completo de vendas, relatórios e emissão de pedidos no PDV."
          badge={
            totalVendas > 0 ? (
              <span>
                <AnimatedNumber value={totalVendas} /> {totalVendas === 1 ? 'venda' : 'vendas'}
              </span>
            ) : undefined
          }
          actions={
            <Button
              onClick={() => {
                limparNovaVenda()
                setModo('nova')
              }}
              className="bg-[#0066FF] hover:bg-[#0052CC] text-white flex items-center gap-1.5 shadow-sm font-semibold rounded-xl"
            >
              <Plus className="w-4 h-4" />
              Nova Venda (PDV)
            </Button>
          }
        />
      ) : (
        <PageHeader
          title="Nova Venda (PDV)"
          description="Selecione os produtos, cliente e forma de pagamento para registrar a venda."
          actions={
            <Button
              variant="outline"
              onClick={() => {
                limparNovaVenda()
                setModo('listagem')
              }}
              className="border-slate-200 dark:border-[#1A294A] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1A294A] flex items-center gap-1.5 rounded-xl font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar para Listagem
            </Button>
          }
        />
      )}

      {/* ========================================================
          MODO LISTAGEM
          ======================================================== */}
      {modo === 'listagem' && (
        <div className="space-y-4">
          {/* BARRA DE FILTROS */}
          <div className="glass-card p-4 rounded-2xl border border-slate-200/80 dark:border-[#1A294A] space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Busca de número ou observações */}
              <div className="lg:col-span-2 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Buscar por Nº da venda ou obs..."
                  value={filtroSearch}
                  onChange={(e) => setFiltroSearch(e.target.value)}
                  className="pl-9 bg-slate-50/70 dark:bg-[#0A1328]/50 border-slate-200 dark:border-[#1A294A] focus:bg-white dark:focus:bg-[#0A1328] text-xs h-9 rounded-xl"
                />
              </div>

              {/* Status */}
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
                    <SelectItem value="finalizada">Finalizada</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Forma de Pagamento */}
              <div>
                <Select
                  value={filtroFormaPagamento}
                  onValueChange={(val) => {
                    setFiltroFormaPagamento(val)
                    setPagina(1)
                  }}
                >
                  <SelectTrigger className="text-xs h-9 bg-slate-50/70 dark:bg-[#0A1328]/50 border-slate-200 dark:border-[#1A294A] rounded-xl">
                    <SelectValue placeholder="Forma Pagto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as formas</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="cartao">Cartão</SelectItem>
                    <SelectItem value="fiado">Fiado</SelectItem>
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
                    className="text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 h-9 w-full justify-center rounded-xl"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Limpar filtros
                  </Button>
                ) : (
                  <div className="hidden lg:block text-xs text-slate-400 dark:text-slate-500 text-center w-full">
                    Filtros padrão
                  </div>
                )}
              </div>
            </div>

            {/* Segunda linha de filtros: Datas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-[#1A294A]">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  De:
                </span>
                <Input
                  type="date"
                  value={filtroDataInicio}
                  onChange={(e) => {
                    setFiltroDataInicio(e.target.value)
                    setPagina(1)
                  }}
                  className="text-xs h-8 bg-slate-50/70 dark:bg-[#0A1328]/50 border-slate-200 dark:border-[#1A294A] rounded-xl"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  Até:
                </span>
                <Input
                  type="date"
                  value={filtroDataFim}
                  onChange={(e) => {
                    setFiltroDataFim(e.target.value)
                    setPagina(1)
                  }}
                  className="text-xs h-8 bg-slate-50/70 dark:bg-[#0A1328]/50 border-slate-200 dark:border-[#1A294A] rounded-xl"
                />
              </div>
            </div>
          </div>
          {/* ESTADOS DA TABELA */}
          {loadingList ? (
            <TableSkeleton rows={6} cols={6} />
          ) : errorList ? (
            <ErrorState message={errorList} onRetry={carregarVendas} />
          ) : vendas.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title={temFiltroAtivo ? 'Nenhuma venda encontrada' : 'Nenhuma venda realizada ainda'}
              description={
                temFiltroAtivo
                  ? 'Ajuste os filtros de busca ou período para encontrar outros registros de vendas.'
                  : 'Registre a primeira venda pelo PDV para movimentar o estoque e gerar lançamentos financeiros.'
              }
              actionLabel={temFiltroAtivo ? 'Limpar Filtros' : 'Nova Venda (PDV)'}
              onAction={
                temFiltroAtivo
                  ? limparFiltros
                  : () => {
                      limparNovaVenda()
                      setModo('nova')
                    }
              }
            />
          ) : (
            <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-[#1A294A] overflow-hidden">
              {/* Visualização em Cartões Mobile (< 640px) */}
              <div className="block sm:hidden divide-y divide-slate-100 dark:divide-[#1A294A] p-2 space-y-2">
                {vendas.map((venda) => (
                  <div
                    key={venda.id}
                    onClick={() => abrirImpressaoVenda(venda.id)}
                    className="p-3.5 rounded-xl bg-white dark:bg-[#0A1328] border border-slate-200/80 dark:border-[#1A294A] space-y-2 shadow-xs cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono font-bold text-xs text-[#0066FF] dark:text-[#3B82F6] bg-[#0066FF]/10 px-2 py-0.5 rounded">
                          #{venda.numero}
                        </span>
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm mt-1">
                          {venda.clientes?.nome || 'Consumidor Final'}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          {new Date(venda.created_at).toLocaleDateString('pt-BR')} •{' '}
                          {venda.vendedores?.nome || 'Sem vendedor'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-slate-900 dark:text-white text-base">
                          {formatCurrency(venda.total || 0)}
                        </p>
                        <div className="mt-1 flex items-center justify-end gap-1">
                          {getFormaPagamentoBadge(venda.forma_pagamento)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-[#1A294A]">
                      {getStatusBadge(venda.status)}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          abrirImpressaoVenda(venda.id)
                        }}
                        className="h-10 min-h-[44px] text-xs font-semibold px-3 rounded-xl"
                      >
                        <Printer className="w-4 h-4 mr-1.5" />
                        Imprimir
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* TABELA DE VENDAS DESKTOP (>= 640px) */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600 dark:text-[#C0C6CF]">
                  <thead className="bg-slate-50/80 dark:bg-[#0A1328]/80 border-b border-slate-200/80 dark:border-[#1A294A] text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="py-3.5 px-4">Nº</th>
                      <th className="py-3.5 px-4">Data</th>
                      <th className="py-3.5 px-4">Cliente</th>
                      <th className="py-3.5 px-4">Vendedor</th>
                      <th className="py-3.5 px-4">Forma Pagto</th>
                      <th className="py-3.5 px-4 text-right">Total</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                      <th className="py-3.5 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#1A294A]">
                    {vendas.map((venda) => (
                      <tr
                        key={venda.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
                        onClick={() => abrirImpressaoVenda(venda.id)}
                      >
                        <td className="py-3.5 px-4">
                          <span className="font-bold font-mono text-[#0066FF] dark:text-[#3B82F6] bg-[#0066FF]/10 px-2 py-0.5 rounded-md text-[11px] border border-[#0066FF]/20">
                            #{venda.numero}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                          {new Date(venda.created_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                          {venda.clientes?.nome ? (
                            <div>
                              <span>{venda.clientes.nome}</span>
                              {venda.clientes.documento && (
                                <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                                  {venda.clientes.documento}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-500 dark:text-slate-400 font-normal italic">
                              Consumidor Final
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                          {venda.vendedores?.nome || (
                            <span className="text-slate-400 dark:text-slate-500">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {getFormaPagamentoBadge(venda.forma_pagamento)}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white tabular-nums text-right text-sm">
                          {formatCurrency(venda.total || 0)}
                        </td>
                        <td className="py-3.5 px-4 text-center">{getStatusBadge(venda.status)}</td>
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => abrirImpressaoVenda(venda.id)}
                            className="h-8 w-8 p-0 text-slate-500 hover:text-[#0066FF] hover:bg-[#0066FF]/10 rounded-lg"
                            title="Imprimir Comprovante de Venda"
                          >
                            <Printer className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* PAGINAÇÃO */}
              <div className="py-3 px-4 bg-slate-50/50 dark:bg-[#0A1328]/50 border-t border-slate-200/80 dark:border-[#1A294A] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 dark:text-[#C0C6CF]">
                <div>
                  Mostrando{' '}
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {Math.min((pagina - 1) * limitePorPagina + 1, totalVendas)}
                  </span>{' '}
                  a{' '}
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {Math.min(pagina * limitePorPagina, totalVendas)}
                  </span>{' '}
                  de{' '}
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {totalVendas}
                  </span>{' '}
                  vendas
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
        </div>
      )}

      {/* ========================================================
          MODO NOVA VENDA (PDV)
          ======================================================== */}
      {modo === 'nova' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* COLUNA ESQUERDA: SELEÇÃO DE PRODUTOS (~60% / 7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-[#1A294A] overflow-hidden">
              <div className="p-4 border-b border-slate-200/80 dark:border-[#1A294A] bg-slate-50/80 dark:bg-[#0A1328]/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-[#0066FF] dark:text-[#3B82F6]" />
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Catálogo de Produtos
                  </h3>
                </div>
                <div className="w-full sm:w-64 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    placeholder="Buscar por nome ou código..."
                    value={buscaProduto}
                    onChange={(e) => setBuscaProduto(e.target.value)}
                    className="pl-9 h-9 text-xs bg-white dark:bg-[#0A1328]/50 border-slate-200 dark:border-[#1A294A] rounded-xl"
                  />
                </div>
              </div>

              <div className="p-4">
                {loadingProdutos ? (
                  <div className="space-y-3 py-6">
                    <TableSkeleton rows={4} cols={3} />
                  </div>
                ) : produtosDisponiveis.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 text-xs">
                    <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">Nenhum produto encontrado</p>
                    <p className="text-slate-400 mt-1">
                      Verifique se existem produtos ativos cadastrados.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[540px] overflow-y-auto pr-1">
                    {produtosDisponiveis.map((prod) => {
                      const estoqueAtual = prod.estoques?.[0]?.quantidade ?? 0
                      const itemNoCarrinho = carrinho.find((c) => c.produto_id === prod.id)
                      const isZerado = estoqueAtual <= 0
                      const isBaixo = estoqueAtual > 0 && estoqueAtual <= (prod.estoque_minimo || 5)

                      return (
                        <div
                          key={prod.id}
                          className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                            itemNoCarrinho
                              ? 'border-[#0066FF] bg-[#0066FF]/10 dark:bg-[#0066FF]/15'
                              : 'border-slate-200/80 dark:border-[#1A294A] bg-white/80 dark:bg-[#0A1328]/60 hover:border-[#0066FF]/50 hover:shadow-xs'
                          }`}
                        >
                          <div>
                            <div className="flex items-start gap-2.5">
                              {prod.foto_url && (
                                <div className="w-12 h-12 rounded-lg border border-slate-200/80 dark:border-[#1A294A] bg-slate-50 dark:bg-[#071126] overflow-hidden flex items-center justify-center shrink-0">
                                  <img
                                    src={prod.foto_url}
                                    alt={prod.nome}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                  />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <h4
                                    className="font-bold text-slate-900 dark:text-white text-xs line-clamp-1"
                                    title={prod.nome}
                                  >
                                    {prod.nome}
                                  </h4>
                                  {prod.codigo && (
                                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-[#1A294A] px-1.5 py-0.5 rounded shrink-0">
                                      {prod.codigo}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 mt-1.5">
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                    Estoque:
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] px-2 py-0.5 font-semibold ${
                                      isZerado
                                        ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30'
                                        : isBaixo
                                          ? 'bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-500/30'
                                          : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                                    }`}
                                  >
                                    {estoqueAtual} {prod.unidade || 'UN'}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-[#1A294A]">
                            <div>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider block">
                                Preço
                              </span>
                              <span className="text-sm font-black text-[#0066FF] dark:text-[#3B82F6] tabular-nums">
                                {formatCurrency(prod.preco_venda || 0)}
                              </span>
                            </div>

                            {itemNoCarrinho ? (
                              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#071126] border border-[#0066FF]/50 rounded-xl p-1 shadow-xs">
                                <button
                                  type="button"
                                  onClick={() => alterarQuantidade(prod.id, -1)}
                                  className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#1A294A] transition-colors"
                                  aria-label="Diminuir quantidade"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="w-7 text-center font-bold text-xs text-[#0066FF] dark:text-[#3B82F6] tabular-nums">
                                  {itemNoCarrinho.quantidade}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => alterarQuantidade(prod.id, 1)}
                                  className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#1A294A] transition-colors"
                                  aria-label="Aumentar quantidade"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => adicionarAoCarrinho(prod)}
                                disabled={isZerado}
                                className={`text-xs h-8 px-3 rounded-xl font-semibold transition-all ${
                                  isZerado
                                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border border-slate-300 dark:border-slate-700 cursor-not-allowed opacity-60'
                                    : 'bg-[#0066FF] hover:bg-[#0052CC] text-white shadow-xs'
                                }`}
                              >
                                <Plus className="w-3.5 h-3.5 mr-1" />
                                Adicionar
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* COLUNA DIREITA: CARRINHO E FINALIZAÇÃO (~40% / 5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-[#1A294A] sticky top-4 overflow-hidden">
              <div className="p-4 border-b border-slate-200/80 dark:border-[#1A294A] bg-slate-50/80 dark:bg-[#0A1328]/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-[#0066FF] dark:text-[#3B82F6]" />
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Resumo da Venda
                  </h3>
                </div>
                {carrinho.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCarrinho([])}
                    className="text-[11px] text-rose-600 hover:text-rose-800 dark:text-rose-400 font-semibold"
                  >
                    Esvaziar
                  </button>
                )}
              </div>

              <div className="p-4 space-y-4">
                {/* SELECT CLIENTE */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#0066FF] dark:text-[#3B82F6]" />
                    Cliente
                  </Label>
                  <Select
                    value={clienteSelecionadoId || 'consumidor_final'}
                    onValueChange={(val) =>
                      setClienteSelecionadoId(val === 'consumidor_final' ? null : val)
                    }
                  >
                    <SelectTrigger className="text-xs h-9 bg-white dark:bg-[#071126] border-slate-200 dark:border-[#1A294A] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#0066FF]/20 focus:border-[#0066FF] rounded-xl">
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 bg-white dark:bg-[#0A1328] border-slate-200 dark:border-[#1A294A]">
                      <div className="p-1 border-b border-slate-100 dark:border-[#1A294A]">
                        <Input
                          placeholder="Pesquisar cliente..."
                          value={buscaCliente}
                          onChange={(e) => setBuscaCliente(e.target.value)}
                          className="h-7 text-xs bg-slate-50 dark:bg-[#071126] border-slate-200 dark:border-[#1A294A]"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                      </div>
                      <SelectItem
                        value="consumidor_final"
                        className="text-xs font-semibold text-slate-800 dark:text-slate-200"
                      >
                        👤 Consumidor Final (Sem cadastro)
                      </SelectItem>
                      {clientesFiltrados.map((cli) => (
                        <SelectItem
                          key={cli.id}
                          value={cli.id}
                          className="text-xs text-slate-700 dark:text-slate-200"
                        >
                          {cli.nome} {cli.documento ? `(${cli.documento})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* SELECT VENDEDOR */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Percent className="w-3.5 h-3.5 text-[#0066FF] dark:text-[#3B82F6]" />
                    Vendedor
                  </Label>
                  <Select
                    value={vendedorSelecionadoId || 'sem_vendedor'}
                    onValueChange={(val) =>
                      setVendedorSelecionadoId(val === 'sem_vendedor' ? null : val)
                    }
                  >
                    <SelectTrigger className="text-xs h-9 bg-white dark:bg-[#071126] border-slate-200 dark:border-[#1A294A] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#0066FF]/20 focus:border-[#0066FF] rounded-xl">
                      <SelectValue placeholder="Selecione o vendedor" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 bg-white dark:bg-[#0A1328] border-slate-200 dark:border-[#1A294A]">
                      <div className="p-1 border-b border-slate-100 dark:border-[#1A294A]">
                        <Input
                          placeholder="Pesquisar vendedor..."
                          value={buscaVendedor}
                          onChange={(e) => setBuscaVendedor(e.target.value)}
                          className="h-7 text-xs bg-slate-50 dark:bg-[#071126] border-slate-200 dark:border-[#1A294A]"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                      </div>
                      <SelectItem
                        value="sem_vendedor"
                        className="text-xs font-semibold text-slate-800 dark:text-slate-200"
                      >
                        Sem vendedor vinculado
                      </SelectItem>
                      {vendedoresFiltrados.map((vend) => (
                        <SelectItem
                          key={vend.id}
                          value={vend.id}
                          className="text-xs text-slate-700 dark:text-slate-200"
                        >
                          {vend.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* LISTA DE ITENS DO CARRINHO */}
                <div className="space-y-2 pt-3 border-t border-slate-200/80 dark:border-[#1A294A]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Itens adicionados ({carrinho.length})
                    </span>
                  </div>

                  {carrinho.length === 0 ? (
                    <div className="py-7 text-center border border-dashed border-slate-200 dark:border-[#1A294A] rounded-xl bg-slate-50/50 dark:bg-[#071126]/50">
                      <ShoppingCart className="w-6 h-6 text-slate-400 dark:text-slate-600 mx-auto mb-1.5" />
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        Adicione produtos para iniciar a venda
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {carrinho.map((item) => (
                        <div
                          key={item.produto_id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 dark:bg-[#071126] border border-slate-200/70 dark:border-[#1A294A] text-xs transition-colors"
                        >
                          <div className="flex-1 min-w-0 mr-2">
                            <p className="font-semibold text-slate-900 dark:text-white truncate">
                              {item.nome}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                              {formatCurrency(item.preco_venda)} un.
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center gap-1 bg-white dark:bg-[#0A1328] border border-slate-200 dark:border-[#1A294A] rounded-lg px-1.5 py-0.5">
                              <button
                                type="button"
                                onClick={() => alterarQuantidade(item.produto_id, -1)}
                                className="w-5 h-5 text-slate-600 dark:text-slate-300 hover:text-[#0066FF] dark:hover:text-[#3B82F6] flex items-center justify-center font-bold"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={item.quantidade}
                                onChange={(e) =>
                                  setQuantidadeItem(item.produto_id, parseInt(e.target.value, 10))
                                }
                                className="w-8 text-center text-xs font-bold text-slate-900 dark:text-white bg-transparent border-0 focus:outline-none p-0 tabular-nums"
                              />
                              <button
                                type="button"
                                onClick={() => alterarQuantidade(item.produto_id, 1)}
                                className="w-5 h-5 text-slate-600 dark:text-slate-300 hover:text-[#0066FF] dark:hover:text-[#3B82F6] flex items-center justify-center font-bold"
                              >
                                +
                              </button>
                            </div>

                            <span className="font-bold text-slate-900 dark:text-white tabular-nums w-18 text-right">
                              {formatCurrency(item.quantidade * item.preco_venda)}
                            </span>

                            <button
                              type="button"
                              onClick={() => removerDoCarrinho(item.produto_id)}
                              className="text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors p-1"
                              title="Remover item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* TOTAIS E DESCONTO */}
                <div className="space-y-2.5 pt-3 border-t border-slate-200/80 dark:border-[#1A294A] text-xs">
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                    <span className="font-medium">Subtotal</span>
                    <span className="font-bold text-slate-900 dark:text-slate-200 tabular-nums">
                      {formatCurrency(subtotalVisual)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">
                      Desconto (R$)
                    </span>
                    <div className="w-28">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={descontoInput}
                        onChange={(e) => handleDescontoChange(e.target.value)}
                        className="h-8 text-xs text-right font-semibold bg-white dark:bg-[#071126] border-slate-200 dark:border-[#1A294A] text-slate-900 dark:text-slate-100 rounded-lg focus:ring-1 focus:ring-[#0066FF]"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center p-3 rounded-xl bg-[#0066FF]/10 dark:bg-[#0066FF]/15 border border-[#0066FF]/30 mt-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-[#0066FF] dark:text-[#3B82F6]">
                      Total a Pagar
                    </span>
                    <span className="text-xl font-black text-[#0066FF] dark:text-white tabular-nums">
                      {formatCurrency(totalVisual)}
                    </span>
                  </div>
                </div>

                {/* CONDICIONAL: AVISOS DO CLIENTE (Limite e Vencidas) */}
                {clienteAvisos && (
                  <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-[#071126] border border-slate-200/80 dark:border-[#1A294A] text-xs">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Limite de Crédito:</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {clienteAvisos.limite
                          ? formatCurrency(clienteAvisos.limite)
                          : 'Não definido'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Saldo em Aberto Atual:</span>
                      <span className="font-bold text-amber-600">
                        {formatCurrency(clienteAvisos.saldoAberto || 0)}
                      </span>
                    </div>
                    {clienteAvisos.temVencida && (
                      <div className="mt-1 p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 flex items-center gap-1.5 text-[11px] font-bold">
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                        <span>Atenção: Este cliente possui parcelas vencidas em atraso!</span>
                      </div>
                    )}
                  </div>
                )}

                {/* MODO DE CONDIÇÃO DE PAGAMENTO */}
                <div className="space-y-2 pt-3 border-t border-slate-200/80 dark:border-[#1A294A]">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Condição de Pagamento
                  </Label>
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-[#071126] rounded-xl text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => setTipoPagamento('simples')}
                      className={`py-1.5 px-2 rounded-lg transition-all ${
                        tipoPagamento === 'simples'
                          ? 'bg-white dark:bg-[#0A1328] font-bold text-[#0066FF] shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      À Vista
                    </button>
                    <button
                      type="button"
                      onClick={() => setTipoPagamento('dividido')}
                      className={`py-1.5 px-2 rounded-lg transition-all ${
                        tipoPagamento === 'dividido'
                          ? 'bg-white dark:bg-[#0A1328] font-bold text-[#0066FF] shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      Dividido
                    </button>
                    {moduloCrediario && (
                      <button
                        type="button"
                        onClick={() => setTipoPagamento('parcelado')}
                        className={`py-1.5 px-2 rounded-lg transition-all ${
                          tipoPagamento === 'parcelado'
                            ? 'bg-white dark:bg-[#0A1328] font-bold text-purple-600 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        Parcelado
                      </button>
                    )}
                  </div>
                </div>

                {/* PAGAMENTO SIMPLES (À VISTA) */}
                {tipoPagamento === 'simples' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Forma de Pagamento
                    </Label>
                    <Select value={formaPagamento} onValueChange={(val) => setFormaPagamento(val)}>
                      <SelectTrigger className="text-xs h-9 bg-white dark:bg-[#071126] border-slate-200 dark:border-[#1A294A] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#0066FF]/20 focus:border-[#0066FF] rounded-xl">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-[#0A1328] border-slate-200 dark:border-[#1A294A]">
                        <SelectItem value="pix" className="text-xs">
                          <div className="flex items-center gap-2">
                            <QrCode className="w-4 h-4 text-blue-500" />
                            <span>PIX (À vista)</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="dinheiro" className="text-xs">
                          <div className="flex items-center gap-2">
                            <Banknote className="w-4 h-4 text-emerald-500" />
                            <span>Dinheiro (À vista)</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="cartao" className="text-xs">
                          <div className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-purple-500" />
                            <span>Cartão Débito / Crédito</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="fiado" className="text-xs">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-amber-500" />
                            <span>Fiado / A Prazo (Gera a Receber)</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    {formaPagamento === 'fiado' && (
                      <div className="space-y-1.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs animate-in fade-in mt-2">
                        <Label className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          Data de Vencimento do Fiado *
                        </Label>
                        <Input
                          type="date"
                          value={vencimento}
                          onChange={(e) => setVencimento(e.target.value)}
                          className="text-xs h-8 bg-white dark:bg-[#071126] border-amber-500/40 text-slate-900 dark:text-slate-100 rounded-lg"
                          required
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* PAGAMENTO DIVIDIDO (VÁRIAS FORMAS) */}
                {tipoPagamento === 'dividido' && (
                  <div className="space-y-2 p-3 bg-slate-50/80 dark:bg-[#071126]/60 rounded-xl border border-slate-200/80 dark:border-[#1A294A]">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Divisão de Pagamentos
                      </Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setPagamentosDivididos((prev) => [
                            ...prev,
                            { id: Date.now().toString(), forma: 'pix', valor: 0 },
                          ])
                        }
                        className="h-7 text-[11px] text-[#0066FF] font-semibold"
                      >
                        + Adicionar Forma
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {pagamentosDivididos.map((pag, idx) => (
                        <div key={pag.id} className="flex items-center gap-2">
                          <Select
                            value={pag.forma}
                            onValueChange={(val) =>
                              setPagamentosDivididos((prev) =>
                                prev.map((p, i) => (i === idx ? { ...p, forma: val } : p)),
                              )
                            }
                          >
                            <SelectTrigger className="h-8 text-xs w-32 bg-white dark:bg-[#0A1328]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="dinheiro">Dinheiro</SelectItem>
                              <SelectItem value="pix">PIX</SelectItem>
                              <SelectItem value="cartao_debito">Débito</SelectItem>
                              <SelectItem value="cartao_credito">Crédito</SelectItem>
                              <SelectItem value="outra">Outra</SelectItem>
                            </SelectContent>
                          </Select>

                          <div className="relative flex-1">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">
                              R$
                            </span>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0,00"
                              value={pag.valor || ''}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value) || 0
                                setPagamentosDivididos((prev) =>
                                  prev.map((p, i) => (i === idx ? { ...p, valor: v } : p)),
                                )
                              }}
                              className="h-8 pl-8 text-xs bg-white dark:bg-[#0A1328] font-bold"
                            />
                          </div>

                          {pagamentosDivididos.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setPagamentosDivididos((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="text-slate-400 hover:text-rose-500 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Resumo da soma dividida */}
                    {(() => {
                      const soma = pagamentosDivididos.reduce(
                        (acc, p) => acc + (Number(p.valor) || 0),
                        0,
                      )
                      const diff = totalVisual - soma
                      const fecha = Math.abs(diff) < 0.01
                      return (
                        <div
                          className={`p-2 rounded-lg text-[11px] flex items-center justify-between font-semibold ${
                            fecha
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          <span>Soma informada: {formatCurrency(soma)}</span>
                          <span>
                            {fecha
                              ? '✓ Total fechado'
                              : `Falta: ${formatCurrency(Math.max(0, diff))}`}
                          </span>
                        </div>
                      )
                    })()}
                  </div>
                )}

                {/* PAGAMENTO PARCELADO (CREDIÁRIO) */}
                {tipoPagamento === 'parcelado' && (
                  <div className="space-y-3 p-3 bg-purple-500/5 dark:bg-purple-950/20 rounded-xl border border-purple-500/25">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-purple-600" />
                      <span className="text-xs font-bold text-purple-900 dark:text-purple-300">
                        Plano de Parcelamento (Crediário)
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                          Valor da Entrada (opcional)
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0,00"
                          value={entradaValor || ''}
                          onChange={(e) => setEntradaValor(parseFloat(e.target.value) || 0)}
                          className="h-8 text-xs bg-white dark:bg-[#0A1328] font-semibold"
                        />
                      </div>
                      {entradaValor > 0 && (
                        <div>
                          <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                            Forma da Entrada
                          </Label>
                          <Select value={entradaForma} onValueChange={setEntradaForma}>
                            <SelectTrigger className="h-8 text-xs bg-white dark:bg-[#0A1328]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="dinheiro">Dinheiro</SelectItem>
                              <SelectItem value="pix">PIX</SelectItem>
                              <SelectItem value="cartao">Cartão</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                          Nº de Parcelas
                        </Label>
                        <Select
                          value={String(numParcelas)}
                          onValueChange={(val) => setNumParcelas(parseInt(val, 10))}
                        >
                          <SelectTrigger className="h-8 text-xs bg-white dark:bg-[#0A1328]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1x (30 dias)</SelectItem>
                            <SelectItem value="2">2x (30/60 dias)</SelectItem>
                            <SelectItem value="3">3x (30/60/90 dias)</SelectItem>
                            <SelectItem value="4">4x</SelectItem>
                            <SelectItem value="5">5x</SelectItem>
                            <SelectItem value="6">6x</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                          Intervalo (dias)
                        </Label>
                        <Input
                          type="number"
                          value={intervaloDias}
                          onChange={(e) => setIntervaloDias(parseInt(e.target.value, 10) || 30)}
                          className="h-8 text-xs bg-white dark:bg-[#0A1328]"
                        />
                      </div>
                    </div>

                    {/* Estimativa de parcelas */}
                    {(() => {
                      const valorFinanc = Math.max(0, totalVisual - entradaValor)
                      const valorBase = Math.floor((valorFinanc / numParcelas) * 100) / 100
                      return (
                        <div className="p-2.5 rounded-lg bg-white/80 dark:bg-[#0A1328]/80 border border-purple-500/20 text-[11px] space-y-1">
                          <p className="font-bold text-purple-900 dark:text-purple-300">
                            Previsão: {numParcelas}x de ~{formatCurrency(valorBase)}
                          </p>
                          <p className="text-slate-500 text-[10px]">
                            * A RPC distribuirá os centavos na última parcela gerando os títulos em
                            contas_receber.
                          </p>
                        </div>
                      )
                    })()}

                    {/* Autorização de Limite (Gerente/Admin) */}
                    {gerentesAutorizadores.length > 0 && (
                      <div className="space-y-1 pt-2 border-t border-purple-500/20 text-xs">
                        <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                          Autorização de Gerente (se estourar limite)
                        </Label>
                        <Select
                          value={autorizadorId || 'nenhum'}
                          onValueChange={(val) => setAutorizadorId(val === 'nenhum' ? null : val)}
                        >
                          <SelectTrigger className="h-8 text-xs bg-white dark:bg-[#0A1328]">
                            <SelectValue placeholder="Selecione o autorizador" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="nenhum">Nenhum autorizador</SelectItem>
                            {gerentesAutorizadores.map((g) => (
                              <SelectItem key={g.id} value={g.id}>
                                {g.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}

                {/* OBSERVAÇÕES */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Observações (opcional)
                  </Label>
                  <Textarea
                    placeholder="Informações adicionais do pedido ou entrega..."
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    rows={2}
                    className="text-xs bg-white dark:bg-[#071126] border-slate-200 dark:border-[#1A294A] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl resize-none focus:ring-2 focus:ring-[#0066FF]/20 focus:border-[#0066FF]"
                  />
                </div>

                {/* FEEDBACK DE ERRO */}
                {erroVenda && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                    <div>
                      <p className="font-bold">Erro na validação da venda</p>
                      <p className="mt-0.5 font-medium">{erroVenda}</p>
                    </div>
                  </div>
                )}

                {/* BOTÃO FINALIZAR VENDA */}
                <Button
                  onClick={handleFinalizarVenda}
                  disabled={carrinho.length === 0 || submetendoVenda}
                  className={`w-full font-bold h-11 text-sm shadow-md transition-all flex items-center justify-center gap-2 rounded-xl ${
                    carrinho.length === 0 || submetendoVenda
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-300 dark:border-slate-700 cursor-not-allowed opacity-70'
                      : 'bg-[#0066FF] hover:bg-[#0052CC] text-white shadow-lg shadow-[#0066FF]/20 active:scale-[0.99]'
                  }`}
                >
                  {submetendoVenda ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Finalizando Venda...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Finalizar Venda • {formatCurrency(totalVisual)}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL RESUMO PÓS-VENDA COM SUCESSO
          ======================================================== */}
      <Dialog
        open={resultadoModal.aberto}
        onOpenChange={(aberto) => {
          if (!aberto) {
            setResultadoModal({ aberto: false })
            limparNovaVenda()
            setModo('listagem')
          }
        }}
      >
        <DialogContent className="sm:max-w-md bg-white dark:bg-[#0A1328]/95 dark:backdrop-blur-xl border border-slate-200/80 dark:border-[#1A294A] rounded-2xl p-6 shadow-2xl">
          <DialogHeader className="pb-3 border-b border-slate-100 dark:border-[#1A294A]">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <DialogTitle className="text-center text-lg font-bold text-slate-900 dark:text-white">
              Venda #{resultadoModal.dados?.numero} finalizada com sucesso!
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-slate-500 dark:text-[#C0C6CF]/80">
              A venda foi registrada atomicamente no banco, os itens foram baixados do estoque e os
              lançamentos foram gerados.
            </DialogDescription>
          </DialogHeader>

          {resultadoModal.dados && (
            <div className="space-y-2 py-3 border-y border-slate-200/80 dark:border-[#1A294A] text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Subtotal dos Itens:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-200 tabular-nums">
                  {formatCurrency(resultadoModal.dados.subtotal)}
                </span>
              </div>
              {resultadoModal.dados.desconto > 0 && (
                <div className="flex justify-between text-rose-600 dark:text-rose-400">
                  <span>Desconto Aplicado:</span>
                  <span className="font-semibold tabular-nums">
                    - {formatCurrency(resultadoModal.dados.desconto)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-slate-900 dark:text-white font-bold text-sm pt-1.5 border-t border-slate-100 dark:border-[#1A294A]">
                <span>Total Final:</span>
                <span className="text-[#0066FF] dark:text-[#3B82F6] font-black tabular-nums">
                  {formatCurrency(resultadoModal.dados.total)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400 pt-1">
                <span>Forma de Pagamento:</span>
                <span className="font-bold uppercase text-slate-900 dark:text-slate-200">
                  {resultadoModal.dados.forma_pagamento}
                </span>
              </div>
              {resultadoModal.dados.comissao > 0 && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/30 mt-2">
                  <span className="font-medium">Comissão do Vendedor:</span>
                  <span className="font-bold tabular-nums">
                    {formatCurrency(resultadoModal.dados.comissao)}
                  </span>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                const vendaId = resultadoModal.dados?.venda_id
                setResultadoModal({ aberto: false })
                limparNovaVenda()
                setModo('listagem')
                if (vendaId) {
                  abrirImpressaoVenda(vendaId)
                }
              }}
              className="w-full sm:w-auto text-xs flex items-center justify-center gap-1.5 border-slate-200 dark:border-[#1A294A] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1A294A] rounded-xl"
            >
              <Printer className="w-3.5 h-3.5 text-[#0066FF] dark:text-[#3B82F6]" />
              Imprimir Venda
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setResultadoModal({ aberto: false })
                limparNovaVenda()
                setModo('listagem')
              }}
              className="w-full sm:w-auto text-xs border-slate-200 dark:border-[#1A294A] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1A294A] rounded-xl"
            >
              Ver Listagem
            </Button>
            <Button
              onClick={() => {
                setResultadoModal({ aberto: false })
                limparNovaVenda()
                setModo('nova')
              }}
              className="w-full sm:w-auto bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-semibold rounded-xl"
            >
              Realizar Outra Venda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================
          MODAL DE IMPRESSÃO DE VENDA
          ======================================================== */}
      {vendaDetalhe && (
        <PrintPreviewDialog
          open={printVendaAberto}
          onOpenChange={setPrintVendaAberto}
          title={`Impressão - Venda #${vendaDetalhe.numero}`}
          showPhotos={showFotosPrint}
          onShowPhotosChange={setShowFotosPrint}
        >
          <VendaPrintDocument
            empresa={{
              nome: empresa?.nome || 'EVO Gestão Comercial',
              nome_fantasia: empresa?.nome_fantasia,
              cnpj: empresa?.cnpj,
              telefone: empresa?.telefone,
              email: empresa?.email,
              logo_url: empresa?.logo_url,
            }}
            venda={vendaDetalhe}
            contasReceber={contasReceberVenda}
            showPhotos={showFotosPrint}
          />
        </PrintPreviewDialog>
      )}
    </div>
  )
}
