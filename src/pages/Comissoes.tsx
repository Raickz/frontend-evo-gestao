import { useState, useEffect } from 'react'
import {
  PageHeader,
  EmptyState,
  TableSkeleton,
  ErrorState,
  MetricCard,
} from '@/components/common/CommonUI'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useEmpresa } from '@/hooks/use-empresa'
import { VendedoresService } from '@/services/vendedores'
import { Percent, DollarSign, UserCheck, Calendar } from 'lucide-react'

export default function ComissoesPage() {
  const { empresaId } = useEmpresa()
  const [comissoes, setComissoes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadComissoes = async () => {
    if (!empresaId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await VendedoresService.listComissoes(empresaId)
      if (err) throw err
      setComissoes(data || [])
    } catch (e: any) {
      setError(e.message || 'Falha ao buscar comissões')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadComissoes()
  }, [empresaId])

  const totalComissoes = comissoes.reduce((acc, curr) => acc + (curr.valor_comissao || 0), 0)
  const totalComissoesPendentes = comissoes
    .filter((c) => c.status === 'pendente')
    .reduce((acc, curr) => acc + (curr.valor_comissao || 0), 0)

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Apuração de Comissões"
        description="Acompanhamento e liquidação de comissões por vendedor baseadas em vendas finalizadas."
        badge={`${comissoes.length} Registros`}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Total Comissões Geradas"
          value={formatCurrency(totalComissoes)}
          subtitle="Histórico total apurado"
          icon={Percent}
        />
        <MetricCard
          title="Comissões Pendentes"
          value={formatCurrency(totalComissoesPendentes)}
          subtitle="Aguardando liberação / pagamento"
          icon={DollarSign}
        />
        <MetricCard
          title="Vendas Comissionadas"
          value={`${comissoes.length}`}
          subtitle="Total de registros apurados"
          icon={Calendar}
        />
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={loadComissoes} />
      ) : comissoes.length === 0 ? (
        <EmptyState
          icon={Percent}
          title="Nenhuma comissão apurada"
          description="Quando vendas forem realizadas por vendedores com percentual definido, as comissões aparecerão aqui."
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3.5 px-4">Vendedor</th>
                  <th className="py-3.5 px-4">Venda Ref.</th>
                  <th className="py-3.5 px-4">Valor da Venda</th>
                  <th className="py-3.5 px-4">Alíquota (%)</th>
                  <th className="py-3.5 px-4">Valor Comissão</th>
                  <th className="py-3.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {comissoes.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {c.vendedores?.nome || 'Vendedor'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      #{c.vendas?.numero || '-'}
                    </td>
                    <td className="py-3 px-4 tabular-nums text-slate-600">
                      {formatCurrency(c.valor_venda || 0)}
                    </td>
                    <td className="py-3 px-4 font-mono text-teal-700 font-semibold">
                      {c.percentual}%
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 tabular-nums">
                      {formatCurrency(c.valor_comissao || 0)}
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant="outline"
                        className={
                          c.status === 'paga'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }
                      >
                        {c.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
