import React, { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useEmpresa } from '@/hooks/use-empresa'
import { EntregasService, Rota, Veiculo, RotaItemEstoque, RotaPedido } from '@/services/entregas'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/utils'
import {
  MapPin,
  Plus,
  Play,
  CheckCircle,
  Truck,
  User,
  Calendar,
  AlertTriangle,
  Loader2,
  Package,
  Layers,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'

export default function RotasPage() {
  const { usuario } = useAuth()
  const { empresa } = useEmpresa()

  const [rotas, setRotas] = useState<Rota[]>([])
  const [loading, setLoading] = useState(true)

  // Criar Rota
  const [modalCriarOpen, setModalCriarOpen] = useState(false)
  const [criando, setCriando] = useState(false)
  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [entregadores, setEntregadores] = useState<any[]>([])
  const [novoVeiculoId, setNovoVeiculoId] = useState('')
  const [novoResponsavelId, setNovoResponsavelId] = useState('')
  const [novaData, setNovaData] = useState(() => new Date().toISOString().split('T')[0])
  const [novasObs, setNovasObs] = useState('')

  // Carregar Veículo / Despacho
  const [modalCarregarOpen, setModalCarregarOpen] = useState(false)
  const [rotaCarregando, setRotaCarregando] = useState<Rota | null>(null)
  const [despachando, setDespachando] = useState(false)
  const [produtosDisponiveis, setProdutosDisponiveis] = useState<any[]>([])
  const [itensAvulsos, setItensAvulsos] = useState<
    Array<{ produto_id: string; quantidade: number }>
  >([])
  const [pedidosPendentes, setPedidosPendentes] = useState<any[]>([])
  const [pedidosSelecionados, setPedidosSelecionados] = useState<string[]>([])

  // Fechamento e Acerto
  const [modalFecharOpen, setModalFecharOpen] = useState(false)
  const [rotaFechando, setRotaFechando] = useState<Rota | null>(null)
  const [itensConferencia, setItensConferencia] = useState<RotaItemEstoque[]>([])
  const [qtdsConferidas, setQtdsConferidas] = useState<Record<string, number>>({})
  const [obsFechamento, setObsFechamento] = useState('')
  const [fechando, setFechando] = useState(false)
  const [resumoFechamento, setResumoFechamento] = useState<any | null>(null)

  const carregarRotas = async () => {
    if (!empresa?.id) return
    setLoading(true)
    try {
      const { data, error } = await EntregasService.listarRotas(empresa.id)
      if (error) throw error
      setRotas(data || [])
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar rotas',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarRotas()
  }, [empresa?.id])

  // Abrir Modal Criar Rota
  const abrirModalCriar = async () => {
    if (!empresa?.id) return
    try {
      const [veicRes, usersRes] = await Promise.all([
        EntregasService.listarVeiculos(empresa.id),
        supabase
          .from('usuarios')
          .select('id, nome, perfil')
          .eq('empresa_id', empresa.id)
          .eq('ativo', true)
          .in('perfil', ['entregador', 'vendedor', 'gerente', 'admin', 'master'])
          .order('nome', { ascending: true }),
      ])

      setVeiculos((veicRes.data || []).filter((v) => v.ativo))
      setEntregadores(usersRes.data || [])
      setNovoVeiculoId(veicRes.data?.[0]?.id || '')
      setNovoResponsavelId(usuario?.id || '')
      setNovaData(new Date().toISOString().split('T')[0])
      setNovasObs('')
      setModalCriarOpen(true)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar opções',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  const handleCriarRota = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!empresa?.id || !novoVeiculoId || !novoResponsavelId) {
      toast({
        title: 'Atenção',
        description: 'Selecione o veículo e o responsável.',
        variant: 'destructive',
      })
      return
    }

    setCriando(true)
    try {
      const { error } = await EntregasService.criarRota({
        empresa_id: empresa.id,
        veiculo_id: novoVeiculoId,
        responsavel_usuario_id: novoResponsavelId,
        data: novaData,
        observacoes: novasObs,
        created_by: usuario?.id,
      })
      if (error) throw error
      toast({ title: 'Rota criada com sucesso!' })
      setModalCriarOpen(false)
      carregarRotas()
    } catch (err: any) {
      toast({
        title: 'Erro ao criar rota',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setCriando(false)
    }
  }

  // Abrir Modal Carregar / Despachar
  const abrirModalCarregar = async (rota: Rota) => {
    if (!empresa?.id) return
    setRotaCarregando(rota)
    try {
      // Buscar cestas/produtos disponíveis no depósito
      const [prodRes, pedRes] = await Promise.all([
        supabase
          .from('produtos')
          .select('id, nome, preco_venda, tipo_item, estoques(quantidade, quantidade_reservada)')
          .eq('empresa_id', empresa.id)
          .eq('ativo', true)
          .order('nome', { ascending: true }),
        supabase
          .from('pedidos')
          .select('id, numero, total, status, clientes(nome, bairro, cidade)')
          .eq('empresa_id', empresa.id)
          .in('status', ['pendente', 'confirmado'])
          .order('numero', { ascending: true }),
      ])

      const produtosComEstoque = (prodRes.data || []).map((p: any) => {
        const est = p.estoques?.[0]
        const disp = est ? (est.quantidade || 0) - (est.quantidade_reservada || 0) : 0
        return {
          id: p.id,
          nome: p.nome,
          preco_venda: p.preco_venda,
          disponivel: Math.max(0, disp),
        }
      })

      setProdutosDisponiveis(produtosComEstoque)
      setItensAvulsos([])
      setPedidosPendentes(pedRes.data || [])
      setPedidosSelecionados([])
      setModalCarregarOpen(true)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar dados de despacho',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  const handleAddItemAvulso = (produtoId: string) => {
    if (!produtoId) return
    if (itensAvulsos.some((i) => i.produto_id === produtoId)) return
    setItensAvulsos((prev) => [...prev, { produto_id: produtoId, quantidade: 1 }])
  }

  const handleUpdateItemQtd = (produtoId: string, qtd: number) => {
    setItensAvulsos((prev) =>
      prev.map((i) => (i.produto_id === produtoId ? { ...i, quantidade: Math.max(1, qtd) } : i)),
    )
  }

  const handleRemoveItemAvulso = (produtoId: string) => {
    setItensAvulsos((prev) => prev.filter((i) => i.produto_id !== produtoId))
  }

  const togglePedidoSelecionado = (id: string) => {
    setPedidosSelecionados((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    )
  }

  const handleDespacharCarregamento = async () => {
    if (!rotaCarregando) return
    setDespachando(true)
    try {
      const { data, error } = await EntregasService.carregarVeiculoRota({
        rotaId: rotaCarregando.id,
        itens: itensAvulsos,
        pedidoIds: pedidosSelecionados,
      })

      if (error) throw error

      toast({
        title: 'Rota despachada!',
        description: `Carregadas ${data?.total_cestas_carregadas || 0} cestas. Rota em andamento.`,
      })

      setModalCarregarOpen(false)
      carregarRotas()
    } catch (err: any) {
      toast({
        title: 'Erro ao despachar rota',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setDespachando(false)
    }
  }

  // Abrir Modal Fechamento
  const abrirModalFechar = async (rota: Rota) => {
    setRotaFechando(rota)
    setObsFechamento('')
    setResumoFechamento(null)
    try {
      const { data, error } = await EntregasService.listarItensEstoqueRota(rota.id)
      if (error) throw error

      const lista = data || []
      setItensConferencia(lista)

      // Sugestão padrão: o esperado
      const initialMap: Record<string, number> = {}
      for (const item of lista) {
        const esperado = Math.max(
          0,
          item.quantidade_carregada - (item.quantidade_vendida + item.quantidade_entregue),
        )
        initialMap[item.produto_id] = esperado
      }
      setQtdsConferidas(initialMap)
      setModalFecharOpen(true)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar conferência',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  const handleConcluirFechamento = async () => {
    if (!rotaFechando) return
    setFechando(true)
    try {
      const conferenciaArray = Object.entries(qtdsConferidas).map(([produto_id, quantidade]) => ({
        produto_id,
        quantidade: Number(quantidade) || 0,
      }))

      const { data, error } = await EntregasService.fecharRotaAcerto({
        rotaId: rotaFechando.id,
        conferencia: conferenciaArray,
        observacoes: obsFechamento.trim() || null,
      })

      if (error) throw error

      setResumoFechamento(data)
      toast({ title: 'Rota finalizada e acerto concluído!' })
      carregarRotas()
    } catch (err: any) {
      toast({
        title: 'Erro ao fechar rota',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setFechando(false)
    }
  }

  const podeGerenciar = ['master', 'admin', 'gerente'].includes(usuario?.perfil || '')

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <MapPin className="w-7 h-7 text-[#0066FF]" />
            Gestão de Rotas
          </h1>
          <p className="text-sm text-slate-500 dark:text-[#6E7785] mt-1">
            Planejamento, carregamento de cestas do depósito para os veículos e acerto de fechamento
          </p>
        </div>
        {podeGerenciar && (
          <Button
            onClick={abrirModalCriar}
            className="bg-[#0066FF] hover:bg-[#0052CC] text-white min-h-[44px] px-4 font-semibold rounded-xl shadow-md cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-5 h-5 mr-1.5" />
            Nova Rota
          </Button>
        )}
      </div>

      {/* Listagem Mobile-First */}
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#0066FF]" />
        </div>
      ) : rotas.length === 0 ? (
        <div className="bg-white dark:bg-[#0A1328] border border-slate-200 dark:border-[#152342] rounded-2xl p-10 text-center space-y-3">
          <MapPin className="w-12 h-12 text-slate-400 dark:text-[#6E7785] mx-auto" />
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
            Nenhuma rota cadastrada
          </h3>
          <p className="text-xs text-slate-500 dark:text-[#6E7785] max-w-sm mx-auto">
            Crie rotas para designar entregadores, despachar pedidos e controlar o estoque nos
            veículos.
          </p>
          {podeGerenciar && (
            <Button
              onClick={abrirModalCriar}
              className="mt-2 bg-[#0066FF] hover:bg-[#0052CC] text-white min-h-[44px] cursor-pointer"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Criar Primeira Rota
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rotas.map((rota) => {
            const statusConfig = {
              aberta: {
                label: 'Aberta / Aguardando Carga',
                color:
                  'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200',
              },
              em_andamento: {
                label: 'Em Andamento na Rua',
                color:
                  'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200',
              },
              finalizada: {
                label: 'Finalizada / Acerto Concluído',
                color:
                  'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200',
              },
            }[rota.status] || { label: rota.status, color: 'bg-slate-100 text-slate-700' }

            return (
              <div
                key={rota.id}
                className="bg-white dark:bg-[#0A1328] border border-slate-200 dark:border-[#152342] rounded-2xl p-5 shadow-sm space-y-4 hover:border-[#0066FF]/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>Rota #{rota.numero}</span>
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-[#6E7785] mt-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{new Date(rota.data + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border ${statusConfig.color}`}
                  >
                    {statusConfig.label}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-2.5 bg-slate-50 dark:bg-[#0E1A33] rounded-xl border border-slate-100 dark:border-[#1A2C50] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-[#6E7785] flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5" /> Veículo:
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {rota.veiculos?.identificacao} ({rota.veiculos?.placa})
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-[#6E7785] flex items-center gap-1">
                        <User className="w-3.5 h-3.5" /> Responsável:
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {rota.usuarios?.nome || 'Não definido'}
                      </span>
                    </div>
                  </div>

                  {rota.observacoes && (
                    <p className="text-slate-600 dark:text-[#C0C6CF] italic line-clamp-2">
                      "{rota.observacoes}"
                    </p>
                  )}
                </div>

                {podeGerenciar && (
                  <div className="pt-2 flex flex-col gap-2">
                    {rota.status === 'aberta' && (
                      <Button
                        onClick={() => abrirModalCarregar(rota)}
                        className="w-full bg-[#0066FF] hover:bg-[#0052CC] text-white min-h-[44px] font-semibold rounded-xl cursor-pointer"
                      >
                        <Play className="w-4 h-4 mr-1.5" />
                        Carregar e Iniciar Rota
                      </Button>
                    )}

                    {rota.status === 'em_andamento' && (
                      <Button
                        onClick={() => abrirModalFechar(rota)}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white min-h-[44px] font-semibold rounded-xl cursor-pointer"
                      >
                        <CheckCircle className="w-4 h-4 mr-1.5" />
                        Fechar Rota & Fazer Acerto
                      </Button>
                    )}

                    {rota.status === 'finalizada' && (
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#0E1A33] border border-slate-100 dark:border-[#1A2C50] text-[11px] text-center text-slate-500 dark:text-[#6E7785]">
                        Fechada em{' '}
                        {rota.horario_fechamento
                          ? new Date(rota.horario_fechamento).toLocaleString('pt-BR')
                          : 'conclusão'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Criar Rota */}
      <Dialog open={modalCriarOpen} onOpenChange={setModalCriarOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-[#0A1328] border border-slate-200 dark:border-[#152342] rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">
              Nova Rota de Entrega
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCriarRota} className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Data da Rota *
              </Label>
              <Input
                type="date"
                value={novaData}
                onChange={(e) => setNovaData(e.target.value)}
                className="mt-1 min-h-[44px] bg-white dark:bg-[#0E1A33] border-slate-200 dark:border-[#1A2C50]"
                required
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Veículo *
              </Label>
              <Select value={novoVeiculoId} onValueChange={setNovoVeiculoId}>
                <SelectTrigger className="mt-1 min-h-[44px] bg-white dark:bg-[#0E1A33] border-slate-200 dark:border-[#1A2C50]">
                  <SelectValue placeholder="Selecione o veículo" />
                </SelectTrigger>
                <SelectContent>
                  {veiculos.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.identificacao} ({v.placa}) - Cap: {v.capacidade_cestas}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Responsável (Entregador / Vendedor) *
              </Label>
              <Select value={novoResponsavelId} onValueChange={setNovoResponsavelId}>
                <SelectTrigger className="mt-1 min-h-[44px] bg-white dark:bg-[#0E1A33] border-slate-200 dark:border-[#1A2C50]">
                  <SelectValue placeholder="Selecione o responsável" />
                </SelectTrigger>
                <SelectContent>
                  {entregadores.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome} ({u.perfil})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Observações
              </Label>
              <Textarea
                value={novasObs}
                onChange={(e) => setNovasObs(e.target.value)}
                placeholder="Ex: Rota Centro / Bairro Novo"
                className="mt-1 min-h-[80px] bg-white dark:bg-[#0E1A33] border-slate-200 dark:border-[#1A2C50]"
              />
            </div>

            <DialogFooter className="pt-3 border-t border-slate-100 dark:border-[#152342] flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={criando}
                onClick={() => setModalCriarOpen(false)}
                className="flex-1 min-h-[44px] rounded-xl cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={criando}
                className="flex-1 min-h-[44px] bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold rounded-xl cursor-pointer"
              >
                {criando ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Criar Rota'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Carregar e Despachar Rota */}
      <Dialog open={modalCarregarOpen} onOpenChange={setModalCarregarOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-[#0A1328] border border-slate-200 dark:border-[#152342] rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-[#0066FF]" />
              Carregar Rota #{rotaCarregando?.numero}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl text-xs text-blue-900 dark:text-blue-300">
              As cestas são transferidas diretamente do saldo <b>disponível</b> do depósito (físico
              menos reservado) para o veículo da rota com movimentação auditada de transferência.
            </div>

            {/* 1. Seleção de Pedidos a Entregar */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-[#6E7785] flex items-center gap-1.5">
                <Package className="w-4 h-4" /> 1. Pedidos para Entregar nesta Rota
              </h4>
              {pedidosPendentes.length === 0 ? (
                <p className="text-xs text-slate-500 italic">
                  Nenhum pedido pendente ou confirmado aguardando entrega no momento.
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {pedidosPendentes.map((ped) => {
                    const isSelected = pedidosSelecionados.includes(ped.id)
                    return (
                      <div
                        key={ped.id}
                        onClick={() => togglePedidoSelecionado(ped.id)}
                        className={`p-3 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[#0066FF]/10 border-[#0066FF] text-[#0066FF] dark:text-[#3385FF] font-semibold'
                            : 'bg-white dark:bg-[#0E1A33] border-slate-200 dark:border-[#1A2C50] text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div>
                          <p className="font-bold">
                            Pedido #{ped.numero} — {ped.clientes?.nome}
                          </p>
                          <p className="text-[11px] opacity-75">
                            {ped.clientes?.bairro || 'Sem bairro'} • Total:{' '}
                            {formatCurrency(ped.total)}
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 rounded text-[#0066FF] focus:ring-[#0066FF]"
                        />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 2. Cestas Avulsas para Venda Direta na Rua */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-[#6E7785] flex items-center gap-1.5">
                <Layers className="w-4 h-4" /> 2. Cestas Avulsas para Venda na Rua
              </h4>

              <div className="flex gap-2">
                <Select onValueChange={handleAddItemAvulso}>
                  <SelectTrigger className="flex-1 min-h-[44px] bg-white dark:bg-[#0E1A33] border-slate-200 dark:border-[#1A2C50] text-xs">
                    <SelectValue placeholder="Adicionar cesta avulsa do depósito..." />
                  </SelectTrigger>
                  <SelectContent>
                    {produtosDisponiveis.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome} (Disp: {p.disponivel} un)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {itensAvulsos.length > 0 && (
                <div className="space-y-2">
                  {itensAvulsos.map((item) => {
                    const prod = produtosDisponiveis.find((p) => p.id === item.produto_id)
                    return (
                      <div
                        key={item.produto_id}
                        className="p-3 bg-slate-50 dark:bg-[#0E1A33] rounded-xl border border-slate-200 dark:border-[#1A2C50] flex items-center justify-between gap-3 text-xs"
                      >
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {prod?.nome}
                        </span>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            inputMode="numeric"
                            min="1"
                            max={prod?.disponivel || 999}
                            value={item.quantidade}
                            onChange={(e) =>
                              handleUpdateItemQtd(item.produto_id, Number(e.target.value))
                            }
                            className="w-20 min-h-[38px] text-center font-mono font-bold"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveItemAvulso(item.produto_id)}
                            className="text-red-500 hover:text-red-700 min-h-[38px] px-2 cursor-pointer"
                          >
                            Remover
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <DialogFooter className="pt-4 border-t border-slate-100 dark:border-[#152342] flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={despachando}
                onClick={() => setModalCarregarOpen(false)}
                className="flex-1 min-h-[44px] rounded-xl cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={despachando}
                onClick={handleDespacharCarregamento}
                className="flex-1 min-h-[44px] bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold rounded-xl cursor-pointer"
              >
                {despachando ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    Despachando...
                  </>
                ) : (
                  'Confirmar Carregamento e Saída'
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Fechamento e Acerto */}
      <Dialog open={modalFecharOpen} onOpenChange={setModalFecharOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto bg-white dark:bg-[#0A1328] border border-slate-200 dark:border-[#152342] rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              Fechamento & Acerto da Rota #{rotaFechando?.numero}
            </DialogTitle>
          </DialogHeader>

          {resumoFechamento ? (
            <div className="space-y-4 py-2">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl text-center space-y-1">
                <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto" />
                <h3 className="text-base font-bold text-emerald-900 dark:text-emerald-300">
                  Rota Finalizada com Sucesso!
                </h3>
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  O estoque de retorno foi reintegrado ao depósito e as reservas pendentes foram
                  atualizadas.
                </p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-[#0E1A33] rounded-2xl border border-slate-200 dark:border-[#1A2C50] space-y-3 text-xs">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px]">
                  Resumo de Estoque Físico
                </h4>
                <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-[#C0C6CF]">
                  <div>
                    Carregadas: <b>{resumoFechamento.resumo_estoque?.carregadas}</b>
                  </div>
                  <div>
                    Vendidas na Rua: <b>{resumoFechamento.resumo_estoque?.vendidas}</b>
                  </div>
                  <div>
                    Entregues: <b>{resumoFechamento.resumo_estoque?.entregues}</b>
                  </div>
                  <div>
                    Devolvidas ao Depósito: <b>{resumoFechamento.resumo_estoque?.devolvidas}</b>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-[#1A2C50]">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] mb-2">
                    Resumo Financeiro da Rota
                  </h4>
                  <div className="space-y-1 text-slate-600 dark:text-[#C0C6CF]">
                    <div className="flex justify-between">
                      <span>Total Recebido à Vista:</span>
                      <span className="font-bold text-emerald-600">
                        {formatCurrency(resumoFechamento.resumo_financeiro?.total_recebido || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Parcelado / Crediário:</span>
                      <span className="font-bold text-blue-600">
                        {formatCurrency(resumoFechamento.resumo_financeiro?.total_parcelado || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  onClick={() => setModalFecharOpen(false)}
                  className="w-full min-h-[44px] bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold rounded-xl cursor-pointer"
                >
                  Concluir e Fechar
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-5 py-2">
              <p className="text-xs text-slate-500 dark:text-[#6E7785]">
                Confira a quantidade física de cestas que retornaram no veículo. O sistema fará a
                reintegração automática ao depósito e registrará auditoria se houver divergência.
              </p>

              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Conferência de Cestas Físicas Retornadas
                </h4>

                {itensConferencia.map((item) => {
                  const esperado = Math.max(
                    0,
                    item.quantidade_carregada -
                      (item.quantidade_vendida + item.quantidade_entregue),
                  )
                  const conferido = qtdsConferidas[item.produto_id] ?? esperado
                  const divergencia = conferido - esperado

                  return (
                    <div
                      key={item.produto_id}
                      className="p-3 bg-slate-50 dark:bg-[#0E1A33] rounded-xl border border-slate-200 dark:border-[#1A2C50] flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200">
                          {item.produtos?.nome || 'Cesta'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Carregado: {item.quantidade_carregada} | Vendido/Entregue:{' '}
                          {item.quantidade_vendida + item.quantidade_entregue} |{' '}
                          <b>Esperado: {esperado}</b>
                        </p>
                        {divergencia !== 0 && (
                          <p className="text-[11px] font-bold text-red-500 flex items-center gap-1 mt-0.5">
                            <AlertTriangle className="w-3 h-3" />
                            Divergência: {divergencia > 0 ? `+${divergencia}` : divergencia}
                          </p>
                        )}
                      </div>

                      <div>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          value={conferido}
                          onChange={(e) =>
                            setQtdsConferidas((prev) => ({
                              ...prev,
                              [item.produto_id]: Number(e.target.value),
                            }))
                          }
                          className="w-20 min-h-[44px] text-center font-mono font-bold"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Observações do Acerto
                </Label>
                <Textarea
                  value={obsFechamento}
                  onChange={(e) => setObsFechamento(e.target.value)}
                  placeholder="Justificativa de avarias, trocas ou divergências no acerto..."
                  className="mt-1 min-h-[70px] bg-white dark:bg-[#0E1A33] border-slate-200 dark:border-[#1A2C50] text-xs"
                />
              </div>

              <DialogFooter className="pt-3 border-t border-slate-100 dark:border-[#152342] flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={fechando}
                  onClick={() => setModalFecharOpen(false)}
                  className="flex-1 min-h-[44px] rounded-xl cursor-pointer"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={fechando}
                  onClick={handleConcluirFechamento}
                  className="flex-1 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl cursor-pointer"
                >
                  {fechando ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                      Fechando...
                    </>
                  ) : (
                    'Concluir Acerto'
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
