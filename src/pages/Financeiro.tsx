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
import { FinanceiroService } from '@/services/financeiro'
import { DollarSign, TrendingUp, AlertTriangle, Plus, Calendar } from 'lucide-react'

export default function FinanceiroPage() {
  const { empresaId } = useEmpresa()
  const [receber, setReceber] = useState<any[]>([])
  const [pagar, setPagar] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'receber' | 'pagar'>('receber')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    if (!empresaId) return
    setLoading(true)
    setError(null)
    try {
      const [recRes, pagRes] = await Promise.all([
        FinanceiroService.listContasReceber(empresaId),
        FinanceiroService.listContasPagar(empresaId),
      ])
      if (recRes.error) throw recRes.error
      if (pagRes.error) throw pagRes.error

      setReceber(recRes.data || [])
      setPagar(pagRes.data || [])
    } catch (e: any) {
      setError(e.message || 'Falha ao buscar dados financeiros')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [empresaId])

  const totalReceber = receber.reduce((acc, c) => acc + (c.valor || 0), 0)
  const totalReceberPendente = receber
    .filter((c) => c.status === 'pendente')
    .reduce((acc, c) => acc + (c.valor || 0) - (c.valor_pago || 0), 0)

  const totalPagar = pagar.reduce((acc, c) => acc + (c.valor || 0), 0)
  const totalPagarPendente = pagar
    .filter((c) => c.status === 'pendente')
    .reduce((acc, c) => acc + (c.valor || 0) - (c.valor_pago || 0), 0)

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestão Financeira"
        description="Fluxo de caixa, títulos a receber de clientes e contas a pagar a fornecedores."
        actions={
          <div className="flex items-center gap-2">
            <Button className="bg-teal-700 hover:bg-teal-800 text-white flex items-center gap-1.5 shadow-sm">
              <Plus className="w-4 h-4" />
              Novo Lançamento
            </Button>
          </div>
        }
      />

      {/* Financial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total a Receber"
          value={formatCurrency(totalReceber)}
          subtitle={`Pendente: ${formatCurrency(totalReceberPendente)}`}
          icon={TrendingUp}
        />
        <MetricCard
          title="Total a Pagar"
          value={formatCurrency(totalPagar)}
          subtitle={`Pendente: ${formatCurrency(totalPagarPendente)}`}
          icon={AlertTriangle}
        />
        <MetricCard
          title="Saldo Previsto"
          value={formatCurrency(totalReceberPendente - totalPagarPendente)}
          subtitle="Previsão de caixa líquido"
          icon={DollarSign}
        />
        <MetricCard
          title="Títulos Totais"
          value={`${receber.length + pagar.length}`}
          subtitle={`${receber.length} a receber | ${pagar.length} a pagar`}
          icon={Calendar}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('receber')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'receber'
              ? 'border-teal-600 text-teal-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Contas a Receber ({receber.length})
        </button>
        <button
          onClick={() => setActiveTab('pagar')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'pagar'
              ? 'border-teal-600 text-teal-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Contas a Pagar ({pagar.length})
        </button>
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : activeTab === 'receber' ? (
        receber.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title="Nenhuma conta a receber"
            description="Títulos originados de vendas a prazo aparecerão aqui automaticamente."
          />
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-3.5 px-4">Descrição</th>
                    <th className="py-3.5 px-4">Cliente</th>
                    <th className="py-3.5 px-4">Vencimento</th>
                    <th className="py-3.5 px-4">Valor Total</th>
                    <th className="py-3.5 px-4">Valor Pago</th>
                    <th className="py-3.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {receber.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">{item.descricao}</td>
                      <td className="py-3 px-4 text-slate-600">{item.clientes?.nome || '-'}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {new Date(item.vencimento).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 tabular-nums">
                        {formatCurrency(item.valor || 0)}
                      </td>
                      <td className="py-3 px-4 tabular-nums text-slate-600">
                        {formatCurrency(item.valor_pago || 0)}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={
                            item.status === 'pago'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }
                        >
                          {item.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : pagar.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="Nenhuma conta a pagar"
          description="Cadastre despesas e compromissos com fornecedores para controlar o fluxo de caixa."
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3.5 px-4">Descrição</th>
                  <th className="py-3.5 px-4">Fornecedor</th>
                  <th className="py-3.5 px-4">Vencimento</th>
                  <th className="py-3.5 px-4">Valor Total</th>
                  <th className="py-3.5 px-4">Valor Pago</th>
                  <th className="py-3.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagar.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">{item.descricao}</td>
                    <td className="py-3 px-4 text-slate-600">{item.fornecedores?.nome || '-'}</td>
                    <td className="py-3 px-4 text-slate-600">
                      {new Date(item.vencimento).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 tabular-nums">
                      {formatCurrency(item.valor || 0)}
                    </td>
                    <td className="py-3 px-4 tabular-nums text-slate-600">
                      {formatCurrency(item.valor_pago || 0)}
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant="outline"
                        className={
                          item.status === 'pago'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }
                      >
                        {item.status}
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
