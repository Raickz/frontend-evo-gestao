import { useState, useEffect } from 'react'
import { PageHeader, EmptyState, TableSkeleton, ErrorState } from '@/components/common/CommonUI'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useEmpresa } from '@/hooks/use-empresa'
import { ProdutosService, Produto } from '@/services/produtos'
import { Package, Plus, Search, Tag, DollarSign, Layers } from 'lucide-react'

export default function ProdutosPage() {
  const { empresaId } = useEmpresa()
  const [produtos, setProdutos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const loadProdutos = async () => {
    if (!empresaId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await ProdutosService.list(empresaId)
      if (err) throw err
      setProdutos(data || [])
    } catch (e: any) {
      setError(e.message || 'Falha ao buscar produtos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProdutos()
  }, [empresaId])

  const filteredProdutos = produtos.filter(
    (p) =>
      p.nome.toLowerCase().includes(search.toLowerCase()) ||
      p.codigo?.toLowerCase().includes(search.toLowerCase()) ||
      p.codigo_barras?.toLowerCase().includes(search.toLowerCase()),
  )

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catálogo de Produtos"
        description="Gestão de itens, tabela de preços, estoque mínimo e categorias."
        badge={`${produtos.length} Cadastrados`}
        actions={
          <Button className="bg-teal-700 hover:bg-teal-800 text-white flex items-center gap-1.5 shadow-sm">
            <Plus className="w-4 h-4" />
            Novo Produto
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <Input
            placeholder="Buscar por nome, código ou código de barras..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 bg-slate-50 border-slate-200 text-xs"
          />
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={loadProdutos} />
      ) : filteredProdutos.length === 0 ? (
        <EmptyState
          icon={Package}
          title={search ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado'}
          description={
            search
              ? 'Tente utilizar outros termos na busca.'
              : 'Cadastre os produtos que sua distribuidora comercializa para controlar saldo e vendas.'
          }
          actionLabel={search ? undefined : 'Cadastrar Primeiro Produto'}
          onAction={search ? undefined : () => {}}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3.5 px-4">Código / Nome</th>
                  <th className="py-3.5 px-4">Categoria</th>
                  <th className="py-3.5 px-4">Unidade</th>
                  <th className="py-3.5 px-4">Preço Custo</th>
                  <th className="py-3.5 px-4">Preço Venda</th>
                  <th className="py-3.5 px-4">Saldo Atual</th>
                  <th className="py-3.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProdutos.map((prod) => {
                  const saldo = prod.estoques?.[0]?.quantidade ?? 0
                  const isAbaixoMinimo = saldo <= (prod.estoque_minimo || 0) && saldo > 0
                  const isZerado = saldo <= 0

                  return (
                    <tr key={prod.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                            {prod.codigo || 'S/C'}
                          </span>
                          <span>{prod.nome}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {prod.categorias?.nome || 'Sem categoria'}
                      </td>
                      <td className="py-3 px-4 font-mono">{prod.unidade || 'UN'}</td>
                      <td className="py-3 px-4 tabular-nums text-slate-600">
                        {formatCurrency(prod.preco_custo || 0)}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 tabular-nums">
                        {formatCurrency(prod.preco_venda || 0)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-bold tabular-nums px-2 py-0.5 rounded-full text-xs ${
                            isZerado
                              ? 'bg-red-100 text-red-700'
                              : isAbaixoMinimo
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {saldo} {prod.unidade || 'UN'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={
                            prod.ativo
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-red-50 text-red-700 border-red-200'
                          }
                        >
                          {prod.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </td>
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
