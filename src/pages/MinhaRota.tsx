import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { useEmpresa } from '@/hooks/use-empresa'
import { EntregasService, Rota, RotaItemEstoque, RotaPedido } from '@/services/entregas'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import {
  Navigation,
  Truck,
  Package,
  CheckCircle2,
  XCircle,
  MapPin,
  Phone,
  DollarSign,
  UserPlus,
  Receipt,
  ShoppingCart,
  Loader2,
  ExternalLink,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'

export default function MinhaRotaPage() {
  const { usuario } = useAuth()
  const { empresa } = useEmpresa()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [rotaAtiva, setRotaAtiva] = useState<any | null>(null)
  const [itensEstoque, setItensEstoque] = useState<any[]>([])
  const [pedidosRota, setPedidosRota] = useState<any[]>([])

  // Modal Conclusão Entrega
  const [modalEntregaOpen, setModalEntregaOpen] = useState(false)
  const [pedidoSelecionado, setPedidoSelecionado] = useState<RotaPedido | null>(null)
  const [entregueStatus, setEntregueStatus] = useState<boolean>(true)
  const [motivoNaoEntrega, setMotivoNaoEntrega] = useState('')
  const [formaPagamentoEntrega, setFormaPagamentoEntrega] = useState('dinheiro')
  const [processandoEntrega, setProcessandoEntrega] = useState(false)

  // Modal Venda na Rua
  const [modalVendaOpen, setModalVendaOpen] = useState(false)
  const [clientes, setClientes] = useState<any[]>([])
  const [vendaClienteId, setVendaClienteId] = useState('')
  const [vendaItens, setVendaItens] = useState<Array<{ produto_id: string; quantidade: number }>>(
    [],
  )
  const [vendaForma, setVendaForma] = useState('pix')
  const [vendaCondicao, setVendaCondicao] = useState<'a_vista' | 'parcelado'>('a_vista')
  const [vendaEntrada, setVendaEntrada] = useState('0')
  const [vendaParcelas, setVendaParcelas] = useState('1')
  const [vendaObs, setVendaObs] = useState('')
  const [processandoVenda, setProcessandoVenda] = useState(false)

  // Modal Cadastro Rápido de Cliente
  const [modalNovoClienteOpen, setModalNovoClienteOpen] = useState(false)
  const [clienteNome, setClienteNome] = useState('')
  const [clienteTelefone, setClienteTelefone] = useState('')
  const [clienteEndereco, setClienteEndereco] = useState('')
  const [clienteBairro, setClienteBairro] = useState('')
  const [clienteCidade, setClienteCidade] = useState('')
  const [salvandoCliente, setSalvandoCliente] = useState(false)

  const carregarDadosMinhaRota = async () => {
    if (!usuario?.id || !empresa?.id) return
    setLoading(true)
    try {
      const { data: rota, error: rotaErr } = await EntregasService.obterMinhaRotaAtiva(
        usuario.id,
        empresa.id,
      )

      if (rotaErr) throw rotaErr

      if (!rota) {
        setRotaAtiva(null)
        setItensEstoque([])
        setPedidosRota([])
        return
      }

      setRotaAtiva(rota)

      const [estoqueRes, pedidosRes] = await Promise.all([
        EntregasService.listarItensEstoqueRota(rota.id),
        EntregasService.listarPedidosRota(rota.id),
      ])

      setItensEstoque(estoqueRes.data || [])
      setPedidosRota(pedidosRes.data || [])
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar dados da rota',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDadosMinhaRota()
  }, [usuario?.id, empresa?.id])

  // Abrir Modal de Entrega de Pedido
  const abrirModalEntrega = (pedRota: RotaPedido, entregue: boolean) => {
    setPedidoSelecionado(pedRota)
    setEntregueStatus(entregue)
    setMotivoNaoEntrega('')
    setFormaPagamentoEntrega('dinheiro')
    setModalEntregaOpen(true)
  }

  const handleConfirmarEntrega = async () => {
    if (!rotaAtiva || !pedidoSelecionado) return

    if (!entregueStatus && (!motivoNaoEntrega || !motivoNaoEntrega.trim())) {
      toast({
        title: 'Motivo obrigatório',
        description: 'Informe o motivo pelo qual o pedido não foi entregue.',
        variant: 'destructive',
      })
      return
    }

    setProcessandoEntrega(true)
    try {
      const { error } = await EntregasService.concluirEntregaPedidoRota({
        rotaId: rotaAtiva.id,
        pedidoId: pedidoSelecionado.pedido_id,
        entregue: entregueStatus,
        motivoNaoEntrega: motivoNaoEntrega.trim() || null,
        formaPagamento: formaPagamentoEntrega,
      })

      if (error) throw error

      toast({
        title: entregueStatus ? 'Pedido marcado como entregue!' : 'Tentativa registrada',
        description: entregueStatus
          ? 'Venda faturada e estoque do carro atualizado.'
          : 'O pedido retornará ao depósito para conferência no fechamento.',
      })

      setModalEntregaOpen(false)
      carregarDadosMinhaRota()
    } catch (err: any) {
      toast({
        title: 'Erro ao concluir entrega',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setProcessandoEntrega(false)
    }
  }

  // Abrir Venda na Rua
  const abrirModalVenda = async () => {
    if (!empresa?.id) return
    try {
      const { data: clis } = await supabase
        .from('clientes')
        .select('id, nome, telefone, limite_credito')
        .eq('empresa_id', empresa.id)
        .eq('ativo', true)
        .order('nome', { ascending: true })

      setClientes(clis || [])
      setVendaClienteId('')
      setVendaItens([])
      setVendaForma('pix')
      setVendaCondicao('a_vista')
      setVendaEntrada('0')
      setVendaParcelas('1')
      setVendaObs('')
      setModalVendaOpen(true)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar clientes',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  const handleAddVendaItem = (produtoId: string) => {
    if (!produtoId) return
    if (vendaItens.some((i) => i.produto_id === produtoId)) return
    setVendaItens((prev) => [...prev, { produto_id: produtoId, quantidade: 1 }])
  }

  const handleUpdateVendaItemQtd = (produtoId: string, qtd: number) => {
    setVendaItens((prev) =>
      prev.map((i) => (i.produto_id === produtoId ? { ...i, quantidade: Math.max(1, qtd) } : i)),
    )
  }

  const handleRemoveVendaItem = (produtoId: string) => {
    setVendaItens((prev) => prev.filter((i) => i.produto_id !== produtoId))
  }

  const handleFinalizarVendaRua = async () => {
    if (!rotaAtiva) return
    if (vendaItens.length === 0) {
      toast({
        title: 'Nenhum item selecionado',
        description: 'Adicione pelo menos uma cesta para vender.',
        variant: 'destructive',
      })
      return
    }

    setProcessandoVenda(true)
    try {
      const { error } = await EntregasService.venderNaRua({
        rotaId: rotaAtiva.id,
        clienteId: vendaClienteId || null,
        itens: vendaItens,
        formaPagamento: vendaForma,
        condicao: vendaCondicao,
        entradaValor: Number(vendaEntrada) || 0,
        numParcelas: Number(vendaParcelas) || 1,
        observacoes: vendaObs.trim() || null,
      })

      if (error) throw error

      toast({
        title: 'Venda realizada com sucesso!',
        description: 'Baixa efetuada do estoque do carro.',
      })

      setModalVendaOpen(false)
      carregarDadosMinhaRota()
    } catch (err: any) {
      toast({
        title: 'Não foi possível concluir a venda',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setProcessandoVenda(false)
    }
  }

  // Cadastro Rápido de Cliente
  const handleCadastrarCliente = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!empresa?.id || !clienteNome.trim()) return

    setSalvandoCliente(true)
    try {
      const { data, error } = await supabase
        .from('clientes')
        .insert({
          empresa_id: empresa.id,
          nome: clienteNome.trim(),
          telefone: clienteTelefone.trim() || null,
          endereco: clienteEndereco.trim() || null,
          bairro: clienteBairro.trim() || null,
          cidade: clienteCidade.trim() || null,
        })
        .select()
        .single()

      if (error) throw error

      toast({
        title: 'Cliente cadastrado com sucesso!',
        description: data.nome,
      })

      setModalNovoClienteOpen(false)
      setClienteNome('')
      setClienteTelefone('')
      setClienteEndereco('')
      setClienteBairro('')
      setClienteCidade('')

      // Se estava na venda na rua, seleciona ele automaticamente
      if (modalVendaOpen) {
        setClientes((prev) => [data, ...prev])
        setVendaClienteId(data.id)
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao cadastrar cliente',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSalvandoCliente(false)
    }
  }

  // Links Rápidos: WhatsApp & Google Maps
  const abrirWhatsApp = (telefone?: string | null, nome?: string) => {
    if (!telefone) return
    const cleanPhone = telefone.replace(/\D/g, '')
    const url = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(
      `Olá ${nome || 'cliente'}, estou a caminho com a sua cesta!`,
    )}`
    window.open(url, '_blank')
  }

  const abrirMaps = (cli?: any) => {
    if (!cli) return
    const query = [cli.endereco, cli.numero, cli.bairro, cli.cidade].filter(Boolean).join(', ')
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    window.open(url, '_blank')
  }

  return (
    <div className="p-3 sm:p-6 max-w-4xl mx-auto space-y-4 pb-24">
      {/* Cabeçalho Minha Rota */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Navigation className="w-6 h-6 text-[#0066FF]" />
            Minha Rota
          </h1>
          <p className="text-xs text-slate-500 dark:text-[#6E7785]">
            Jornada de entregas e vendas em trânsito
          </p>
        </div>
        <div className="text-right">
          {rotaAtiva ? (
            <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-blue-100 text-[#0066FF] dark:bg-blue-950/40 dark:text-[#3385FF] border border-blue-200 dark:border-blue-900/50">
              Rota #{rotaAtiva.numero} Ativa
            </span>
          ) : (
            <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 dark:bg-[#111F38] text-slate-500">
              Sem Rota em Aberto
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#0066FF]" />
        </div>
      ) : !rotaAtiva ? (
        <div className="bg-white dark:bg-[#0A1328] border border-slate-200 dark:border-[#152342] rounded-2xl p-8 text-center space-y-3">
          <Truck className="w-12 h-12 text-slate-400 dark:text-[#6E7785] mx-auto" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            Nenhuma rota em andamento vinculada a você
          </h3>
          <p className="text-xs text-slate-500 dark:text-[#6E7785] max-w-sm mx-auto">
            Aguarde o despacho e carregamento de uma rota pela gerência para iniciar suas entregas e
            vendas na rua.
          </p>
        </div>
      ) : (
        <>
          {/* Card de Estoque do Carro (Resumo Superior) */}
          <div className="bg-white dark:bg-[#0A1328] border border-slate-200 dark:border-[#152342] rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-[#6E7785] flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-[#0066FF]" /> Estoque no Veículo (
                {rotaAtiva.veiculos?.identificacao})
              </h2>
              <span className="text-xs font-mono text-slate-500">
                Placa: {rotaAtiva.veiculos?.placa}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {itensEstoque.map((it) => {
                const disponivelCarro =
                  it.quantidade_carregada -
                  (it.quantidade_vendida + it.quantidade_entregue + it.quantidade_devolvida)

                return (
                  <div
                    key={it.id}
                    className="p-2.5 bg-slate-50 dark:bg-[#0E1A33] rounded-xl border border-slate-100 dark:border-[#1A2C50] text-center"
                  >
                    <p className="text-[11px] font-medium text-slate-600 dark:text-[#C0C6CF] truncate">
                      {it.produtos?.nome || 'Cesta'}
                    </p>
                    <p className="text-lg font-black text-slate-900 dark:text-white font-mono mt-0.5">
                      {disponivelCarro}
                    </p>
                    <p className="text-[10px] text-slate-400">a bordo</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Botões de Ações Rápidas do Entregador */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              onClick={abrirModalVenda}
              className="min-h-[48px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex flex-col items-center justify-center py-1 cursor-pointer shadow-sm"
            >
              <ShoppingCart className="w-4 h-4 mb-0.5" />
              <span>Vender Aqui</span>
            </Button>

            <Button
              onClick={() => navigate('/app/devedores')}
              variant="outline"
              className="min-h-[48px] border-slate-200 dark:border-[#152342] bg-white dark:bg-[#0A1328] hover:bg-slate-50 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs flex flex-col items-center justify-center py-1 cursor-pointer"
            >
              <Receipt className="w-4 h-4 text-[#0066FF] mb-0.5" />
              <span>Receber Parcela</span>
            </Button>

            <Button
              onClick={() => setModalNovoClienteOpen(true)}
              variant="outline"
              className="min-h-[48px] border-slate-200 dark:border-[#152342] bg-white dark:bg-[#0A1328] hover:bg-slate-50 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs flex flex-col items-center justify-center py-1 cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-emerald-600 mb-0.5" />
              <span>Novo Cliente</span>
            </Button>
          </div>

          {/* Lista de Entregas da Rota (Mobile-First 1 Coluna) */}
          <div className="space-y-3 pt-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-[#6E7785] flex items-center gap-1.5">
              <Package className="w-4 h-4" /> Entregas da Rota ({pedidosRota.length})
            </h2>

            {pedidosRota.length === 0 ? (
              <div className="p-6 bg-white dark:bg-[#0A1328] border border-slate-200 dark:border-[#152342] rounded-2xl text-center text-xs text-slate-500">
                Nenhum pedido vinculado para entrega direta nesta rota. Cestas a bordo disponíveis
                para venda avulsa.
              </div>
            ) : (
              <div className="space-y-3">
                {pedidosRota.map((ped, idx) => {
                  const cliente = ped.pedidos?.clientes
                  const isEntregue = ped.status_entrega === 'entregue'
                  const isNaoEntregue = ped.status_entrega === 'nao_entregue'

                  return (
                    <div
                      key={ped.id}
                      className={`bg-white dark:bg-[#0A1328] border rounded-2xl p-4 shadow-sm space-y-3 transition-colors ${
                        isEntregue
                          ? 'border-emerald-300 dark:border-emerald-800/40 bg-emerald-50/20'
                          : isNaoEntregue
                            ? 'border-red-300 dark:border-red-800/40 bg-red-50/20'
                            : 'border-slate-200 dark:border-[#152342]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-[#111F38] text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center font-mono">
                            {idx + 1}
                          </span>
                          <div>
                            <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                              {cliente?.nome || 'Cliente não identificado'}
                            </h3>
                            <p className="text-xs text-[#0066FF] font-semibold mt-0.5">
                              Pedido #{ped.pedidos?.numero} • Total:{' '}
                              {formatCurrency(ped.pedidos?.total || 0)}
                            </p>
                          </div>
                        </div>

                        <div>
                          {isEntregue ? (
                            <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                              Entregue
                            </span>
                          ) : isNaoEntregue ? (
                            <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400">
                              Não Entregue
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
                              Pendente
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Endereço com botão Google Maps */}
                      <div className="p-2.5 bg-slate-50 dark:bg-[#0E1A33] rounded-xl border border-slate-100 dark:border-[#1A2C50] text-xs space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-slate-600 dark:text-[#C0C6CF]">
                            <p className="font-semibold text-slate-800 dark:text-slate-200">
                              {cliente?.endereco
                                ? `${cliente.endereco}, ${cliente.numero || 'S/N'}`
                                : 'Endereço não cadastrado'}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {cliente?.bairro} — {cliente?.cidade || ''}
                            </p>
                          </div>
                          {cliente?.endereco && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => abrirMaps(cliente)}
                              className="min-h-[36px] px-2.5 text-xs text-[#0066FF] border-[#0066FF]/30 hover:bg-[#0066FF]/10 rounded-lg cursor-pointer shrink-0"
                            >
                              <MapPin className="w-3.5 h-3.5 mr-1" />
                              Maps
                            </Button>
                          )}
                        </div>

                        {/* Itens do Pedido */}
                        <div className="pt-1.5 border-t border-slate-200 dark:border-[#1A2C50] text-[11px] text-slate-500 dark:text-[#6E7785]">
                          Itens:{' '}
                          {ped.pedidos?.itens_pedido
                            ?.map((it) => `${it.quantidade}x ${it.produtos?.nome}`)
                            .join(', ')}
                        </div>

                        {isNaoEntregue && ped.motivo_nao_entrega && (
                          <div className="pt-1 text-[11px] font-semibold text-red-600 dark:text-red-400">
                            Motivo: {ped.motivo_nao_entrega}
                          </div>
                        )}
                      </div>

                      {/* Botões de Ação na Entrega */}
                      {!isEntregue && (
                        <div className="flex gap-2 pt-1">
                          {cliente?.telefone && (
                            <Button
                              variant="outline"
                              onClick={() => abrirWhatsApp(cliente?.telefone, cliente?.nome)}
                              className="min-h-[44px] px-3 border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded-xl cursor-pointer"
                              title="Abrir WhatsApp"
                            >
                              <Phone className="w-4 h-4" />
                            </Button>
                          )}

                          <Button
                            variant="outline"
                            onClick={() => abrirModalEntrega(ped, false)}
                            className="flex-1 min-h-[44px] border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 font-semibold rounded-xl text-xs cursor-pointer"
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Não Entregue
                          </Button>

                          <Button
                            onClick={() => abrirModalEntrega(ped, true)}
                            className="flex-1 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-sm"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Entregue
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal Concluir Entrega / Registrar Não Entrega */}
      <Dialog open={modalEntregaOpen} onOpenChange={setModalEntregaOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-[#0A1328] border border-slate-200 dark:border-[#152342] rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">
              {entregueStatus ? 'Confirmar Entrega do Pedido' : 'Registrar Não Entrega'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 bg-slate-50 dark:bg-[#0E1A33] rounded-xl border border-slate-100 dark:border-[#1A2C50] text-xs space-y-1">
              <p className="font-bold text-slate-800 dark:text-slate-200">
                {pedidoSelecionado?.pedidos?.clientes?.nome}
              </p>
              <p className="text-[#0066FF] font-semibold">
                Pedido #{pedidoSelecionado?.pedidos?.numero} • Total:{' '}
                {formatCurrency(pedidoSelecionado?.pedidos?.total || 0)}
              </p>
            </div>

            {entregueStatus ? (
              <div className="space-y-3">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Forma de Pagamento na Entrega
                </Label>
                <Select value={formaPagamentoEntrega} onValueChange={setFormaPagamentoEntrega}>
                  <SelectTrigger className="min-h-[44px] bg-white dark:bg-[#0E1A33] border-slate-200 dark:border-[#1A2C50]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                    <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                    <SelectItem value="crediario">Crediário / Já Faturado</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-slate-500">
                  Ao confirmar, o pedido é faturado como venda e baixado do veículo.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Motivo da Não Entrega *
                </Label>
                <Textarea
                  value={motivoNaoEntrega}
                  onChange={(e) => setMotivoNaoEntrega(e.target.value)}
                  placeholder="Ex: Cliente ausente, endereço não localizado, recusou receber..."
                  className="min-h-[80px] bg-white dark:bg-[#0E1A33] border-slate-200 dark:border-[#1A2C50] text-xs"
                  required
                />
                <p className="text-[11px] text-slate-500">
                  A cesta segue no veículo e sua reserva retornará ao depósito no fechamento.
                </p>
              </div>
            )}

            <DialogFooter className="pt-3 border-t border-slate-100 dark:border-[#152342] flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={processandoEntrega}
                onClick={() => setModalEntregaOpen(false)}
                className="flex-1 min-h-[44px] rounded-xl cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={processandoEntrega}
                onClick={handleConfirmarEntrega}
                className={`flex-1 min-h-[44px] text-white font-bold rounded-xl cursor-pointer ${
                  entregueStatus
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {processandoEntrega ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    Processando...
                  </>
                ) : entregueStatus ? (
                  'Concluir Entrega'
                ) : (
                  'Salvar Motivo'
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Vender na Rua */}
      <Dialog open={modalVendaOpen} onOpenChange={setModalVendaOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto bg-white dark:bg-[#0A1328] border border-slate-200 dark:border-[#152342] rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-emerald-600" />
              Venda na Rua (Estoque do Carro)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Cliente
                </Label>
                <button
                  type="button"
                  onClick={() => setModalNovoClienteOpen(true)}
                  className="text-xs text-[#0066FF] hover:underline font-semibold"
                >
                  + Cadastrar Novo
                </button>
              </div>
              <Select value={vendaClienteId} onValueChange={setVendaClienteId}>
                <SelectTrigger className="min-h-[44px] bg-white dark:bg-[#0E1A33] border-slate-200 dark:border-[#1A2C50] text-xs">
                  <SelectValue placeholder="Selecione o cliente (ou venda avulsa)" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome} {c.telefone ? `(${c.telefone})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Seleção de Cestas do Veículo */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Cestas Disponíveis a Bordo
              </Label>
              <Select onValueChange={handleAddVendaItem}>
                <SelectTrigger className="min-h-[44px] bg-white dark:bg-[#0E1A33] border-slate-200 dark:border-[#1A2C50] text-xs">
                  <SelectValue placeholder="Adicionar cesta do veículo..." />
                </SelectTrigger>
                <SelectContent>
                  {itensEstoque.map((it) => {
                    const disp =
                      it.quantidade_carregada -
                      (it.quantidade_vendida + it.quantidade_entregue + it.quantidade_devolvida)
                    return (
                      <SelectItem key={it.produto_id} value={it.produto_id} disabled={disp <= 0}>
                        {it.produtos?.nome} ({disp} no carro) —{' '}
                        {formatCurrency(it.produtos?.preco_venda || 0)}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>

              {vendaItens.length > 0 && (
                <div className="space-y-2 pt-1">
                  {vendaItens.map((item) => {
                    const itEst = itensEstoque.find((i) => i.produto_id === item.produto_id)
                    const disp =
                      (itEst?.quantidade_carregada || 0) -
                      ((itEst?.quantidade_vendida || 0) +
                        (itEst?.quantidade_entregue || 0) +
                        (itEst?.quantidade_devolvida || 0))

                    return (
                      <div
                        key={item.produto_id}
                        className="p-2.5 bg-slate-50 dark:bg-[#0E1A33] rounded-xl border border-slate-200 dark:border-[#1A2C50] flex items-center justify-between text-xs"
                      >
                        <span className="font-semibold truncate">{itEst?.produtos?.nome}</span>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            inputMode="numeric"
                            min="1"
                            max={disp}
                            value={item.quantidade}
                            onChange={(e) =>
                              handleUpdateVendaItemQtd(item.produto_id, Number(e.target.value))
                            }
                            className="w-16 min-h-[38px] text-center font-mono font-bold"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveVendaItem(item.produto_id)}
                            className="text-red-500 min-h-[38px] px-2"
                          >
                            X
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Condição e Pagamento */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Condição
                </Label>
                <Select value={vendaCondicao} onValueChange={(v: any) => setVendaCondicao(v)}>
                  <SelectTrigger className="min-h-[44px] bg-white dark:bg-[#0E1A33] border-slate-200 dark:border-[#1A2C50] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a_vista">À Vista</SelectItem>
                    <SelectItem value="parcelado">Parcelado (Crediário)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Forma
                </Label>
                <Select value={vendaForma} onValueChange={setVendaForma}>
                  <SelectTrigger className="min-h-[44px] bg-white dark:bg-[#0E1A33] border-slate-200 dark:border-[#1A2C50] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="cartao_debito">Débito</SelectItem>
                    <SelectItem value="cartao_credito">Crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {vendaCondicao === 'parcelado' && (
              <div className="grid grid-cols-2 gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-900/50">
                <div>
                  <Label className="text-xs font-semibold">Entrada (R$)</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="0.01"
                    value={vendaEntrada}
                    onChange={(e) => setVendaEntrada(e.target.value)}
                    className="mt-1 min-h-[40px] font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Nº Parcelas</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="12"
                    value={vendaParcelas}
                    onChange={(e) => setVendaParcelas(e.target.value)}
                    className="mt-1 min-h-[40px] font-mono text-center"
                  />
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Observações
              </Label>
              <Input
                value={vendaObs}
                onChange={(e) => setVendaObs(e.target.value)}
                placeholder="Ex: Entregue no portão"
                className="mt-1 min-h-[44px] bg-white dark:bg-[#0E1A33] border-slate-200 dark:border-[#1A2C50] text-xs"
              />
            </div>

            <DialogFooter className="pt-3 border-t border-slate-100 dark:border-[#152342] flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={processandoVenda}
                onClick={() => setModalVendaOpen(false)}
                className="flex-1 min-h-[44px] rounded-xl cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={processandoVenda}
                onClick={handleFinalizarVendaRua}
                className="flex-1 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl cursor-pointer"
              >
                {processandoVenda ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    Vendendo...
                  </>
                ) : (
                  'Concluir Venda'
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Cadastro Rápido de Cliente */}
      <Dialog open={modalNovoClienteOpen} onOpenChange={setModalNovoClienteOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-[#0A1328] border border-slate-200 dark:border-[#152342] rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-600" />
              Cadastro Rápido de Cliente
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCadastrarCliente} className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-semibold">Nome Completo *</Label>
              <Input
                value={clienteNome}
                onChange={(e) => setClienteNome(e.target.value)}
                placeholder="Nome do cliente"
                className="mt-1 min-h-[44px]"
                required
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Telefone / WhatsApp</Label>
              <Input
                value={clienteTelefone}
                onChange={(e) => setClienteTelefone(e.target.value)}
                placeholder="(00) 00000-0000"
                className="mt-1 min-h-[44px]"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Endereço</Label>
              <Input
                value={clienteEndereco}
                onChange={(e) => setClienteEndereco(e.target.value)}
                placeholder="Rua, número, complemento"
                className="mt-1 min-h-[44px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold">Bairro</Label>
                <Input
                  value={clienteBairro}
                  onChange={(e) => setClienteBairro(e.target.value)}
                  placeholder="Bairro"
                  className="mt-1 min-h-[44px]"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Cidade</Label>
                <Input
                  value={clienteCidade}
                  onChange={(e) => setClienteCidade(e.target.value)}
                  placeholder="Cidade"
                  className="mt-1 min-h-[44px]"
                />
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-slate-100 dark:border-[#152342] flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={salvandoCliente}
                onClick={() => setModalNovoClienteOpen(false)}
                className="flex-1 min-h-[44px] rounded-xl cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={salvandoCliente}
                className="flex-1 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl cursor-pointer"
              >
                {salvandoCliente ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Cliente'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
