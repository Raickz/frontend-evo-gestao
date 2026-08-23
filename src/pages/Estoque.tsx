import { useState, useEffect } from 'react'
import { PageHeader, EmptyState, TableSkeleton, ErrorState } from '@/components/common/CommonUI'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useEmpresa } from '@/hooks/use-empresa'
import { EstoqueService } from '@/services/estoque'
import { Boxes, ArrowDownRight, ArrowUpRight, Plus, History } from 'lucide-react'

export default function EstoquePage() {
  const { empresaId } = useEmpresa()
  const [saldos, setSaldos] = useState<any[]>([])
  const [movimentacoes, setMovimentacoes] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'saldos' | 'movimentacoes'>('saldos')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    if (!empresaId) return
    setLoading(true)
    setError(null)
    try {
      const [saldosRes, movRes] = await Promise.all([
        EstoqueService.listSaldos(empresaId),
        EstoqueService.listMovimentacoes(empresaId),
      ])
      if (saldosRes.error) throw saldosRes.error
      if (movRes.error) throw movRes.error

      setSaldos(saldosRes.data || [])
      setMovimentacoes(movRes.data || [])
    } catch (e: any) {
      setError(e.message || 'Falha ao carregar dados do estoque')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [empresaId])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Controle de Estoque"
        description="Acompanhamento de posições de saldo e histórico de movimentações (entradas/saídas)."
        actions={
          <div className="flex items-center gap-2">
            <Button className="bg-teal-700 hover:bg-teal-800 text-white flex items-center gap-1.5 shadow-sm">
              <Plus className="w-4 h-4" />
              Entrada de Estoque
            </Button>
          </div>
        }
      />

      {/* Tab Switcher */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('saldos')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'saldos'
              ? 'border-teal-600 text-teal-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Boxes className="w-4 h-4" />
          Saldos em Estoque ({saldos.length})
        </button>
        <button
          onClick={() => setActiveTab('movimentacoes')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'movimentacoes'
              ? 'border-teal-600 text-teal-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          Histórico de Movimentações ({movimentacoes.length})
        </button>
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : activeTab === 'saldos' ? (
        saldos.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title="Nenhum saldo registrado"
            description="Conforme os produtos receberem entradas ou forem criados, seus saldos aparecerão aqui."
            actionLabel="Registrar Entrada"
            onAction={() => {}}
          />
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-3.5 px-4">Produto</th>
                    <th className="py-3.5 px-4">Categoria</th>
                    <th className="py-3.5 px-4">Estoque Mínimo</th>
                    <th className="py-3.5 px-4">Quantidade Atual</th>
                    <th className="py-3.5 px-4">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {saldos.map((item) => {
                    const prod = item.produtos
                    const qtd = item.quantidade ?? 0
                    const min = prod?.estoque_minimo ?? 0
                    const isCritico = qtd <= min

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {prod?.nome || 'Produto'}
                          {prod?.codigo && (
                            <span className="ml-2 font-mono text-[10px] text-slate-400">
                              #{prod.codigo}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {prod?.categorias?.nome || '-'}
                        </td>
                        <td className="py-3 px-4 tabular-nums text-slate-500">
                          {min} {prod?.unidade || 'UN'}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900 tabular-nums">
                          {qtd} {prod?.unidade || 'UN'}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant="outline"
                            className={
                              isCritico
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }
                          >
                            {isCritico ? 'Estoque Baixo' : 'Regular'}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : /* Movimentações Table */
      movimentacoes.length === 0 ? (
        <EmptyState
          icon={History}
          title="Nenhuma movimentação registrada"
          description="O histórico de entradas e saídas de estoque será registrado automaticamente conforme as operações ocorrerem."
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3.5 px-4">Data / Hora</th>
                  <th className="py-3.5 px-4">Tipo</th>
                  <th className="py-3.5 px-4">Produto</th>
                  <th className="py-3.5 px-4">Quantidade</th>
                  <th className="py-3.5 px-4">Motivo</th>
                  <th className="py-3.5 px-4">Usuário</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movimentacoes.map((mov) => {
                  const isEntrada = mov.tipo === 'entrada'
                  return (
                    <tr key={mov.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(mov.created_at).toLocaleString('pt-BR')}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={`flex items-center gap-1 w-fit ${
                            isEntrada
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {isEntrada ? (
                            <ArrowDownRight className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <ArrowUpRight className="w-3 h-3 text-amber-600" />
                          )}
                          <span className="capitalize">{mov.tipo}</span>
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {mov.produtos?.nome || 'Produto'}
                      </td>
                      <td className="py-3 px-4 font-bold tabular-nums text-slate-900">
                        {isEntrada ? `+${mov.quantidade}` : `-${mov.quantidade}`}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{mov.motivo || '-'}</td>
                      <td className="py-3 px-4 text-slate-500">{mov.usuarios?.nome || '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
