import { useState, useEffect } from 'react'
import { PageHeader, EmptyState, TableSkeleton, ErrorState } from '@/components/common/CommonUI'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useEmpresa } from '@/hooks/use-empresa'
import { VendasService } from '@/services/vendas'
import { ShoppingCart, Plus, Calendar, DollarSign, UserCheck } from 'lucide-react'

export default function VendasPage() {
  const { empresaId } = useEmpresa()
  const [vendas, setVendas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadVendas = async () => {
    if (!empresaId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await VendasService.list(empresaId)
      if (err) throw err
      setVendas(data || [])
    } catch (e: any) {
      setError(e.message || 'Falha ao buscar vendas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadVendas()
  }, [empresaId])

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendas Comerciais"
        description="Registro e histórico de faturamento e pedidos de vendas finalizados."
        badge={`${vendas.length} Registradas`}
        actions={
          <Button className="bg-teal-700 hover:bg-teal-800 text-white flex items-center gap-1.5 shadow-sm">
            <Plus className="w-4 h-4" />
            Nova Venda (PDV)
          </Button>
        }
      />

      {loading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={loadVendas} />
      ) : vendas.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="Nenhuma venda realizada ainda"
          description="Registre novas vendas para movimentar o estoque e alimentar as contas a receber e comissões."
          actionLabel="Iniciar Primeira Venda"
          onAction={() => {}}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3.5 px-4">Nº / Data</th>
                  <th className="py-3.5 px-4">Cliente</th>
                  <th className="py-3.5 px-4">Vendedor</th>
                  <th className="py-3.5 px-4">Forma Pagto</th>
                  <th className="py-3.5 px-4">Total</th>
                  <th className="py-3.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vendas.map((venda) => (
                  <tr key={venda.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-bold font-mono text-slate-900">#{venda.numero}</span>
                      <p className="text-[11px] text-slate-500">
                        {new Date(venda.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {venda.clientes?.nome || 'Consumidor Final'}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {venda.vendedores?.nome || venda.usuarios?.nome || '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="uppercase text-[11px] font-semibold bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                        {venda.forma_pagamento || 'PIX'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 tabular-nums text-sm">
                      {formatCurrency(venda.total || 0)}
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant="outline"
                        className={
                          venda.status === 'finalizada'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }
                      >
                        {venda.status}
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
