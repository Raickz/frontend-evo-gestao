import { useState, useEffect } from 'react'
import { PageHeader, EmptyState, TableSkeleton, ErrorState } from '@/components/common/CommonUI'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useEmpresa } from '@/hooks/use-empresa'
import { ClientesService, Cliente } from '@/services/clientes'
import { Users, Plus, Search, Phone, Mail, MapPin, Building } from 'lucide-react'

export default function ClientesPage() {
  const { empresaId } = useEmpresa()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const loadClientes = async () => {
    if (!empresaId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await ClientesService.list(empresaId)
      if (err) throw err
      setClientes(data || [])
    } catch (e: any) {
      setError(e.message || 'Falha ao buscar clientes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadClientes()
  }, [empresaId])

  const filteredClientes = clientes.filter(
    (c) =>
      c.nome.toLowerCase().includes(search.toLowerCase()) ||
      c.documento?.toLowerCase().includes(search.toLowerCase()) ||
      c.cidade?.toLowerCase().includes(search.toLowerCase()),
  )

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestão de Clientes"
        description="Consulte a carteira de clientes, limites de crédito e contatos da distribuidora."
        badge={`${clientes.length} Cadastrados`}
        actions={
          <Button className="bg-teal-700 hover:bg-teal-800 text-white flex items-center gap-1.5 shadow-sm">
            <Plus className="w-4 h-4" />
            Novo Cliente
          </Button>
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <Input
            placeholder="Buscar por nome, CPF/CNPJ ou cidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 bg-slate-50 border-slate-200 text-xs"
          />
        </div>
      </div>

      {/* Content State */}
      {loading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : error ? (
        <ErrorState message={error} onRetry={loadClientes} />
      ) : filteredClientes.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
          description={
            search
              ? 'Tente ajustar os filtros de busca para encontrar o registro desejado.'
              : 'Cadastre seus primeiros clientes para iniciar os pedidos e vendas comerciais.'
          }
          actionLabel={search ? undefined : 'Cadastrar Primeiro Cliente'}
          onAction={search ? undefined : () => {}}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3.5 px-4">Cliente / Razão</th>
                  <th className="py-3.5 px-4">Documento</th>
                  <th className="py-3.5 px-4">Contato</th>
                  <th className="py-3.5 px-4">Localização</th>
                  <th className="py-3.5 px-4">Limite Crédito</th>
                  <th className="py-3.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClientes.map((cliente) => (
                  <tr key={cliente.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {cliente.nome}
                      {cliente.observacoes && (
                        <p className="text-[11px] font-normal text-slate-600 truncate max-w-xs">
                          {cliente.observacoes}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {cliente.documento || '-'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-0.5">
                        {cliente.telefone && (
                          <span className="flex items-center gap-1 text-slate-700">
                            <Phone className="w-3 h-3 text-slate-600" /> {cliente.telefone}
                          </span>
                        )}
                        {cliente.email && (
                          <span className="flex items-center gap-1 text-slate-600">
                            <Mail className="w-3 h-3 text-slate-600" /> {cliente.email}
                          </span>
                        )}
                        {!cliente.telefone && !cliente.email && '-'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {cliente.cidade || cliente.estado ? (
                        <span className="flex items-center gap-1 text-slate-700">
                          <MapPin className="w-3 h-3 text-slate-600" />
                          {[cliente.cidade, cliente.estado].filter(Boolean).join(' - ')}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 tabular-nums">
                      {formatCurrency(cliente.limite_credito || 0)}
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant="outline"
                        className={
                          cliente.ativo
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }
                      >
                        {cliente.ativo ? 'Ativo' : 'Inativo'}
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
