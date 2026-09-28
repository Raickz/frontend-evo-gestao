import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useEmpresa } from '@/hooks/use-empresa'
import { formatCurrency } from '@/lib/utils'
import {
  RelatoriosService,
  PeriodoFiltro,
  CestaRelatorioItem,
  CanalRelatorioItem,
  RecebimentosFormaItem,
  RotaRelatorioItem,
  InadimplenciaFaixasData,
} from '@/services/relatorios'
import {
  Download,
  Share2,
  RefreshCw,
  ShoppingBag,
  Users,
  CreditCard,
  Truck,
  AlertTriangle,
  FileSpreadsheet,
  Calendar,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'

interface RelatoriosCestasAvancadosProps {
  periodo: PeriodoFiltro
}

export function RelatoriosCestasAvancados({ periodo }: RelatoriosCestasAvancadosProps) {
  const { empresaId, empresa } = useEmpresa()
  const [loading, setLoading] = useState(false)

  // Dados das Abas
  const [cestasData, setCestasData] = useState<CestaRelatorioItem[]>([])
  const [canaisData, setCanaisData] = useState<CanalRelatorioItem[]>([])
  const [recebimentosData, setRecebimentosData] = useState<{
    porForma: RecebimentosFormaItem[]
    aVistaVsParcelado: { a_vista: number; parcelado: number; total: number }
  }>({
    porForma: [],
    aVistaVsParcelado: { a_vista: 0, parcelado: 0, total: 0 },
  })
  const [rotasData, setRotasData] = useState<RotaRelatorioItem[]>([])
  const [inadimplenciaData, setInadimplenciaData] = useState<InadimplenciaFaixasData | null>(null)

  const carregarTodosRelatorios = useCallback(async () => {
    if (!empresaId) return
    setLoading(true)

    try {
      const [cRes, canRes, recRes, rotRes, inadRes] = await Promise.all([
        RelatoriosService.getRelatorioPorCesta(empresaId, periodo),
        RelatoriosService.getRelatorioPorCanal(empresaId, periodo),
        RelatoriosService.getRelatorioRecebimentos(empresaId, periodo),
        RelatoriosService.getRelatorioRotas(empresaId, periodo),
        RelatoriosService.getInadimplenciaFaixas(),
      ])

      setCestasData(cRes)
      setCanaisData(canRes)
      setRecebimentosData(recRes)
      setRotasData(rotRes)
      setInadimplenciaData(inadRes)
    } catch (err) {
      if (import.meta.env.DEV) console.error('Erro ao carregar relatórios avançados:', err)
      toast({
        title: 'Erro ao carregar relatórios',
        description: 'Não foi possível carregar os dados completos do período.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [empresaId, periodo])

  useEffect(() => {
    carregarTodosRelatorios()
  }, [carregarTodosRelatorios])

  // EXPORTAR CSV
  const exportarCsv = (nomeArquivo: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((e) => e.map((val) => `"${val}"`).join(';'))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `${nomeArquivo}_${periodo.inicio}_a_${periodo.fim}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast({ title: 'Exportação concluída', description: 'Arquivo CSV gerado com sucesso.' })
  }

  // COMPARTILHAR WHATSAPP
  const compartilharResumoWhatsApp = () => {
    const empNome = empresa?.nome_fantasia || (empresa as any)?.razao_social || 'Distribuidora'
    const totalCestasVendidas = cestasData.reduce((acc, c) => acc + c.quantidade_vendida, 0)
    const totalFatCestas = cestasData.reduce((acc, c) => acc + c.faturamento, 0)
    const totalMargem = cestasData.reduce((acc, c) => acc + c.margem_bruta, 0)

    const texto = `*RESUMO OPERACIONAL - ${empNome.toUpperCase()}*
📅 Período: ${periodo.inicio} até ${periodo.fim}

🧺 *Vendas por Cesta:*
• Cestas vendidas: ${totalCestasVendidas} un
• Faturamento: ${formatCurrency(totalFatCestas)}
• Margem Bruta: ${formatCurrency(totalMargem)}

💳 *Recebimentos:*
• À Vista: ${formatCurrency(recebimentosData.aVistaVsParcelado.a_vista)}
• A Prazo/Fiado: ${formatCurrency(recebimentosData.aVistaVsParcelado.parcelado)}

🚚 *Rotas do Período:*
• Total de rotas: ${rotasData.length}
• Cestas entregues: ${rotasData.reduce((acc, r) => acc + r.cestas_entregues, 0)} un

⚠️ *Inadimplência:*
• Vencido: ${formatCurrency(inadimplenciaData?.total_vencido || 0)} (${inadimplenciaData?.clientes_inadimplentes_count || 0} clientes)

_Gerado via EVO Gestão Distribuidora_`

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`
    window.open(url, '_blank')
  }

  return (
    <Card className="rounded-2xl border-slate-200/80 dark:border-[#1A2C50] shadow-xs">
      <CardHeader className="p-4 pb-2 border-b border-slate-100 dark:border-[#1A2C50] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#0066FF]" />
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
              Relatórios da Distribuidora de Cestas
            </CardTitle>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Visão consolidada por cestas, canais, recebimentos, rotas e inadimplência detalhada
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={carregarTodosRelatorios}
            disabled={loading}
            className="h-9 min-h-[44px] text-xs rounded-xl"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={compartilharResumoWhatsApp}
            className="h-9 min-h-[44px] text-xs rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold"
          >
            <Share2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            WhatsApp
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-3 sm:p-4">
        <Tabs defaultValue="cestas" className="space-y-4">
          <TabsList className="grid grid-cols-2 sm:grid-cols-5 h-auto p-1 bg-slate-100 dark:bg-[#0A1328] rounded-xl gap-1">
            <TabsTrigger value="cestas" className="text-xs py-2 min-h-[40px] rounded-lg">
              Por Cesta
            </TabsTrigger>
            <TabsTrigger value="canais" className="text-xs py-2 min-h-[40px] rounded-lg">
              Canais & Vendedor
            </TabsTrigger>
            <TabsTrigger value="recebimentos" className="text-xs py-2 min-h-[40px] rounded-lg">
              Recebimentos
            </TabsTrigger>
            <TabsTrigger value="rotas" className="text-xs py-2 min-h-[40px] rounded-lg">
              Rotas do Dia
            </TabsTrigger>
            <TabsTrigger value="inadimplencia" className="text-xs py-2 min-h-[40px] rounded-lg">
              Inadimplência
            </TabsTrigger>
          </TabsList>

          {/* ABA 1: POR CESTA */}
          <TabsContent value="cestas" className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Detalhamento financeiro e margem bruta por cesta
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs h-8 text-[#0066FF]"
                onClick={() =>
                  exportarCsv(
                    'relatorio_por_cesta',
                    [
                      'Cesta',
                      'Qtd Vendida',
                      'Faturamento',
                      'Custo Total',
                      'Margem Bruta (R$)',
                      'Margem (%)',
                    ],
                    cestasData.map((c) => [
                      c.nome,
                      c.quantidade_vendida,
                      c.faturamento.toFixed(2),
                      c.custo_total.toFixed(2),
                      c.margem_bruta.toFixed(2),
                      `${c.margem_percentual}%`,
                    ]),
                  )
                }
              >
                <Download className="w-3.5 h-3.5 mr-1" /> Exportar CSV
              </Button>
            </div>

            <div className="overflow-x-auto border border-slate-200/80 dark:border-[#1A2C50] rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-[#0A1328] border-b border-slate-200/80 dark:border-[#1A2C50] text-slate-500">
                  <tr>
                    <th className="py-2.5 px-3">Cesta</th>
                    <th className="py-2.5 px-3 text-center">Qtd</th>
                    <th className="py-2.5 px-3 text-right">Faturamento</th>
                    <th className="py-2.5 px-3 text-right">Custo Histórico</th>
                    <th className="py-2.5 px-3 text-right">Margem Bruta</th>
                    <th className="py-2.5 px-3 text-right">% Margem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1A2C50]">
                  {cestasData.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        Nenhuma cesta vendida no período.
                      </td>
                    </tr>
                  ) : (
                    cestasData.map((c) => (
                      <tr key={c.cesta_id} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white">
                          {c.nome}
                        </td>
                        <td className="py-2 px-3 text-center font-bold">
                          {c.quantidade_vendida} un
                        </td>
                        <td className="py-2 px-3 text-right font-black text-slate-900 dark:text-white">
                          {formatCurrency(c.faturamento)}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-400">
                          {formatCurrency(c.custo_total)}
                        </td>
                        <td className="py-2 px-3 text-right font-black text-emerald-600">
                          {formatCurrency(c.margem_bruta)}
                        </td>
                        <td className="py-2 px-3 text-right font-semibold">
                          <Badge
                            variant={c.margem_percentual >= 20 ? 'default' : 'secondary'}
                            className="text-[10px]"
                          >
                            {c.margem_percentual}%
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* ABA 2: CANAIS & VENDEDOR */}
          <TabsContent value="canais" className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Vendas por canal de atendimento
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs h-8 text-[#0066FF]"
                onClick={() =>
                  exportarCsv(
                    'relatorio_por_canal',
                    ['Canal', 'Qtd Vendas', 'Faturamento', 'Ticket Médio'],
                    canaisData.map((c) => [
                      c.canal,
                      c.quantidade_vendas,
                      c.faturamento.toFixed(2),
                      c.ticket_medio.toFixed(2),
                    ]),
                  )
                }
              >
                <Download className="w-3.5 h-3.5 mr-1" /> Exportar CSV
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {canaisData.map((c) => (
                <div
                  key={c.canal}
                  className="p-3 rounded-xl border border-slate-200/80 dark:border-[#1A2C50] bg-slate-50/50 dark:bg-slate-900/40 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                      {c.canal}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {c.quantidade_vendas} vendas
                    </Badge>
                  </div>
                  <div className="flex items-baseline justify-between pt-1">
                    <span className="text-[11px] text-slate-500">Faturamento:</span>
                    <span className="text-sm font-black text-slate-900 dark:text-white">
                      {formatCurrency(c.faturamento)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-slate-500">Ticket Médio:</span>
                    <span className="text-xs font-semibold text-[#0066FF]">
                      {formatCurrency(c.ticket_medio)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ABA 3: RECEBIMENTOS */}
          <TabsContent value="recebimentos" className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Recebimentos por forma e à vista versus parcelado/fiado
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs h-8 text-[#0066FF]"
                onClick={() =>
                  exportarCsv(
                    'relatorio_recebimentos_formas',
                    ['Forma', 'Tipo', 'Qtd', 'Valor Total', 'Percentual'],
                    recebimentosData.porForma.map((f) => [
                      f.forma,
                      f.tipo,
                      f.quantidade,
                      f.valor_total.toFixed(2),
                      `${f.percentual}%`,
                    ]),
                  )
                }
              >
                <Download className="w-3.5 h-3.5 mr-1" /> Exportar CSV
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl border border-slate-200/80 dark:border-[#1A2C50] bg-slate-50/50 dark:bg-slate-900/40">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                  Divisão: À Vista x Parcelado
                </span>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">À Vista (Dinheiro/PIX/Cartão):</span>
                    <span className="font-bold text-emerald-600">
                      {formatCurrency(recebimentosData.aVistaVsParcelado.a_vista)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Parcelado / Crediário / Fiado:</span>
                    <span className="font-bold text-amber-600">
                      {formatCurrency(recebimentosData.aVistaVsParcelado.parcelado)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                    <span className="font-bold text-slate-700">Total Faturado:</span>
                    <span className="font-black text-slate-900 dark:text-white">
                      {formatCurrency(recebimentosData.aVistaVsParcelado.total)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-slate-200/80 dark:border-[#1A2C50] bg-slate-50/50 dark:bg-slate-900/40">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                  Por Forma de Pagamento
                </span>
                <div className="space-y-1.5 text-xs">
                  {recebimentosData.porForma.map((f) => (
                    <div
                      key={f.forma}
                      className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0"
                    >
                      <span className="capitalize text-slate-700 dark:text-slate-300">
                        {f.forma} ({f.quantidade})
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {formatCurrency(f.valor_total)} ({f.percentual}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ABA 4: ROTAS */}
          <TabsContent value="rotas" className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Resumo por rota e dia: carregadas, vendidas, entregues e divergências
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs h-8 text-[#0066FF]"
                onClick={() =>
                  exportarCsv(
                    'relatorio_rotas',
                    [
                      'Rota #',
                      'Data',
                      'Status',
                      'Veículo',
                      'Responsável',
                      'Carregadas',
                      'Vendidas',
                      'Entregues',
                      'Devolvidas',
                      'Recebido (R$)',
                      'Divergência',
                    ],
                    rotasData.map((r) => [
                      r.numero,
                      r.data,
                      r.status,
                      r.veiculo_nome,
                      r.responsavel_nome,
                      r.cestas_carregadas,
                      r.cestas_vendidas,
                      r.cestas_entregues,
                      r.cestas_devolvidas,
                      r.total_recebido.toFixed(2),
                      r.tem_divergencia ? 'Sim' : 'Não',
                    ]),
                  )
                }
              >
                <Download className="w-3.5 h-3.5 mr-1" /> Exportar CSV
              </Button>
            </div>

            <div className="space-y-2">
              {rotasData.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  Nenhuma rota registrada no período selecionado.
                </div>
              ) : (
                rotasData.map((r) => (
                  <div
                    key={r.rota_id}
                    className="p-3 rounded-xl border border-slate-200/80 dark:border-[#1A2C50] bg-white dark:bg-[#0A1328] space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-[#0066FF]" />
                        <span className="font-bold text-xs">
                          Rota #{r.numero} ({r.data})
                        </span>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {r.status}
                        </Badge>
                      </div>
                      {r.tem_divergencia && (
                        <Badge variant="destructive" className="text-[10px]">
                          Divergência de Fechamento
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      <span>
                        {r.veiculo_nome} • Resp: {r.responsavel_nome}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs pt-1 border-t border-slate-100">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Carregadas</span>
                        <span className="font-bold">{r.cestas_carregadas}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Vendidas</span>
                        <span className="font-bold text-blue-600">{r.cestas_vendidas}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Entregues</span>
                        <span className="font-bold text-emerald-600">{r.cestas_entregues}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Devolvidas</span>
                        <span className="font-bold text-amber-600">{r.cestas_devolvidas}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Recebido</span>
                        <span className="font-black text-slate-900 dark:text-white">
                          {formatCurrency(r.total_recebido)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {/* ABA 5: INADIMPLÊNCIA POR FAIXA */}
          <TabsContent value="inadimplencia" className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Classificação da carteira por faixas de atraso (aging de recebíveis)
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs h-8 text-[#0066FF]"
                onClick={() => {
                  if (!inadimplenciaData) return
                  exportarCsv(
                    'relatorio_inadimplencia_faixas',
                    ['Faixa', 'Total em Aberto (R$)', 'Nº Clientes', 'Nº Títulos'],
                    [
                      [
                        'A vencer',
                        inadimplenciaData.a_vencer.total.toFixed(2),
                        inadimplenciaData.a_vencer.clientes_count,
                        inadimplenciaData.a_vencer.titulos_count,
                      ],
                      [
                        '1 a 30 dias',
                        inadimplenciaData.dias_1_30.total.toFixed(2),
                        inadimplenciaData.dias_1_30.clientes_count,
                        inadimplenciaData.dias_1_30.titulos_count,
                      ],
                      [
                        '31 a 60 dias',
                        inadimplenciaData.dias_31_60.total.toFixed(2),
                        inadimplenciaData.dias_31_60.clientes_count,
                        inadimplenciaData.dias_31_60.titulos_count,
                      ],
                      [
                        '61 a 90 dias',
                        inadimplenciaData.dias_61_90.total.toFixed(2),
                        inadimplenciaData.dias_61_90.clientes_count,
                        inadimplenciaData.dias_61_90.titulos_count,
                      ],
                      [
                        'Mais de 90 dias',
                        inadimplenciaData.mais_90.total.toFixed(2),
                        inadimplenciaData.mais_90.clientes_count,
                        inadimplenciaData.mais_90.titulos_count,
                      ],
                    ],
                  )
                }}
              >
                <Download className="w-3.5 h-3.5 mr-1" /> Exportar CSV
              </Button>
            </div>

            {inadimplenciaData && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {/* A Vencer */}
                  <div className="p-3 rounded-xl border border-slate-200/80 dark:border-[#1A2C50] bg-slate-50/50">
                    <span className="text-[11px] font-bold text-slate-600 block">A Vencer</span>
                    <span className="text-base font-black text-slate-800 dark:text-white block mt-1">
                      {formatCurrency(inadimplenciaData.a_vencer.total)}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {inadimplenciaData.a_vencer.clientes_count} clientes •{' '}
                      {inadimplenciaData.a_vencer.titulos_count} títulos
                    </span>
                  </div>

                  {/* 1 - 30 dias */}
                  <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20">
                    <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 block">
                      1 a 30 dias
                    </span>
                    <span className="text-base font-black text-amber-900 dark:text-amber-200 block mt-1">
                      {formatCurrency(inadimplenciaData.dias_1_30.total)}
                    </span>
                    <span className="text-[10px] text-amber-700 dark:text-amber-400">
                      {inadimplenciaData.dias_1_30.clientes_count} clientes •{' '}
                      {inadimplenciaData.dias_1_30.titulos_count} títulos
                    </span>
                  </div>

                  {/* 31 - 60 dias */}
                  <div className="p-3 rounded-xl border border-orange-200 dark:border-orange-900/60 bg-orange-50/50 dark:bg-orange-950/20">
                    <span className="text-[11px] font-bold text-orange-800 dark:text-orange-300 block">
                      31 a 60 dias
                    </span>
                    <span className="text-base font-black text-orange-900 dark:text-orange-200 block mt-1">
                      {formatCurrency(inadimplenciaData.dias_31_60.total)}
                    </span>
                    <span className="text-[10px] text-orange-700 dark:text-orange-400">
                      {inadimplenciaData.dias_31_60.clientes_count} clientes •{' '}
                      {inadimplenciaData.dias_31_60.titulos_count} títulos
                    </span>
                  </div>

                  {/* 61 - 90 dias */}
                  <div className="p-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20">
                    <span className="text-[11px] font-bold text-rose-800 dark:text-rose-300 block">
                      61 a 90 dias
                    </span>
                    <span className="text-base font-black text-rose-900 dark:text-rose-200 block mt-1">
                      {formatCurrency(inadimplenciaData.dias_61_90.total)}
                    </span>
                    <span className="text-[10px] text-rose-700 dark:text-rose-400">
                      {inadimplenciaData.dias_61_90.clientes_count} clientes •{' '}
                      {inadimplenciaData.dias_61_90.titulos_count} títulos
                    </span>
                  </div>

                  {/* +90 dias */}
                  <div className="p-3 rounded-xl border border-rose-400 dark:border-rose-900 bg-rose-100/60 dark:bg-rose-950/40">
                    <span className="text-[11px] font-bold text-rose-950 dark:text-rose-200 block">
                      +90 dias (Crítico)
                    </span>
                    <span className="text-base font-black text-rose-950 dark:text-rose-100 block mt-1">
                      {formatCurrency(inadimplenciaData.mais_90.total)}
                    </span>
                    <span className="text-[10px] text-rose-800 dark:text-rose-300">
                      {inadimplenciaData.mais_90.clientes_count} clientes •{' '}
                      {inadimplenciaData.mais_90.titulos_count} títulos
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Total Vencido em Aberto:</span>
                  <span className="text-sm font-black text-rose-600">
                    {formatCurrency(inadimplenciaData.total_vencido)} (
                    {inadimplenciaData.clientes_inadimplentes_count} clientes em débito)
                  </span>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
