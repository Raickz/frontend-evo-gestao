import { useState, useEffect, useMemo, useCallback } from 'react'
import { PageHeader, EmptyState, TableSkeleton, ErrorState } from '@/components/common/CommonUI'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useEmpresa } from '@/hooks/use-empresa'
import { ProdutosService, Produto, Categoria, Fornecedor } from '@/services/produtos'
import { toast } from 'sonner'
import {
  Package,
  Plus,
  Search,
  Edit2,
  Power,
  PowerOff,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react'

const UNIDADES_MEDIDA = [
  { valor: 'UN', label: 'UN - Unidade' },
  { valor: 'KG', label: 'KG - Quilograma' },
  { valor: 'LT', label: 'LT - Litro' },
  { valor: 'CX', label: 'CX - Caixa' },
  { valor: 'PCT', label: 'PCT - Pacote' },
  { valor: 'FD', label: 'FD - Fardo' },
  { valor: 'M', label: 'M - Metro' },
  { valor: 'M2', label: 'M² - Metro Quadrado' },
  { valor: 'M3', label: 'M³ - Metro Cúbico' },
  { valor: 'HR', label: 'HR - Hora' },
]

interface ProdutoComRelacoes extends Produto {
  categorias?: { nome: string } | null
  fornecedores?: { nome: string } | null
  estoques?: Array<{ quantidade: number }> | null
}

interface FormState {
  nome: string
  codigo: string
  categoria_id: string
  fornecedor_id: string
  unidade: string
  preco_custo: string
  preco_venda: string
  estoque_minimo: string
  estoque_inicial: string
  descricao: string
}

const initialFormState: FormState = {
  nome: '',
  codigo: '',
  categoria_id: 'none',
  fornecedor_id: 'none',
  unidade: 'UN',
  preco_custo: '0',
  preco_venda: '0',
  estoque_minimo: '0',
  estoque_inicial: '0',
  descricao: '',
}

type StatusFilter = 'todos' | 'ativos' | 'inativos'

const PAGE_SIZE = 20

export default function ProdutosPage() {
  const { empresaId } = useEmpresa()

  // State
  const [produtos, setProdutos] = useState<ProdutoComRelacoes[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos')
  const [currentPage, setCurrentPage] = useState(1)

  // Dialog CRUD state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProduto, setEditingProduto] = useState<ProdutoComRelacoes | null>(null)
  const [formData, setFormData] = useState<FormState>(initialFormState)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  // Toggle ativo state
  const [confirmToggleProduto, setConfirmToggleProduto] = useState<ProdutoComRelacoes | null>(null)
  const [toggling, setToggling] = useState(false)

  // Load auxiliary data (categorias and fornecedores)
  const loadAuxiliaryData = useCallback(async () => {
    if (!empresaId) return
    try {
      const [catRes, fornRes] = await Promise.all([
        ProdutosService.listCategorias(empresaId),
        ProdutosService.listFornecedores(empresaId),
      ])
      if (catRes.data) setCategorias(catRes.data)
      if (fornRes.data) setFornecedores(fornRes.data)
    } catch {
      // auxiliary data load fail handled gracefully
    }
  }, [empresaId])

  // Load products with backend search or list
  const fetchProdutos = useCallback(
    async (searchTerm: string) => {
      if (!empresaId) return
      setLoading(true)
      setError(null)
      try {
        const { data, error: err } = searchTerm.trim()
          ? await ProdutosService.search(empresaId, searchTerm)
          : await ProdutosService.list(empresaId)

        if (err) throw err
        setProdutos((data as ProdutoComRelacoes[]) || [])
      } catch (e: any) {
        setError(e.message || 'Falha ao buscar produtos')
      } finally {
        setLoading(false)
      }
    },
    [empresaId],
  )

  useEffect(() => {
    loadAuxiliaryData()
  }, [loadAuxiliaryData])

  // Debounced search trigger
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchProdutos(search)
      setCurrentPage(1)
    }, 300)

    return () => clearTimeout(handler)
  }, [search, fetchProdutos])

  // Filter and pagination
  const filteredProdutos = useMemo(() => {
    return produtos.filter((p) => {
      if (statusFilter === 'ativos') return p.ativo === true
      if (statusFilter === 'inativos') return p.ativo === false
      return true
    })
  }, [produtos, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredProdutos.length / PAGE_SIZE))
  const paginatedProdutos = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE
    return filteredProdutos.slice(startIndex, startIndex + PAGE_SIZE)
  }, [filteredProdutos, currentPage])

  // Helpers
  const formatCurrency = (val: number | null | undefined) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
  }

  // Open modal for create
  const handleOpenCreate = () => {
    setEditingProduto(null)
    setFormData(initialFormState)
    setFormErrors({})
    setDialogOpen(true)
    loadAuxiliaryData()
  }

  // Open modal for edit
  const handleOpenEdit = (produto: ProdutoComRelacoes) => {
    setEditingProduto(produto)
    setFormData({
      nome: produto.nome || '',
      codigo: produto.codigo || '',
      categoria_id: produto.categoria_id || 'none',
      fornecedor_id: produto.fornecedor_id || 'none',
      unidade: produto.unidade || 'UN',
      preco_custo:
        produto.preco_custo !== undefined && produto.preco_custo !== null
          ? String(produto.preco_custo)
          : '0',
      preco_venda:
        produto.preco_venda !== undefined && produto.preco_venda !== null
          ? String(produto.preco_venda)
          : '0',
      estoque_minimo:
        produto.estoque_minimo !== undefined && produto.estoque_minimo !== null
          ? String(produto.estoque_minimo)
          : '0',
      estoque_inicial: '0',
      descricao: produto.descricao || '',
    })
    setFormErrors({})
    setDialogOpen(true)
    loadAuxiliaryData()
  }

  // Validate form
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!formData.nome.trim() || formData.nome.trim().length < 2) {
      errors.nome = 'Nome é obrigatório e deve ter pelo menos 2 caracteres.'
    }

    const precoCustoNum = parseFloat(formData.preco_custo)
    if (isNaN(precoCustoNum) || precoCustoNum < 0) {
      errors.preco_custo = 'Preço de custo não pode ser negativo.'
    }

    const precoVendaNum = parseFloat(formData.preco_venda)
    if (isNaN(precoVendaNum) || precoVendaNum < 0) {
      errors.preco_venda = 'Preço de venda não pode ser negativo.'
    }

    const estoqueMinimoNum = parseFloat(formData.estoque_minimo)
    if (isNaN(estoqueMinimoNum) || estoqueMinimoNum < 0) {
      errors.estoque_minimo = 'Estoque mínimo não pode ser negativo.'
    }

    if (!editingProduto) {
      const estoqueInicialNum = parseFloat(formData.estoque_inicial)
      if (isNaN(estoqueInicialNum) || estoqueInicialNum < 0) {
        errors.estoque_inicial = 'Estoque inicial não pode ser negativo.'
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Form submit (create via RPC / update via update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!empresaId) return
    if (!validateForm()) return

    setSubmitting(true)
    try {
      const codigoVal = formData.codigo.trim() || undefined
      const categoriaIdVal =
        formData.categoria_id && formData.categoria_id !== 'none'
          ? formData.categoria_id
          : undefined
      const fornecedorIdVal =
        formData.fornecedor_id && formData.fornecedor_id !== 'none'
          ? formData.fornecedor_id
          : undefined
      const descricaoVal = formData.descricao.trim() || undefined

      if (editingProduto) {
        const payload = {
          nome: formData.nome.trim(),
          codigo: formData.codigo.trim() || null,
          categoria_id:
            formData.categoria_id && formData.categoria_id !== 'none'
              ? formData.categoria_id
              : null,
          fornecedor_id:
            formData.fornecedor_id && formData.fornecedor_id !== 'none'
              ? formData.fornecedor_id
              : null,
          unidade: formData.unidade || 'UN',
          preco_custo: parseFloat(formData.preco_custo) || 0,
          preco_venda: parseFloat(formData.preco_venda) || 0,
          estoque_minimo: parseFloat(formData.estoque_minimo) || 0,
          descricao: formData.descricao.trim() || null,
        }

        const { error: err } = await ProdutosService.update(empresaId, editingProduto.id, payload)
        if (err) throw err
        toast.success('Produto atualizado com sucesso!')
      } else {
        const { data: rpcRes, error: err } = await ProdutosService.createViaRpc({
          nome: formData.nome.trim(),
          codigo: codigoVal,
          categoriaId: categoriaIdVal,
          fornecedorId: fornecedorIdVal,
          unidade: formData.unidade || 'UN',
          precoCusto: parseFloat(formData.preco_custo) || 0,
          precoVenda: parseFloat(formData.preco_venda) || 0,
          estoqueMinimo: parseFloat(formData.estoque_minimo) || 0,
          estoqueInicial: parseFloat(formData.estoque_inicial) || 0,
          descricao: descricaoVal,
        })
        if (err) throw err

        // If RPC returned an error object inside json
        if (rpcRes && typeof rpcRes === 'object' && 'sucesso' in (rpcRes as Record<string, any>)) {
          const resObj = rpcRes as { sucesso: boolean; erro?: string }
          if (resObj.sucesso === false) {
            throw new Error(resObj.erro || 'Falha ao cadastrar produto via RPC.')
          }
        }

        toast.success('Produto cadastrado com sucesso!')
      }

      setDialogOpen(false)
      await fetchProdutos(search)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar produto. Verifique os dados e tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  // Toggle active status
  const handleToggleAtivo = async () => {
    if (!empresaId || !confirmToggleProduto) return
    setToggling(true)
    const novoStatus = !confirmToggleProduto.ativo
    try {
      const { error: err } = await ProdutosService.toggleAtivo(
        empresaId,
        confirmToggleProduto.id,
        novoStatus,
      )
      if (err) throw err
      toast.success(novoStatus ? 'Produto ativado com sucesso!' : 'Produto inativado com sucesso!')
      setConfirmToggleProduto(null)
      await fetchProdutos(search)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao alterar status do produto.')
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catálogo de Produtos"
        description="Gestão de itens, tabela de preços, estoque mínimo e categorias."
        badge={`${produtos.length} Cadastrados`}
        actions={
          <Button
            onClick={handleOpenCreate}
            className="bg-teal-700 hover:bg-teal-800 text-white flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Novo Produto
          </Button>
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <Input
            placeholder="Buscar por nome ou código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 bg-slate-50 border-slate-200 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-500 ml-1.5 mr-0.5" />
            <button
              type="button"
              onClick={() => {
                setStatusFilter('todos')
                setCurrentPage(1)
              }}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                statusFilter === 'todos'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos ({produtos.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ativos')
                setCurrentPage(1)
              }}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                statusFilter === 'ativos'
                  ? 'bg-white text-emerald-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ativos ({produtos.filter((p) => p.ativo).length})
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('inativos')
                setCurrentPage(1)
              }}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                statusFilter === 'inativos'
                  ? 'bg-white text-red-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Inativos ({produtos.filter((p) => !p.ativo).length})
            </button>
          </div>
        </div>
      </div>

      {/* Content State */}
      {loading ? (
        <TableSkeleton rows={6} cols={7} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => fetchProdutos(search)} />
      ) : filteredProdutos.length === 0 ? (
        <EmptyState
          icon={Package}
          title={
            search || statusFilter !== 'todos'
              ? 'Nenhum produto encontrado'
              : 'Nenhum produto cadastrado'
          }
          description={
            search || statusFilter !== 'todos'
              ? 'Tente ajustar os filtros ou termos de busca para encontrar o registro desejado.'
              : 'Cadastre os produtos que sua distribuidora comercializa para controlar saldo e vendas.'
          }
          actionLabel={
            search || statusFilter !== 'todos' ? undefined : 'Cadastrar Primeiro Produto'
          }
          onAction={search || statusFilter !== 'todos' ? undefined : handleOpenCreate}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3.5 px-4">Código</th>
                  <th className="py-3.5 px-4">Produto</th>
                  <th className="py-3.5 px-4">Unidade</th>
                  <th className="py-3.5 px-4">Preço Venda</th>
                  <th className="py-3.5 px-4">Estoque Atual</th>
                  <th className="py-3.5 px-4">Estoque Mínimo</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedProdutos.map((produto) => {
                  const saldo = produto.estoques?.[0]?.quantidade ?? 0
                  const estoqueMin = produto.estoque_minimo || 0
                  const isZerado = saldo <= 0
                  const isAbaixoMinimo = saldo > 0 && saldo <= estoqueMin

                  return (
                    <tr key={produto.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {produto.codigo ? (
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                            {produto.codigo}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <div>{produto.nome}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {produto.categorias?.nome && (
                            <span className="text-[11px] font-normal text-slate-500">
                              {produto.categorias.nome}
                            </span>
                          )}
                          {produto.fornecedores?.nome && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span className="text-[11px] font-normal text-slate-400">
                                {produto.fornecedores.nome}
                              </span>
                            </>
                          )}
                        </div>
                        {produto.descricao && (
                          <p
                            className="text-[11px] font-normal text-slate-500 truncate max-w-xs mt-0.5"
                            title={produto.descricao}
                          >
                            {produto.descricao}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-700">
                        {produto.unidade || 'UN'}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 tabular-nums">
                        {formatCurrency(produto.preco_venda)}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={
                            isZerado
                              ? 'bg-red-50 text-red-700 border-red-200 font-semibold'
                              : isAbaixoMinimo
                                ? 'bg-amber-50 text-amber-800 border-amber-200 font-semibold'
                                : 'bg-slate-100 text-slate-800 border-slate-200 font-medium'
                          }
                        >
                          {saldo} {produto.unidade || 'UN'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 tabular-nums">
                        {estoqueMin} {produto.unidade || 'UN'}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={
                            produto.ativo
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-medium'
                              : 'bg-red-50 text-red-700 border-red-200 font-medium'
                          }
                        >
                          {produto.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(produto)}
                            className="h-8 w-8 p-0 text-slate-600 hover:text-teal-700 hover:bg-teal-50"
                            title="Editar produto"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmToggleProduto(produto)}
                            className={`h-8 w-8 p-0 ${
                              produto.ativo
                                ? 'text-red-600 hover:text-red-700 hover:bg-red-50'
                                : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                            }`}
                            title={produto.ativo ? 'Inativar produto' : 'Ativar produto'}
                          >
                            {produto.ativo ? (
                              <PowerOff className="w-3.5 h-3.5" />
                            ) : (
                              <Power className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination bar */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-600">
            <div>
              Mostrando{' '}
              <span className="font-semibold text-slate-900">
                {Math.min(filteredProdutos.length, (currentPage - 1) * PAGE_SIZE + 1)}
              </span>{' '}
              a{' '}
              <span className="font-semibold text-slate-900">
                {Math.min(filteredProdutos.length, currentPage * PAGE_SIZE)}
              </span>{' '}
              de <span className="font-semibold text-slate-900">{filteredProdutos.length}</span>{' '}
              produtos
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 px-2.5 text-xs"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                Anterior
              </Button>
              <span className="px-2 text-xs font-medium text-slate-700">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="h-8 px-2.5 text-xs"
              >
                Próxima
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog CRUD */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              {editingProduto ? 'Editar Produto' : 'Novo Produto'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {editingProduto
                ? 'Atualize as informações cadastrais, preços e regras do produto.'
                : 'Preencha as informações para cadastrar um novo produto no estoque.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {/* Dados Principais */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 pb-1 border-b border-slate-100">
                Identificação
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="nome" className="text-xs font-semibold text-slate-700">
                    Nome do Produto <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => {
                      setFormData({ ...formData, nome: e.target.value })
                      if (formErrors.nome) setFormErrors({ ...formErrors, nome: '' })
                    }}
                    placeholder="Ex: Óleo de Soja 900ml ou Arroz Tipo 1 5kg"
                    className={`h-9 text-xs ${formErrors.nome ? 'border-red-500' : ''}`}
                    required
                  />
                  {formErrors.nome && <p className="text-[11px] text-red-500">{formErrors.nome}</p>}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="codigo" className="text-xs font-semibold text-slate-700">
                    Código Interno / SKU
                  </Label>
                  <Input
                    id="codigo"
                    value={formData.codigo}
                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                    placeholder="Ex: PROD-001"
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="space-y-1">
                  <Label htmlFor="categoria" className="text-xs font-semibold text-slate-700">
                    Categoria
                  </Label>
                  <Select
                    value={formData.categoria_id}
                    onValueChange={(val) => setFormData({ ...formData, categoria_id: val })}
                  >
                    <SelectTrigger id="categoria" className="h-9 text-xs">
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs text-slate-500">
                        Sem categoria
                      </SelectItem>
                      {categorias.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id} className="text-xs">
                          {cat.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="fornecedor" className="text-xs font-semibold text-slate-700">
                    Fornecedor
                  </Label>
                  <Select
                    value={formData.fornecedor_id}
                    onValueChange={(val) => setFormData({ ...formData, fornecedor_id: val })}
                  >
                    <SelectTrigger id="fornecedor" className="h-9 text-xs">
                      <SelectValue placeholder="Selecione um fornecedor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs text-slate-500">
                        Sem fornecedor
                      </SelectItem>
                      {fornecedores.map((forn) => (
                        <SelectItem key={forn.id} value={forn.id} className="text-xs">
                          {forn.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="unidade" className="text-xs font-semibold text-slate-700">
                    Unidade de Medida <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.unidade}
                    onValueChange={(val) => setFormData({ ...formData, unidade: val })}
                  >
                    <SelectTrigger id="unidade" className="h-9 text-xs">
                      <SelectValue placeholder="Selecione a unidade" />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIDADES_MEDIDA.map((u) => (
                        <SelectItem key={u.valor} value={u.valor} className="text-xs">
                          {u.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Preços e Estoque */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 pb-1 border-b border-slate-100">
                Preços e Parâmetros de Estoque
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="preco_custo" className="text-xs font-semibold text-slate-700">
                    Preço de Custo (R$)
                  </Label>
                  <Input
                    id="preco_custo"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.preco_custo}
                    onChange={(e) => {
                      setFormData({ ...formData, preco_custo: e.target.value })
                      if (formErrors.preco_custo) setFormErrors({ ...formErrors, preco_custo: '' })
                    }}
                    placeholder="0.00"
                    className={`h-9 text-xs font-mono ${formErrors.preco_custo ? 'border-red-500' : ''}`}
                  />
                  {formErrors.preco_custo && (
                    <p className="text-[11px] text-red-500">{formErrors.preco_custo}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="preco_venda" className="text-xs font-semibold text-slate-700">
                    Preço de Venda (R$)
                  </Label>
                  <Input
                    id="preco_venda"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.preco_venda}
                    onChange={(e) => {
                      setFormData({ ...formData, preco_venda: e.target.value })
                      if (formErrors.preco_venda) setFormErrors({ ...formErrors, preco_venda: '' })
                    }}
                    placeholder="0.00"
                    className={`h-9 text-xs font-mono ${formErrors.preco_venda ? 'border-red-500' : ''}`}
                  />
                  {formErrors.preco_venda && (
                    <p className="text-[11px] text-red-500">{formErrors.preco_venda}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <Label htmlFor="estoque_minimo" className="text-xs font-semibold text-slate-700">
                    Estoque Mínimo (Alerta)
                  </Label>
                  <Input
                    id="estoque_minimo"
                    type="number"
                    min="0"
                    step="1"
                    value={formData.estoque_minimo}
                    onChange={(e) => {
                      setFormData({ ...formData, estoque_minimo: e.target.value })
                      if (formErrors.estoque_minimo)
                        setFormErrors({ ...formErrors, estoque_minimo: '' })
                    }}
                    placeholder="0"
                    className={`h-9 text-xs font-mono ${formErrors.estoque_minimo ? 'border-red-500' : ''}`}
                  />
                  {formErrors.estoque_minimo && (
                    <p className="text-[11px] text-red-500">{formErrors.estoque_minimo}</p>
                  )}
                </div>

                {!editingProduto && (
                  <div className="space-y-1">
                    <Label
                      htmlFor="estoque_inicial"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Estoque Inicial (Entrada Automática)
                    </Label>
                    <Input
                      id="estoque_inicial"
                      type="number"
                      min="0"
                      step="1"
                      value={formData.estoque_inicial}
                      onChange={(e) => {
                        setFormData({ ...formData, estoque_inicial: e.target.value })
                        if (formErrors.estoque_inicial)
                          setFormErrors({ ...formErrors, estoque_inicial: '' })
                      }}
                      placeholder="0"
                      className={`h-9 text-xs font-mono ${formErrors.estoque_inicial ? 'border-red-500' : ''}`}
                    />
                    {formErrors.estoque_inicial && (
                      <p className="text-[11px] text-red-500">{formErrors.estoque_inicial}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Descrição */}
            <div className="space-y-1 pt-2">
              <Label htmlFor="descricao" className="text-xs font-semibold text-slate-700">
                Descrição Detalhada / Observações
              </Label>
              <Textarea
                id="descricao"
                rows={3}
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Detalhes adicionais, especificações técnicas, marca ou instruções de armazenamento..."
                className="text-xs resize-none"
              />
            </div>

            <DialogFooter className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
                className="text-xs h-9"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-teal-700 hover:bg-teal-800 text-white text-xs h-9 flex items-center gap-1.5"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Toggle Active */}
      <AlertDialog
        open={Boolean(confirmToggleProduto)}
        onOpenChange={(open) => {
          if (!open) setConfirmToggleProduto(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900 text-base">
              {confirmToggleProduto?.ativo ? 'Inativar produto?' : 'Ativar produto?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600">
              {confirmToggleProduto?.ativo
                ? `Tem certeza que deseja inativar o produto "${confirmToggleProduto?.nome}"? Produtos inativos não aparecem para novas vendas e pedidos por padrão.`
                : `Deseja reativar o produto "${confirmToggleProduto?.nome}" para movimentações e vendas?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={toggling} className="text-xs h-9">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggleAtivo}
              disabled={toggling}
              className={`text-xs h-9 text-white ${
                confirmToggleProduto?.ativo
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {toggling ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  Processando...
                </>
              ) : confirmToggleProduto?.ativo ? (
                'Sim, inativar'
              ) : (
                'Sim, ativar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
