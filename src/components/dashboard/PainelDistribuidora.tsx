import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useEmpresa } from '@/hooks/use-empresa'
import { useAuth } from '@/hooks/use-auth'
import { formatCurrency } from '@/lib/utils'
import { EstoqueService } from '@/services/estoque'
import {
  DollarSign,
  ShoppingCart,
  Package,
  Users,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  TrendingUp,
  Percent,
  Truck,
  CheckCircle2,
  Clock,
  ChevronRight,
  AlertCircle,
  Boxes,
  MapPin,
  Calendar,
} from 'lucide-react'
import {
  getPresetPeriodoSaoPaulo,
  converterPeriodoSaoPauloParaIsoUtc,
  RegrasCalculo,
} from '@/services/regras-calculo'
import { supabase } from '@/lib/supabase/client'

export type PeriodoPainel = 'hoje' | '7dias' | 'mes_atual'

interface PainelDistribuidoraProps {
  onRefresh?: () => void
}

export function PainelDistribuidora({ onRefresh }: PainelDistribuidoraProps) {
  const { empresaId } = useEmpresa()
  const { usuario } = useAuth()
  const navigate = useNavigate()

  const [periodo, setPeriodo] = useState<PeriodoPainel>('hoje')
  const [loading, setLoading] = useState(true)

  // Métricas de Vendas
  const [vendasTotal, setVendasTotal] = useState(0)
  const [cestasVendidasCount, setCestasVendidasCount] = useState(0)
  const [vendasAVistaTotal, setVendasAVistaTotal] = useState(0)
  const [vendasParceladoTotal, setVendasParceladoTotal] = useState(0)
  const [ticketMedio, setTicketMedio] = useState(0)
  const [vendasQtd, setVendasQtd] = useState(0)

  // Métricas de Dinheiro / Recebimento
  const [recebidoDinheiro, setRecebidoDinheiro] = useState(0)
  const [recebidoPix, setRecebidoPix] = useState(0)
  const [recebidoCartao, setRecebidoCartao] = useState(0)
  const [recebidoOutros, setRecebidoOutros] = useState(0)
  const [parcelasRecebidasTotal, setParcelasRecebidasTotal] = useState(0)
  const [totalAReceber, setTotalAReceber] = useState(0)
  const [totalVencido, setTotalVencido] = useState(0)
  const [clientesVencidosCount, setClientesVencidosCount] = useState(0)

  // Métricas de Estoque
  const [cestasLivres, setCestasLivres] = useState(0)
  const [cestasReservadas, setCestasReservadas] = useState(0)
  const [cestasNoCarro, setCestasNoCarro] = useState(0)
  const [componentesAbaixoMinimo, setComponentesAbaixoMinimo] = useState(0)
  const [lotesVencendo30Dias, setLotesVencendo30Dias] = useState(0)
  const [lotesVencidosCount, setLotesVencidosCount] = useState(0)

  // Métricas de Operação
  const [pedidosPendentes, setPedidosPendentes] = useState(0)
  const [pedidosConfirmados, setPedidosConfirmados] = useState(0)
  const [rotasAbertas, setRotasAbertas] = useState(0)
  const [rotasFinalizadas, setRotasFinalizadas] = useState(0)
  const [entregasFeitas, setEntregasFeitas] = useState(0)
  const [entregasNaoFeitas, setEntregasNaoFeitas] = useState(0)

  // Margem Bruta
  const [custoHistoricoTotal, setCustoHistoricoTotal] = useState(0)
  const [margemBrutaTotal, setMargemBrutaTotal] = useState(0)
  const [margemBrutaPercentual, setMargemBrutaPercentual] = useState(0)
  const [topCestasMargem, setTopCestasMargem] = useState<
    Array<{
      nome: string
      quantidade: number
      faturamento: number
      margem: number
      percentual: number
    }>
  >([])

  // Vendas por Canal
  const [vendasPorCanal, setVendasPorCanal] = useState<
    Record<string, { faturamento: number; quantidade: number }>
  >({
    presencial: { faturamento: 0, quantidade: 0 },
    whatsapp: { faturamento: 0, quantidade: 0 },
    telefone: { faturamento: 0, quantidade: 0 },
    instagram: { faturamento: 0, quantidade: 0 },
    rua: { faturamento: 0, quantidade: 0 },
    outro: { faturamento: 0, quantidade: 0 },
  })

  // Dados exclusivos do vendedor/entregador
  const [comissaoVendedor, setComissaoVendedor] = useState(0)

  const perfil = (usuario?.perfil || '').toLowerCase()
  const isVendedorOuEntregador = perfil === 'vendedor' || perfil === 'entregador'
  const podeVerCustoEMargem = !isVendedorOuEntregador

  const carregarDadosPainel = useCallback(async () => {
    if (!empresaId) return
    setLoading(true)

    try {
      const periodoSp = getPresetPeriodoSaoPaulo(periodo)
      const { inicioIso, fimIso } = converterPeriodoSaoPauloParaIsoUtc(periodoSp)

      // Identificar ID do vendedor se logado
      let vendedorId: string | null = null
      if (perfil === 'vendedor') {
        const { data: vData } = await supabase
          .from('vendedores')
          .select('id')
          .eq('empresa_id', empresaId)
          .eq('usuario_id', usuario?.id || '')
          .maybeSingle()
        vendedorId = vData?.id || null
      }

      // 1. VENDAS & ITENS
      let vendasQuery = supabase
        .from('vendas')
        .select(`
          id,
          total,
          forma_pagamento,
          status,
          vendedor_id,
          created_at,
          pedidos (canal),
          itens_venda (
            quantidade,
            subtotal,
            custo_unitario,
            produtos (id, nome, tipo_item, preco_custo)
          )
        `)
        .eq('empresa_id', empresaId)
        .eq('status', 'finalizada')
        .gte('created_at', inicioIso)
        .lte('created_at', fimIso)

      if (isVendedorOuEntregador && vendedorId) {
        vendasQuery = vendasQuery.eq('vendedor_id', vendedorId)
      }

      const { data: vendasData } = await vendasQuery

      const vendas = vendasData || []
      let vTotal = 0
      let vAVista = 0
      let vParcelado = 0
      let cestasCount = 0
      let custoTotal = 0

      const canalMap: Record<string, { faturamento: number; quantidade: number }> = {
        presencial: { faturamento: 0, quantidade: 0 },
        whatsapp: { faturamento: 0, quantidade: 0 },
        telefone: { faturamento: 0, quantidade: 0 },
        instagram: { faturamento: 0, quantidade: 0 },
        rua: { faturamento: 0, quantidade: 0 },
        outro: { faturamento: 0, quantidade: 0 },
      }

      const cestaMargemMap = new Map<
        string,
        { nome: string; quantidade: number; faturamento: number; custo: number }
      >()

      for (const v of vendas) {
        const tot = Number(v.total) || 0
        vTotal += tot
        const forma = (v.forma_pagamento || '').toLowerCase()
        const isPrazo = forma === 'fiado' || forma === 'crediario' || forma === 'a_prazo'

        if (isPrazo) {
          vParcelado += tot
        } else {
          vAVista += tot
        }

        const rawCanal = ((v.pedidos as any)?.canal || 'presencial').toLowerCase()
        const canalNorm = canalMap[rawCanal]
          ? rawCanal
          : rawCanal === 'venda_na_rua'
            ? 'rua'
            : 'outro'
        canalMap[canalNorm].quantidade += 1
        canalMap[canalNorm].faturamento += tot

        for (const it of v.itens_venda || []) {
          const prod = it.produtos as any
          const qtd = Number(it.quantidade) || 0
          const sub = Number(it.subtotal) || 0
          const cUnit = Number(it.custo_unitario || prod?.preco_custo || 0)
          const itCusto = qtd * cUnit

          if (prod?.tipo_item === 'cesta') {
            cestasCount += qtd
            const cId = prod.id
            const existing = cestaMargemMap.get(cId)
            if (existing) {
              existing.quantidade += qtd
              existing.faturamento += sub
              existing.custo += itCusto
            } else {
              cestaMargemMap.set(cId, {
                nome: prod.nome || 'Cesta',
                quantidade: qtd,
                faturamento: sub,
                custo: itCusto,
              })
            }
          }

          custoTotal += itCusto
        }
      }

      setVendasTotal(Math.round(vTotal * 100) / 100)
      setVendasQtd(vendas.length)
      setCestasVendidasCount(cestasCount)
      setVendasAVistaTotal(Math.round(vAVista * 100) / 100)
      setVendasParceladoTotal(Math.round(vParcelado * 100) / 100)
      setTicketMedio(RegrasCalculo.ticketMedio(vTotal, vendas.length))
      setVendasPorCanal(canalMap)

      if (podeVerCustoEMargem) {
        setCustoHistoricoTotal(Math.round(custoTotal * 100) / 100)
        const margemB = RegrasCalculo.lucroBruto(vTotal, custoTotal)
        setMargemBrutaTotal(margemB)
        setMargemBrutaPercentual(RegrasCalculo.margemLucro(vTotal, custoTotal))

        const listMargens = Array.from(cestaMargemMap.values())
          .map((c) => {
            const marg = RegrasCalculo.lucroBruto(c.faturamento, c.custo)
            const perc = RegrasCalculo.margemLucro(c.faturamento, c.custo)
            return {
              nome: c.nome,
              quantidade: c.quantidade,
              faturamento: Math.round(c.faturamento * 100) / 100,
              margem: marg,
              percentual: perc,
            }
          })
          .sort((a, b) => b.margem - a.margem)
        setTopCestasMargem(listMargens.slice(0, 5))
      }

      // 2. COMISSÃO DO VENDEDOR SE LOGADO
      if (isVendedorOuEntregador && vendedorId) {
        const { data: comRes } = await supabase
          .from('comissoes')
          .select('valor_comissao, status')
          .eq('empresa_id', empresaId)
          .eq('vendedor_id', vendedorId)
          .neq('status', 'cancelada')
        const comTotal = (comRes || []).reduce((acc, c) => acc + (Number(c.valor_comissao) || 0), 0)
        setComissaoVendedor(Math.round(comTotal * 100) / 100)
      }

      // 3. RECEBIMENTOS NO PERÍODO POR FORMA E PARCELAS QUITADAS
      let recQuery = supabase
        .from('contas_receber')
        .select('valor, valor_pago, forma_pagamento_baixa, status, data_pagamento')
        .eq('empresa_id', empresaId)
        .gte('data_pagamento', periodoSp.inicio)
        .lte('data_pagamento', periodoSp.fim)

      const { data: recData } = await recQuery
      let rDinheiro = 0
      let rPix = 0
      let rCartao = 0
      let rOutros = 0
      let parcRecebidas = 0

      for (const r of recData || []) {
        const vPago = Number(r.valor_pago) || Number(r.valor) || 0
        const fp = (r.forma_pagamento_baixa || '').toLowerCase()
        parcRecebidas += vPago

        if (fp.includes('dinheiro')) rDinheiro += vPago
        else if (fp.includes('pix')) rPix += vPago
        else if (fp.includes('cartao') || fp.includes('crédito') || fp.includes('débito'))
          rCartao += vPago
        else rOutros += vPago
      }

      setRecebidoDinheiro(Math.round(rDinheiro * 100) / 100)
      setRecebidoPix(Math.round(rPix * 100) / 100)
      setRecebidoCartao(Math.round(rCartao * 100) / 100)
      setRecebidoOutros(Math.round(rOutros * 100) / 100)
      setParcelasRecebidasTotal(Math.round(parcRecebidas * 100) / 100)

      // 4. INADIMPLÊNCIA / TOTAL A RECEBER E VENCIDO
      const { data: inadData } = await (supabase.rpc as any)('get_relatorio_inadimplencia_faixas')
      if (inadData) {
        setTotalAReceber(Number((inadData as any).total_geral_receber) || 0)
        setTotalVencido(Number((inadData as any).total_vencido) || 0)
        setClientesVencidosCount(Number((inadData as any).clientes_inadimplentes_count) || 0)
      }

      // 5. ESTOQUE: CESTAS LIVRES / RESERVADAS / NO CARRO, COMPONENTES ABAIXO DO MÍNIMO
      const [cestasEstoqueRes, rotasEstoqueRes, componentesRes] = await Promise.all([
        supabase
          .from('produtos')
          .select('id, nome, estoques(quantidade, quantidade_reservada)')
          .eq('empresa_id', empresaId)
          .eq('tipo_item', 'cesta')
          .eq('ativo', true),
        supabase
          .from('rota_itens_estoque')
          .select(
            'quantidade_carregada, quantidade_vendida, quantidade_entregue, quantidade_devolvida, rotas!inner(status)',
          )
          .eq('empresa_id', empresaId)
          .eq('rotas.status', 'em_rota'),
        supabase
          .from('produtos')
          .select('id, estoque_minimo, estoques(quantidade)')
          .eq('empresa_id', empresaId)
          .in('tipo_item', ['componente', 'padrao'])
          .eq('ativo', true),
      ])

      let livres = 0
      let reserv = 0
      for (const p of cestasEstoqueRes.data || []) {
        const est = (p.estoques as any)?.[0] || {}
        livres += Number(est.quantidade || 0)
        reserv += Number(est.quantidade_reservada || 0)
      }

      let noCarro = 0
      for (const r of rotasEstoqueRes.data || []) {
        const c = Number(r.quantidade_carregada) || 0
        const v = Number(r.quantidade_vendida) || 0
        const e = Number(r.quantidade_entregue) || 0
        const d = Number(r.quantidade_devolvida) || 0
        noCarro += Math.max(0, c - (v + e + d))
      }

      let compAbaixo = 0
      for (const comp of componentesRes.data || []) {
        const est = (comp.estoques as any)?.[0] || {}
        const qtd = Number(est.quantidade || 0)
        const min = Number(comp.estoque_minimo || 0)
        if (qtd < min) compAbaixo++
      }

      setCestasLivres(livres)
      setCestasReservadas(reserv)
      setCestasNoCarro(noCarro)
      setComponentesAbaixoMinimo(compAbaixo)

      // 6. LOTES VENCENDO EM 30 DIAS E VENCIDOS
      const alertasLotes = await EstoqueService.getAlertasLotes(30)
      setLotesVencidosCount(alertasLotes.total_vencidos || 0)
      setLotesVencendo30Dias(alertasLotes.total_vencendo || 0)

      // 7. OPERAÇÃO: PEDIDOS E ROTAS DO DIA
      const [pedidosHojeRes, rotasHojeRes] = await Promise.all([
        supabase
          .from('pedidos')
          .select('status, created_at')
          .eq('empresa_id', empresaId)
          .gte('created_at', inicioIso)
          .lte('created_at', fimIso),
        supabase
          .from('rotas')
          .select('status, data')
          .eq('empresa_id', empresaId)
          .gte('data', periodoSp.inicio)
          .lte('data', periodoSp.fim),
      ])

      let pPend = 0
      let pConf = 0
      for (const ped of pedidosHojeRes.data || []) {
        if (ped.status === 'pendente') pPend++
        if (ped.status === 'confirmado' || ped.status === 'faturado') pConf++
      }

      let rAbertas = 0
      let rFinalizadas = 0
      for (const rota of rotasHojeRes.data || []) {
        if (rota.status === 'aberta' || rota.status === 'em_rota') rAbertas++
        if (rota.status === 'fechada') rFinalizadas++
      }

      setPedidosPendentes(pPend)
      setPedidosConfirmados(pConf)
      setRotasAbertas(rAbertas)
      setRotasFinalizadas(rFinalizadas)

      // Contagem de entregas em rota_pedidos
      const { data: entregasRes } = await supabase
        .from('rota_pedidos')
        .select('status_entrega, rotas!inner(data)')
        .eq('empresa_id', empresaId)
        .gte('rotas.data', periodoSp.inicio)
        .lte('rotas.data', periodoSp.fim)

      let eFeitas = 0
      let eNaoFeitas = 0
      for (const ep of entregasRes || []) {
        if (ep.status_entrega === 'entregue') eFeitas++
        if (ep.status_entrega === 'nao_entregue') eNaoFeitas++
      }

      setEntregasFeitas(eFeitas)
      setEntregasNaoFeitas(eNaoFeitas)
    } catch (err) {
      if (import.meta.env.DEV) console.error('Erro ao carregar Painel da Distribuidora:', err)
    } finally {
      setLoading(false)
    }
  }, [empresaId, periodo, isVendedorOuEntregador, podeVerCustoEMargem, perfil, usuario?.id])

  useEffect(() => {
    carregarDadosPainel()
  }, [carregarDadosPainel])

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 1. SELETOR DE PERÍODO MOBILE-FIRST */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-[#0A1328] border border-slate-200/80 dark:border-[#1A2C50] rounded-2xl p-2.5 sm:p-3 shadow-xs">
        <div className="flex items-center gap-2 px-2">
          <Calendar className="w-4 h-4 text-[#0066FF]" />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Painel da Distribuidora
          </span>
          <Badge
            variant="outline"
            className="text-[10px] h-5 bg-[#0066FF]/10 text-[#0066FF] border-[#0066FF]/30 font-semibold"
          >
            Cestas
          </Badge>
        </div>

        <div className="flex items-center gap-1.5 self-center sm:self-auto w-full sm:w-auto">
          <Button
            type="button"
            size="sm"
            variant={periodo === 'hoje' ? 'default' : 'outline'}
            onClick={() => setPeriodo('hoje')}
            className={`flex-1 sm:flex-initial text-xs h-9 min-h-[44px] rounded-xl px-4 ${
              periodo === 'hoje'
                ? 'bg-[#0066FF] text-white font-bold'
                : 'border-slate-200 dark:border-[#1A2C50]'
            }`}
          >
            Hoje
          </Button>
          <Button
            type="button"
            size="sm"
            variant={periodo === '7dias' ? 'default' : 'outline'}
            onClick={() => setPeriodo('7dias')}
            className={`flex-1 sm:flex-initial text-xs h-9 min-h-[44px] rounded-xl px-4 ${
              periodo === '7dias'
                ? 'bg-[#0066FF] text-white font-bold'
                : 'border-slate-200 dark:border-[#1A2C50]'
            }`}
          >
            7 dias
          </Button>
          <Button
            type="button"
            size="sm"
            variant={periodo === 'mes_atual' ? 'default' : 'outline'}
            onClick={() => setPeriodo('mes_atual')}
            className={`flex-1 sm:flex-initial text-xs h-9 min-h-[44px] rounded-xl px-4 ${
              periodo === 'mes_atual'
                ? 'bg-[#0066FF] text-white font-bold'
                : 'border-slate-200 dark:border-[#1A2C50]'
            }`}
          >
            Mês
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => {
              carregarDadosPainel()
              onRefresh?.()
            }}
            disabled={loading}
            className="h-9 w-9 min-h-[44px] min-w-[44px] rounded-xl text-slate-500 hover:text-[#0066FF]"
            title="Atualizar painel"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* AVISO DO VENDEDOR/ENTREGADOR */}
      {isVendedorOuEntregador && (
        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl p-3 text-xs text-blue-900 dark:text-blue-200 flex items-center justify-between">
          <span>Visualizando seus números de vendas e recebimentos.</span>
          <span className="font-bold">Comissão no período: {formatCurrency(comissaoVendedor)}</span>
        </div>
      )}

      {/* ALERTA DE LOTES VENCIDOS OU VENCENDO */}
      {(lotesVencidosCount > 0 || lotesVencendo30Dias > 0) && (
        <div className="space-y-2">
          {lotesVencidosCount > 0 && (
            <div
              onClick={() => navigate('/app/estoque')}
              className="cursor-pointer bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl p-3 text-xs text-rose-800 dark:text-rose-200 flex items-center justify-between hover:bg-rose-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-semibold">
                  Atenção: {lotesVencidosCount}{' '}
                  {lotesVencidosCount === 1 ? 'lote vencido' : 'lotes vencidos'} bloqueando
                  montagens!
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-rose-600 shrink-0" />
            </div>
          )}
          {lotesVencendo30Dias > 0 && (
            <div
              onClick={() => navigate('/app/estoque')}
              className="cursor-pointer bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between hover:bg-amber-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Alerta: {lotesVencendo30Dias}{' '}
                  {lotesVencendo30Dias === 1 ? 'lote vence' : 'lotes vencem'} nos próximos 30 dias.
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-600 shrink-0" />
            </div>
          )}
        </div>
      )}

      {/* 2. CARTÕES EMPILHADOS: VENDAS, DINHEIRO, ESTOQUE, OPERAÇÃO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CARD 1: VENDAS */}
        <Card className="rounded-2xl border-slate-200/80 dark:border-[#1A2C50] shadow-xs overflow-hidden">
          <CardHeader className="p-4 pb-2 border-b border-slate-100 dark:border-[#1A2C50] flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold">Vendas de Cestas</CardTitle>
                <p className="text-[11px] text-slate-500">Desempenho no período</p>
              </div>
            </div>
            <Link
              to="/app/vendas"
              className="text-xs text-[#0066FF] hover:underline font-semibold flex items-center gap-1"
            >
              Ver Vendas <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-500">Valor Vendido:</span>
              <span className="text-xl font-black text-slate-900 dark:text-white tabular-nums">
                {formatCurrency(vendasTotal)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-slate-500 block">Cestas Vendidas</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                  {cestasVendidasCount} un
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Ticket Médio</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                  {formatCurrency(ticketMedio)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">À Vista</span>
                <span className="font-semibold text-emerald-600">
                  {formatCurrency(vendasAVistaTotal)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Parcelado / Fiado</span>
                <span className="font-semibold text-amber-600">
                  {formatCurrency(vendasParceladoTotal)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CARD 2: DINHEIRO / RECEBIMENTOS */}
        <Card className="rounded-2xl border-slate-200/80 dark:border-[#1A2C50] shadow-xs overflow-hidden">
          <CardHeader className="p-4 pb-2 border-b border-slate-100 dark:border-[#1A2C50] flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#0066FF]/10 text-[#0066FF] flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold">Dinheiro & Recebimentos</CardTitle>
                <p className="text-[11px] text-slate-500">Fluxo recebido e carteira</p>
              </div>
            </div>
            <Link
              to="/app/financeiro"
              className="text-xs text-[#0066FF] hover:underline font-semibold flex items-center gap-1"
            >
              Financeiro <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-slate-50 dark:bg-slate-900/60 p-2 rounded-xl">
                <span className="text-[10px] text-slate-500 block">Dinheiro</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {formatCurrency(recebidoDinheiro)}
                </span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/60 p-2 rounded-xl">
                <span className="text-[10px] text-slate-500 block">PIX</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {formatCurrency(recebidoPix)}
                </span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/60 p-2 rounded-xl">
                <span className="text-[10px] text-slate-500 block">Cartão</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {formatCurrency(recebidoCartao)}
                </span>
              </div>
            </div>

            {/* Toque leva para Devedores filtrado */}
            <div
              onClick={() => navigate('/app/devedores')}
              className="cursor-pointer bg-rose-50/70 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/50 p-2.5 rounded-xl border border-rose-200/60 dark:border-rose-900/40 flex items-center justify-between transition-colors min-h-[44px]"
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span className="text-xs font-bold text-rose-900 dark:text-rose-300">
                    Vencido: {formatCurrency(totalVencido)}
                  </span>
                </div>
                <span className="text-[10px] text-rose-700 dark:text-rose-400">
                  {clientesVencidosCount}{' '}
                  {clientesVencidosCount === 1 ? 'cliente com atraso' : 'clientes com atraso'}{' '}
                  (toque p/ Devedores)
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-rose-600" />
            </div>

            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Total a Receber Carteira:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {formatCurrency(totalAReceber)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* CARD 3: ESTOQUE DA DISTRIBUIDORA */}
        <Card className="rounded-2xl border-slate-200/80 dark:border-[#1A2C50] shadow-xs overflow-hidden">
          <CardHeader className="p-4 pb-2 border-b border-slate-100 dark:border-[#1A2C50] flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                <Boxes className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold">Estoque de Cestas & Lotes</CardTitle>
                <p className="text-[11px] text-slate-500">Saldos operacionais</p>
              </div>
            </div>
            <Link
              to="/app/estoque"
              className="text-xs text-[#0066FF] hover:underline font-semibold flex items-center gap-1"
            >
              Ver Estoque <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div
                onClick={() => navigate('/app/cestas')}
                className="cursor-pointer bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 p-2 rounded-xl transition-colors min-h-[44px]"
              >
                <span className="text-[10px] text-slate-500 block">Cestas Livres</span>
                <span className="text-base font-black text-emerald-600">{cestasLivres}</span>
              </div>
              <div
                onClick={() => navigate('/app/cestas')}
                className="cursor-pointer bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 p-2 rounded-xl transition-colors min-h-[44px]"
              >
                <span className="text-[10px] text-slate-500 block">Reservadas</span>
                <span className="text-base font-black text-amber-600">{cestasReservadas}</span>
              </div>
              <div
                onClick={() => navigate('/app/rotas')}
                className="cursor-pointer bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 p-2 rounded-xl transition-colors min-h-[44px]"
              >
                <span className="text-[10px] text-slate-500 block">No Carro</span>
                <span className="text-base font-black text-blue-600">{cestasNoCarro}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
              <div
                onClick={() => navigate('/app/estoque')}
                className="cursor-pointer flex items-center justify-between p-2 rounded-lg bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-100/50"
              >
                <span className="text-slate-600 dark:text-slate-400">Comp. Abaixo Mín.:</span>
                <Badge
                  variant={componentesAbaixoMinimo > 0 ? 'destructive' : 'outline'}
                  className="text-xs"
                >
                  {componentesAbaixoMinimo}
                </Badge>
              </div>
              <div
                onClick={() => navigate('/app/estoque')}
                className="cursor-pointer flex items-center justify-between p-2 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/50"
              >
                <span className="text-slate-600 dark:text-slate-400">Lotes 30d:</span>
                <Badge
                  variant={lotesVencendo30Dias > 0 ? 'secondary' : 'outline'}
                  className="text-xs"
                >
                  {lotesVencendo30Dias}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CARD 4: OPERAÇÃO / ROTAS */}
        <Card className="rounded-2xl border-slate-200/80 dark:border-[#1A2C50] shadow-xs overflow-hidden">
          <CardHeader className="p-4 pb-2 border-b border-slate-100 dark:border-[#1A2C50] flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-600 flex items-center justify-center">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold">Operação & Rotas</CardTitle>
                <p className="text-[11px] text-slate-500">Expedição e entrega</p>
              </div>
            </div>
            <Link
              to="/app/rotas"
              className="text-xs text-[#0066FF] hover:underline font-semibold flex items-center gap-1"
            >
              Rotas <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div
                onClick={() => navigate('/app/pedidos')}
                className="cursor-pointer bg-slate-50 dark:bg-slate-900/60 p-2 rounded-xl min-h-[44px]"
              >
                <span className="text-[10px] text-slate-500 block">Pedidos Pendentes</span>
                <span className="text-base font-bold text-amber-600">{pedidosPendentes}</span>
              </div>
              <div
                onClick={() => navigate('/app/pedidos')}
                className="cursor-pointer bg-slate-50 dark:bg-slate-900/60 p-2 rounded-xl min-h-[44px]"
              >
                <span className="text-[10px] text-slate-500 block">Confirmados/Faturados</span>
                <span className="text-base font-bold text-emerald-600">{pedidosConfirmados}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-slate-500 block">Rotas Abertas / Fechadas</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {rotasAbertas} abertas • {rotasFinalizadas} fechadas
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Entregas no Período</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {entregasFeitas} entregues • {entregasNaoFeitas} falhas
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. MARGEM BRUTA DO PERÍODO & POR CESTA (Apenas Master, Admin, Gerente) */}
      {podeVerCustoEMargem && (
        <Card className="rounded-2xl border-slate-200/80 dark:border-[#1A2C50] shadow-xs">
          <CardHeader className="p-4 pb-2 border-b border-slate-100 dark:border-[#1A2C50]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-emerald-600" />
                <CardTitle className="text-sm font-bold">
                  Margem Bruta do Período (Preço − Custo Histórico)
                </CardTitle>
              </div>
              <span className="text-[11px] text-slate-500">
                Custo de aquisição/montagem fixado no ato da venda
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-xl border border-emerald-200/50 dark:border-emerald-900/30">
              <div>
                <span className="text-[11px] text-emerald-900 dark:text-emerald-300 block">
                  Faturamento Válido
                </span>
                <span className="text-lg font-black text-emerald-950 dark:text-emerald-100">
                  {formatCurrency(vendasTotal)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-emerald-900 dark:text-emerald-300 block">
                  Custo Histórico dos Produtos
                </span>
                <span className="text-lg font-bold text-slate-700 dark:text-slate-300">
                  {formatCurrency(custoHistoricoTotal)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-emerald-900 dark:text-emerald-300 block">
                  Margem Bruta (Lucro Bruto)
                </span>
                <span className="text-lg font-black text-emerald-600">
                  {formatCurrency(margemBrutaTotal)} ({margemBrutaPercentual}%)
                </span>
              </div>
            </div>

            {/* Top Cestas por Margem */}
            {topCestasMargem.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Margem por Cesta (Top {topCestasMargem.length})
                </h4>
                <div className="space-y-2">
                  {topCestasMargem.map((c, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800"
                    >
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {c.nome} ({c.quantidade} un)
                      </span>
                      <div className="text-right">
                        <span className="font-bold text-emerald-600 block">
                          {formatCurrency(c.margem)} ({c.percentual}%)
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Fat: {formatCurrency(c.faturamento)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 4. VENDAS POR CANAL */}
      <Card className="rounded-2xl border-slate-200/80 dark:border-[#1A2C50] shadow-xs">
        <CardHeader className="p-4 pb-2 border-b border-slate-100 dark:border-[#1A2C50]">
          <CardTitle className="text-sm font-bold">Vendas por Canal de Atendimento</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 block">Presencial</span>
              <span className="font-black text-slate-900 dark:text-white block mt-0.5">
                {formatCurrency(vendasPorCanal.presencial.faturamento)}
              </span>
              <span className="text-[10px] text-slate-400">
                {vendasPorCanal.presencial.quantidade} vendas
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 block">WhatsApp</span>
              <span className="font-black text-slate-900 dark:text-white block mt-0.5">
                {formatCurrency(vendasPorCanal.whatsapp.faturamento)}
              </span>
              <span className="text-[10px] text-slate-400">
                {vendasPorCanal.whatsapp.quantidade} vendas
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 block">Telefone</span>
              <span className="font-black text-slate-900 dark:text-white block mt-0.5">
                {formatCurrency(vendasPorCanal.telefone.faturamento)}
              </span>
              <span className="text-[10px] text-slate-400">
                {vendasPorCanal.telefone.quantidade} vendas
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 block">Instagram</span>
              <span className="font-black text-slate-900 dark:text-white block mt-0.5">
                {formatCurrency(vendasPorCanal.instagram.faturamento)}
              </span>
              <span className="text-[10px] text-slate-400">
                {vendasPorCanal.instagram.quantidade} vendas
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 block">Venda na Rua</span>
              <span className="font-black text-slate-900 dark:text-white block mt-0.5">
                {formatCurrency(vendasPorCanal.rua.faturamento)}
              </span>
              <span className="text-[10px] text-slate-400">
                {vendasPorCanal.rua.quantidade} vendas
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 block">Outro</span>
              <span className="font-black text-slate-900 dark:text-white block mt-0.5">
                {formatCurrency(vendasPorCanal.outro.faturamento)}
              </span>
              <span className="text-[10px] text-slate-400">
                {vendasPorCanal.outro.quantidade} vendas
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
