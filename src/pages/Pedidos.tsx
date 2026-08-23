import { useState, useEffect } from 'react'
import { PageHeader, EmptyState, TableSkeleton, ErrorState } from '@/components/common/CommonUI'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useEmpresa } from '@/hooks/use-empresa'
import { PedidosService } from '@/services/pedidos'
import { ClipboardList, Plus, FileText } from 'lucide-react'

export default function PedidosPage() {
  const { empresaId } = useEmpresa()
  const [pedidos, setPedidos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPedidos = async () => {
    if (!empresaId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await PedidosService.list(empresaId)
      if (err) throw err
      setPedidos(data || [])
    } catch (e: any) {
      setError(e.message || 'Falha ao buscar pedidos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPedidos()
  }, [empresaId])

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestão de Pedidos"
        description="Acompanhe orçamentos e pedidos em aberto antes do faturamento final."
        badge={`${pedidos.length} Pedidos`}
        actions={
          <Button className="bg-teal-700 hover:bg-teal-800 text-white flex items-center gap-1.5 shadow-sm">
            <Plus className="w-4 h-4" />
            Novo Pedido
          </Button>
        }
      />

      {loading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : error ? (
        <ErrorState message={error} onRetry={loadPedidos} />
      ) : pedidos.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhum pedido gerado"
          description="Crie orçamentos e pré-pedidos de clientes para aprovação comercial."
          actionLabel="Criar Novo Pedido"
          onAction={() => {}}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3.5 px-4">Nº Pedido</th>
                  <th className="py-3.5 px-4">Cliente</th>
                  <th className="py-3.5 px-4">Vendedor</th>
                  <th className="py-3.5 px-4">Data</th>
                  <th className="py-3.5 px-4">Valor Total</th>
                  <th className="py-3.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pedidos.map((ped) => (
                  <tr key={ped.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">#{ped.numero}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {ped.clientes?.nome || 'Cliente não informado'}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{ped.vendedores?.nome || '-'}</td>
                    <td className="py-3 px-4 text-slate-500">
                      {new Date(ped.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 tabular-nums">
                      {formatCurrency(ped.total || 0)}
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant="outline"
                        className={
                          ped.status === 'aprovado'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : ped.status === 'pendente'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                        }
                      >
                        {ped.status}
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
