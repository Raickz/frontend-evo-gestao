import { useState, useEffect } from 'react'
import { PageHeader, EmptyState, TableSkeleton, ErrorState } from '@/components/common/CommonUI'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useEmpresa } from '@/hooks/use-empresa'
import { VendedoresService } from '@/services/vendedores'
import { UserCheck, Plus, Percent } from 'lucide-react'

export default function VendedoresPage() {
  const { empresaId } = useEmpresa()
  const [vendedores, setVendedores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadVendedores = async () => {
    if (!empresaId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await VendedoresService.list(empresaId)
      if (err) throw err
      setVendedores(data || [])
    } catch (e: any) {
      setError(e.message || 'Falha ao buscar vendedores')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadVendedores()
  }, [empresaId])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipe de Vendedores"
        description="Gestão da equipe comercial, metas e percentuais de comissão."
        badge={`${vendedores.length} Vendedores`}
        actions={
          <Button className="bg-teal-700 hover:bg-teal-800 text-white flex items-center gap-1.5 shadow-sm">
            <Plus className="w-4 h-4" />
            Novo Vendedor
          </Button>
        }
      />

      {loading ? (
        <TableSkeleton rows={4} cols={4} />
      ) : error ? (
        <ErrorState message={error} onRetry={loadVendedores} />
      ) : vendedores.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title="Nenhum vendedor cadastrado"
          description="Cadastre vendedores para associá-los a clientes, pedidos e apuração de comissões."
          actionLabel="Cadastrar Vendedor"
          onAction={() => {}}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3.5 px-4">Nome do Vendedor</th>
                  <th className="py-3.5 px-4">Usuário Vinculado</th>
                  <th className="py-3.5 px-4">Comissão Padrão</th>
                  <th className="py-3.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vendedores.map((vend) => (
                  <tr key={vend.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">{vend.nome}</td>
                    <td className="py-3 px-4 text-slate-600">
                      {vend.usuarios?.email || 'Sem usuário vinculado'}
                    </td>
                    <td className="py-3 px-4 font-bold text-teal-700 tabular-nums">
                      {vend.percentual_comissao}%
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant="outline"
                        className={
                          vend.ativo
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }
                      >
                        {vend.ativo ? 'Ativo' : 'Inativo'}
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
