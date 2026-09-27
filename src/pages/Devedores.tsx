import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Users,
  Search,
  AlertTriangle,
  Calendar,
  MessageCircle,
  Receipt,
  DollarSign,
  Clock,
  CheckCircle2,
  ChevronRight,
  ArrowUpDown,
  RefreshCw,
  Printer,
  Share2,
  X,
  CreditCard,
  ShieldAlert,
} from 'lucide-react'
import { useEmpresa } from '@/hooks/use-empresa'
import { useAuth } from '@/hooks/use-auth'
import {
  DevedoresService,
  DevedorClienteItem,
  DevedorClienteDetalhes,
  DevedorParcelaItem,
  ComprovanteRecebimentoData,
} from '@/services/devedores'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

export default function DevedoresPage() {
  const { empresa, moduloCrediario } = useEmpresa()
  const { usuario } = useAuth()

  const [loading, setLoading] = useState(true)
  const [devedores, setDevedores] = useState<DevedorClienteItem[]>([])
  const [filtro, setFiltro] = useState<'todos' | 'vencidos' | 'vencendo_7_dias'>('todos')
  const [busca, setBusca] = useState('')

  // Detalhe do Cliente
  const [clienteDetalhes, setClienteDetalhes] = useState<DevedorClienteDetalhes | null>(null)
  const [modalDetalheOpen, setModalDetalheOpen] = useState(false)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)

  // Modal de Recebimento
  const [modalReceberOpen, setModalReceberOpen] = useState(false)
  const [parcelaSelecionada, setParcelaSelecionada] = useState<DevedorParcelaItem | null>(null)
  const [valorReceber, setValorReceber] = useState<number>(0)
  const [formaRecebimento, setFormaRecebimento] = useState<string>('dinheiro')
  const [salvandoRecebimento, setSalvandoRecebimento] = useState(false)

  // Modal de Comprovante de Pagamento
  const [comprovante, setComprovante] = useState<ComprovanteRecebimentoData | null>(null)
  const [modalComprovanteOpen, setModalComprovanteOpen] = useState(false)

  const carregarDevedores = useCallback(async () => {
    if (!moduloCrediario) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const { data, error } = await DevedoresService.listarDevedores(filtro, busca)
      if (error) throw error
      setDevedores(data)
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao carregar lista de devedores.')
    } finally {
      setLoading(false)
    }
  }, [moduloCrediario, filtro, busca])

  useEffect(() => {
    carregarDevedores()
  }, [carregarDevedores])

  const abrirDetalheCliente = async (clienteId: string) => {
    setLoadingDetalhes(true)
    setModalDetalheOpen(true)
    try {
      const { data, error } = await DevedoresService.detalharCliente(clienteId)
      if (error) throw error
      setClienteDetalhes(data)
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao carregar detalhes do cliente.')
      setModalDetalheOpen(false)
    } finally {
      setLoadingDetalhes(false)
    }
  }, [])

  const abrirReceberParcela = (parcela: DevedorParcelaItem) => {
    setParcelaSelecionada(parcela)
    setValorReceber(parcela.saldo)
    setFormaRecebimento('dinheiro')
    setModalReceberOpen(true)
  }

  const handleConfirmarRecebimento = async () => {
    if (!parcelaSelecionada || !clienteDetalhes) return

    if (valorReceber <= 0) {
      toast.error('Informe um valor de recebimento válido maior que zero.')
      return
    }

    if (valorReceber > parcelaSelecionada.saldo) {
      toast.error(
        `O valor não pode exceder o saldo devedor (${formatCurrency(parcelaSelecionada.saldo)}).`,
      )
      return
    }

    setSalvandoRecebimento(true)
    try {
      const { data, error } = await DevedoresService.registrarRecebimento(
        parcelaSelecionada.id,
        valorReceber,
        formaRecebimento,
      )
      if (error) throw error

      toast.success('Recebimento registrado com sucesso!')
      setModalReceberOpen(false)

      // Montar comprovante
      const comprovanteData: ComprovanteRecebimentoData = {
        conta_id: parcelaSelecionada.id,
        cliente_nome: clienteDetalhes.cliente.nome,
        cliente_telefone: clienteDetalhes.cliente.telefone || clienteDetalhes.cliente.whatsapp,
        descricao: parcelaSelecionada.descricao,
        parcela: parcelaSelecionada.numero_parcela,
        valor_recebido: valorReceber,
        valor_pago_acumulado: data?.valor_pago || (parcelaSelecionada.valor_pago + valorReceber),
        saldo_restante: data?.saldo_restante ?? Math.max(0, parcelaSelecionada.saldo - valorReceber),
        forma_pagamento: formaRecebimento,
        data_pagamento: new Date().toLocaleDateString('pt-BR'),
        data_hora_emissao: new Date().toLocaleString('pt-BR'),
      }

      setComprovante(comprovanteData)
      setModalComprovanteOpen(true)

      // Atualizar lista e detalhes
      await abrirDetalheCliente(clienteDetalhes.cliente.id)
      carregarDevedores()
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao registrar recebimento.')
    } finally {
      setSalvandoRecebimento(false)
    }
  }

  const handleEnviarWhatsApp = (dev: {
    nome: string
    telefone: string | null
    whatsapp: string | null
    totalDevido: number
    totalVencido: number
    vencidasCount: number
  }) => {
    const link = DevedoresService.gerarLinkWhatsApp(
      { nome: dev.nome, telefone: dev.telefone, whatsapp: dev.whatsapp },
      dev.totalDevido,
      dev.totalVencido,
      dev.vencidasCount,
      empresa?.nome_fantasia || empresa?.nome || 'Andrade Alimentos',
    )
    if (!link) {
      toast.error('Este cliente não possui telefone ou WhatsApp cadastrado.')
      return
    }
    window.open(link, '_blank')
  }

  const handleImprimirComprovante = () => {
    window.print()
  }

  // Totais Gerais
  const totaisGerais = useMemo(() => {
    return devedores.reduce(
      (acc, curr) => ({
        totalDevido: acc.totalDevido + curr.total_devido,
        totalVencido: acc.totalVencido + curr.total_vencido,
        totalClientes: acc.totalClientes + 1,
      }),
      { totalDevido: 0, totalVencido: 0, totalClientes: 0 },
    )
  }, [devedores])

  if (!moduloCrediario) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-[#0A1328] rounded-2xl border border-slate-200 dark:border-[#152342] shadow-xs">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          Módulo Crediário Desativado
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
          A gestão de Devedores e vendas a prazo (crediário de 30/60/90 dias) está disponível para empresas com o módulo Crediário ativado. Solicite ao administrador da plataforma.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-24 md:pb-8">
      {/* Header Mobile-First */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-[#0066FF]" />
            Devedores & Cobrança
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Acompanhamento de parcelas a prazo, cobranças no WhatsApp e baixas no celular.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={carregarDevedores}
          disabled={loading}
          className="h-10 text-xs font-semibold gap-2 border-slate-200 dark:border-[#152342]"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* KPI Cards Mobile-First */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
        <div className="p-3.5 sm:p-4 rounded-xl bg-white dark:bg-[#0A1328] border border-slate-200 dark:border-[#152342] shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Total em Aberto
          </span>
          <p className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white">
            {formatCurrency(totaisGerais.totalDevido)}
          </p>
          <span className="text-[10px] text-slate-500">
            {totaisGerais.totalClientes} clientes com saldo
          </span>
        </div>

        <div className="p-3.5 sm:p-4 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-500 block mb-1 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            Total Vencido
          </span>
          <p className="text-lg sm:text-2xl font-black text-rose-600 dark:text-rose-400">
            {formatCurrency(totaisGerais.totalVencido)}
          </p>
          <span className="text-[10px] text-rose-500/80">Cobrança prioritária</span>
        </div>

        <div className="col-span-2 lg:col-span-1 p-3.5 sm:p-4 rounded-xl bg-white dark:bg-[#0A1328] border border-slate-200 dark:border-[#152342] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Filtro Ativo
            </span>
            <p className="text-sm font-bold text-slate-900 dark:text-white capitalize">
              {filtro === 'todos'
                ? 'Todos os devedores'
                : filtro === 'vencidos'
                ? 'Apenas parcelas vencidas'
                : 'Vencendo em até 7 dias'}
            </p>
          </div>
          <Badge className="bg-[#0066FF]/10 text-[#0066FF] border-[#0066FF]/20">
            {devedores.length} devedor(es)
          </Badge>
        </div>
      </div>

      {/* Barra de Filtros e Busca Mobile-First */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar por cliente ou telefone..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9 h-11 text-sm bg-white dark:bg-[#0A1328] border-slate-200 dark:border-[#152342]"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <Button
            size="sm"
            variant={filtro === 'todos' ? 'default' : 'outline'}
            onClick={() => setFiltro('todos')}
            className={`h-11 text-xs font-semibold shrink-0 ${
              filtro === 'todos' ? 'bg-[#0066FF] text-white' : ''
            }`}
          >
            Todos
          </Button>
          <Button
            size="sm"
            variant={filtro === 'vencidos' ? 'default' : 'outline'}
            onClick={() => setFiltro('vencidos')}
            className={`h-11 text-xs font-semibold shrink-0 ${
              filtro === 'vencidos' ? 'bg-rose-600 hover:bg-rose-700 text-white' : ''
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 mr-1" />
            Vencidos
          </Button>
          <Button
            size="sm"
            variant={filtro === 'vencendo_7_dias' ? 'default' : 'outline'}
            onClick={() => setFiltro('vencendo_7_dias')}
            className={`h-11 text-xs font-semibold shrink-0 ${
              filtro === 'vencendo_7_dias' ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''
            }`}
          >
            <Clock className="w-3.5 h-3.5 mr-1" />
            Vencendo em 7 dias
          </Button>
        </div>
      </div>

      {/* Lista de Devedores em Cards Mobile-First (Sem tabelas) */}
      {loading ? (
        <div className="p-12 text-center text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#0066FF]" />
          Carregando clientes devedores...
        </div>
      ) : devedores.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-[#0A1328] rounded-2xl border border-slate-200 dark:border-[#152342]">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <h3 className="font-bold text-slate-900 dark:text-white text-base">
            Nenhum saldo devedor encontrado!
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Não há parcelas pendentes com os filtros atuais.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {devedores.map((dev) => {
            const hasAtraso = dev.total_vencido > 0 || dev.maior_atraso_dias > 0
            return (
              <div
                key={dev.cliente_id}
                className="p-4 rounded-xl bg-white dark:bg-[#0A1328] border border-slate-200 dark:border-[#152342] shadow-xs hover:border-[#0066FF]/40 transition-all space-y-3"
              >
                {/* Cabeçalho do Card */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <button
                      onClick={() => abrirDetalheCliente(dev.cliente_id)}
                      className="text-left font-bold text-sm sm:text-base text-slate-900 dark:text-white hover:text-[#0066FF] truncate block transition-colors"
                    >
                      {dev.cliente_nome}
                    </button>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      {dev.cliente_telefone || dev.cliente_whatsapp || 'Sem telefone'}
                    </p>
                  </div>

                  {hasAtraso ? (
                    <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 text-xs shrink-0 font-bold">
                      {dev.maior_atraso_dias}d de atraso
                    </Badge>
                  ) : (
                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs shrink-0 font-bold">
                      Em dia
                    </Badge>
                  )}
                </div>

                {/* Resumo Financeiro do Cliente */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-[#0E1A33]/50 border border-slate-100 dark:border-[#152342]/60 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">
                      Total Devido
                    </span>
                    <p className="font-extrabold text-slate-900 dark:text-white text-sm">
                      {formatCurrency(dev.total_devido)}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">
                      Vencido
                    </span>
                    <p
                      className={`font-extrabold text-sm ${
                        dev.total_vencido > 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {formatCurrency(dev.total_vencido)}
                    </p>
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">
                      Próx. Parcela
                    </span>
                    <p className="font-semibold text-slate-700 dark:text-slate-300">
                      {dev.proxima_parcela_data
                        ? `${new Date(dev.proxima_parcela_data + 'T12:00:00').toLocaleDateString(
                            'pt-BR',
                          )} (${formatCurrency(dev.proxima_parcela_valor)})`
                        : 'Nenhuma futura'}
                    </p>
                  </div>
                </div>

                {/* Ações Mobile-First (Botões Grandes ≥ 44px) */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button
                    onClick={() =>
                      handleEnviarWhatsApp({
                        nome: dev.cliente_nome,
                        telefone: dev.cliente_telefone,
                        whatsapp: dev.cliente_whatsapp,
                        totalDevido: dev.total_devido,
                        totalVencido: dev.total_vencido,
                        vencidasCount: dev.total_parcelas_vencidas,
                      })
                    }
                    className="h-11 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 rounded-xl cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4 shrink-0" />
                    <span>Cobrar WhatsApp</span>
                  </Button>

                  <Button
                    onClick={() => abrirDetalheCliente(dev.cliente_id)}
                    className="h-11 min-h-[44px] bg-[#0066FF] hover:bg-[#0052CC] text-white font-semibold text-xs flex items-center justify-center gap-1.5 rounded-xl cursor-pointer"
                  >
                    <span>Ver Parcelas</span>
                    <ChevronRight className="w-4 h-4 shrink-0" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* DIALOG 1: DETALHE DO CLIENTE & PARCELAS */}
      <Dialog open={modalDetalheOpen} onOpenChange={setModalDetalheOpen}>
        <DialogContent className="max-w-xl max-h-[92vh] flex flex-col p-0 bg-white dark:bg-[#0A1328] border-slate-200 dark:border-[#152342] text-slate-900 dark:text-white overflow-hidden shadow-2xl">
          <DialogHeader className="px-5 py-4 border-b border-slate-100 dark:border-[#152342] bg-slate-50/50 dark:bg-[#081022] shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <span>{clienteDetalhes?.cliente.nome}</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 font-mono mt-0.5">
                  Tel: {clienteDetalhes?.cliente.telefone || 'Sem telefone'} • Limite:{' '}
                  {clienteDetalhes?.cliente.limite_credito
                    ? formatCurrency(clienteDetalhes.cliente.limite_credito)
                    : 'Não definido'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {loadingDetalhes ? (
              <div className="p-8 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#0066FF]" />
                Carregando parcelas...
              </div>
            ) : !clienteDetalhes ? (
              <p className="text-center text-slate-400">Nenhum dado encontrado.</p>
            ) : (
              <>
                {/* Resumo no topo */}
                <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-100 dark:bg-[#0E1A33] border border-slate-200 dark:border-[#152342]">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">
                      Total a Receber
                    </span>
                    <p className="text-lg font-black text-slate-900 dark:text-white">
                      {formatCurrency(clienteDetalhes.total_devido)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">
                      Total Vencido
                    </span>
                    <p className="text-lg font-black text-rose-600 dark:text-rose-400">
                      {formatCurrency(clienteDetalhes.total_vencido)}
                    </p>
                  </div>
                </div>

                {/* Lista de Parcelas em Cartões Mobile */}
                <div className="space-y-2.5">
                  <h4 className="font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">
                    Parcelas do Cliente ({clienteDetalhes.parcelas.length})
                  </h4>

                  {clienteDetalhes.parcelas.map((parc) => {
                    const isAtrasada = parc.atrasada
                    const isPaga = parc.status === 'pago'

                    return (
                      <div
                        key={parc.id}
                        className={`p-3 rounded-xl border transition-all ${
                          isPaga
                            ? 'bg-slate-50 dark:bg-[#081022]/60 border-slate-200 dark:border-slate-800 opacity-75'
                            : isAtrasada
                            ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50'
                            : 'bg-white dark:bg-[#0A1328] border-slate-200 dark:border-[#152342]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-sm text-slate-900 dark:text-white">
                                {parc.descricao}
                              </span>
                              {parc.numero_parcela && (
                                <Badge className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px]">
                                  {parc.numero_parcela}
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Vencimento:{' '}
                              <strong>
                                {new Date(parc.vencimento + 'T12:00:00').toLocaleDateString(
                                  'pt-BR',
                                )}
                              </strong>
                              {isAtrasada && (
                                <span className="text-rose-600 dark:text-rose-400 font-bold ml-1.5">
                                  ({parc.dias_atraso} dias de atraso)
                                </span>
                              )}
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            <p className="text-xs font-semibold text-slate-500">
                              Valor: {formatCurrency(parc.valor)}
                            </p>
                            <p
                              className={`text-sm font-black ${
                                isPaga
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-slate-900 dark:text-white'
                              }`}
                            >
                              Saldo: {formatCurrency(parc.saldo)}
                            </p>
                          </div>
                        </div>

                        {/* Status e Ação */}
                        <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100 dark:border-slate-800/80">
                          <div>
                            {isPaga ? (
                              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
                                Paga em{' '}
                                {parc.data_pagamento
                                  ? new Date(parc.data_pagamento + 'T12:00:00').toLocaleDateString(
                                      'pt-BR',
                                    )
                                  : 'Data n/d'}
                              </Badge>
                            ) : parc.valor_pago > 0 ? (
                              <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px]">
                                Parcialmente paga ({formatCurrency(parc.valor_pago)} pagos)
                              </Badge>
                            ) : (
                              <Badge className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px]">
                                Pendente
                              </Badge>
                            )}
                          </div>

                          {!isPaga && (
                            <Button
                              size="sm"
                              onClick={() => abrirReceberParcela(parc)}
                              className="h-9 min-h-[36px] bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs rounded-lg px-3"
                            >
                              <DollarSign className="w-3.5 h-3.5 mr-1" />
                              Receber
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          <DialogFooter className="px-5 py-3 border-t border-slate-100 dark:border-[#152342] bg-slate-50/50 dark:bg-[#081022] shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalDetalheOpen(false)}
              className="w-full sm:w-auto h-11 text-xs font-semibold"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 2: REGISTRAR RECEBIMENTO (TOTAL OU PARCIAL) */}
      <Dialog open={modalReceberOpen} onOpenChange={setModalReceberOpen}>
        <DialogContent className="max-w-md p-5 bg-white dark:bg-[#0A1328] border-slate-200 dark:border-[#152342] text-slate-900 dark:text-white shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-500" />
              Receber Parcela
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {parcelaSelecionada?.descricao} • Saldo em aberto:{' '}
              <strong className="text-slate-900 dark:text-white">
                {parcelaSelecionada ? formatCurrency(parcelaSelecionada.saldo) : ''}
              </strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Valor a receber */}
            <div className="space-y-1.5">
              <Label htmlFor="valor_recebimento" className="font-semibold text-xs">
                Valor Recebido (R$) *
              </Label>
              <Input
                id="valor_recebimento"
                type="number"
                step="0.01"
                inputMode="decimal"
                value={valorReceber || ''}
                onChange={(e) => setValorReceber(parseFloat(e.target.value) || 0)}
                className="h-12 text-lg font-black bg-slate-50 dark:bg-[#081022] border-slate-200 dark:border-[#152342] font-mono"
              />
              <div className="flex gap-2 mt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setValorReceber(parcelaSelecionada?.saldo || 0)}
                  className="h-7 text-[11px] text-[#0066FF] hover:bg-[#0066FF]/10 font-bold p-1"
                >
                  Quitar Saldo Total ({formatCurrency(parcelaSelecionada?.saldo || 0)})
                </Button>
              </div>
            </div>

            {/* Forma de Pagamento */}
            <div className="space-y-1.5">
              <Label className="font-semibold text-xs">Forma de Pagamento *</Label>
              <Select value={formaRecebimento} onValueChange={setFormaRecebimento}>
                <SelectTrigger className="h-11 bg-slate-50 dark:bg-[#081022] border-slate-200 dark:border-[#152342]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-[#0A1328] border-slate-200 dark:border-[#152342]">
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                  <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                  <SelectItem value="outra">Outra forma</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setModalReceberOpen(false)}
              className="h-11 min-h-[44px] text-xs font-semibold w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmarRecebimento}
              disabled={salvandoRecebimento}
              className="h-11 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs w-full sm:w-auto cursor-pointer"
            >
              {salvandoRecebimento ? 'Registrando...' : 'Confirmar Recebimento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 3: COMPROVANTE DE PAGAMENTO PARA IMPRESSÃO OU COMPARTILHAMENTO */}
      <Dialog open={modalComprovanteOpen} onOpenChange={setModalComprovanteOpen}>
        <DialogContent className="max-w-md p-0 bg-white dark:bg-[#0A1328] border-slate-200 dark:border-[#152342] text-slate-900 dark:text-white shadow-2xl overflow-hidden">
          <div id="comprovante-print" className="p-6 space-y-4">
            {/* Cabeçalho Comprovante */}
            <div className="text-center pb-3 border-b border-dashed border-slate-300 dark:border-slate-700">
              <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <Receipt className="w-6 h-6" />
              </div>
              <h2 className="font-black text-base text-slate-900 dark:text-white uppercase tracking-tight">
                {empresa?.nome_fantasia || empresa?.nome || 'Andrade Alimentos'}
              </h2>
              <p className="text-[11px] text-slate-500">Comprovante de Recebimento</p>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                Emissão: {comprovante?.data_hora_emissao}
              </p>
            </div>

            {/* Dados do Cliente e Parcela */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Cliente:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {comprovante?.cliente_nome}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Referência:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {comprovante?.descricao}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Forma de Pagamento:</span>
                <span className="font-bold uppercase text-slate-900 dark:text-white">
                  {comprovante?.forma_pagamento}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 bg-emerald-500/10 px-2 rounded-lg">
                <span className="font-bold text-emerald-700 dark:text-emerald-400">
                  Valor Recebido:
                </span>
                <span className="font-black text-base text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(comprovante?.valor_recebido || 0)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Saldo Restante:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {formatCurrency(comprovante?.saldo_restante || 0)}
                </span>
              </div>
            </div>

            <div className="text-center pt-2 text-[10px] text-slate-400">
              Obrigado pela preferência e pontualidade!
            </div>
          </div>

          <DialogFooter className="px-5 py-3 border-t border-slate-100 dark:border-[#152342] bg-slate-50/50 dark:bg-[#081022] flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleImprimirComprovante}
              className="h-11 min-h-[44px] text-xs font-semibold gap-1.5 w-full sm:w-auto"
            >
              <Printer className="w-4 h-4" />
              Imprimir
            </Button>
            <Button
              size="sm"
              onClick={() => {
                const text = `*COMPROVANTE DE PAGAMENTO*\n${
                  empresa?.nome_fantasia || empresa?.nome
                }\nCliente: ${comprovante?.cliente_nome}\nValor: R$ ${comprovante?.valor_recebido
                  .toFixed(2)
                  .replace('.', ',')}\nSaldo restante: R$ ${comprovante?.saldo_restante
                  .toFixed(2)
                  .replace('.', ',')}\nData: ${comprovante?.data_pagamento}`
                navigator.clipboard?.writeText(text)
                toast.success('Texto do comprovante copiado para o WhatsApp!')
              }}
              className="h-11 min-h-[44px] bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs gap-1.5 w-full sm:w-auto cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              Copiar / Compartilhar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
