import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  PageHeader,
  EmptyState,
  TableSkeleton,
  ErrorState,
  AnimatedNumber,
} from '@/components/common/CommonUI'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
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
import { VendedoresService, Vendedor } from '@/services/vendedores'
import { toast } from 'sonner'
import {
  UserCheck,
  Plus,
  Search,
  Edit2,
  Power,
  PowerOff,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Users,
  Percent,
  Mail,
  ShoppingCart,
} from 'lucide-react'

interface FormState {
  nome: string
  usuario_id: string // "none" ou uuid
  percentual_comissao: string
}

const initialFormState: FormState = {
  nome: '',
  usuario_id: 'none',
  percentual_comissao: '0',
}

type StatusFilter = 'todos' | 'ativos' | 'inativos'

const PAGE_SIZE = 20

export default function VendedoresPage() {
  const { empresaId } = useEmpresa()

  // Lista e paginação
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos')
  const [currentPage, setCurrentPage] = useState(1)

  // Usuários para o select de vínculo
  const [usuarios, setUsuarios] = useState<
    { id: string; nome: string; email: string; perfil: string }[]
  >([])
  const [loadingUsuarios, setLoadingUsuarios] = useState(false)

  // Dialog CRUD (criação / edição)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingVendedor, setEditingVendedor] = useState<Vendedor | null>(null)
  const [formData, setFormData] = useState<FormState>(initialFormState)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  // AlertDialog toggle ativo
  const [confirmToggleVendedor, setConfirmToggleVendedor] = useState<Vendedor | null>(null)
  const [toggling, setToggling] = useState(false)

  // Busca de vendedores (search paginado ou list)
  const fetchVendedores = useCallback(
    async (searchTerm: string) => {
      if (!empresaId) return
      setLoading(true)
      setError(null)
      try {
        const { data, error: err } = await VendedoresService.search(empresaId, searchTerm, {
          page: 1,
          pageSize: 1000, // traz o conjunto da busca para filtragem local rápida por status + paginação
        })
        if (err) throw err
        setVendedores((data as Vendedor[]) || [])
      } catch (e: any) {
        setError(e.message || 'Falha ao buscar vendedores')
      } finally {
        setLoading(false)
      }
    },
    [empresaId],
  )

  // Debounced search trigger (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchVendedores(search)
      setCurrentPage(1)
    }, 300)

    return () => clearTimeout(handler)
  }, [search, fetchVendedores])

  // Carrega lista de usuários disponíveis para vínculo
  const loadUsuarios = useCallback(async () => {
    if (!empresaId) return
    setLoadingUsuarios(true)
    try {
      const { data, error: err } = await VendedoresService.listUsuariosDisponiveis(empresaId)
      if (err) throw err
      setUsuarios(data || [])
    } catch {
      // Falha silenciosa de usuários
    } finally {
      setLoadingUsuarios(false)
    }
  }, [empresaId])

  useEffect(() => {
    loadUsuarios()
  }, [loadUsuarios])

  // Filtragem por status (todos, ativos, inativos)
  const filteredVendedores = useMemo(() => {
    return vendedores.filter((v) => {
      if (statusFilter === 'ativos') return v.ativo === true
      if (statusFilter === 'inativos') return v.ativo === false
      return true
    })
  }, [vendedores, statusFilter])

  // Paginação
  const totalPages = Math.max(1, Math.ceil(filteredVendedores.length / PAGE_SIZE))
  const paginatedVendedores = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE
    return filteredVendedores.slice(startIndex, startIndex + PAGE_SIZE)
  }, [filteredVendedores, currentPage])

  // Formatação de percentual (ex: 3.00 -> 3%, 2.5 -> 2.5%)
  const formatPercent = (val: number | null | undefined) => {
    const num = Number(val) || 0
    return `${Number(num.toFixed(2))}%`
  }

  // Abertura do modal para criação
  const handleOpenCreate = () => {
    setEditingVendedor(null)
    setFormData(initialFormState)
    setFormErrors({})
    setDialogOpen(true)
    loadUsuarios()
  }

  // Abertura do modal para edição
  const handleOpenEdit = (vendedor: Vendedor) => {
    setEditingVendedor(vendedor)
    setFormData({
      nome: vendedor.nome || '',
      usuario_id: vendedor.usuario_id || 'none',
      percentual_comissao:
        vendedor.percentual_comissao !== undefined && vendedor.percentual_comissao !== null
          ? String(vendedor.percentual_comissao)
          : '0',
    })
    setFormErrors({})
    setDialogOpen(true)
    loadUsuarios()
  }

  // Validação inline
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!formData.nome.trim() || formData.nome.trim().length < 2) {
      errors.nome = 'Nome é obrigatório e deve ter no mínimo 2 caracteres.'
    }

    const perc = parseFloat(formData.percentual_comissao)
    if (isNaN(perc) || perc < 0) {
      errors.percentual_comissao = 'Percentual de comissão deve ser maior ou igual a 0.'
    } else if (perc > 100) {
      errors.percentual_comissao = 'Percentual de comissão não pode exceder 100%.'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Submissão do formulário (create/update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!empresaId) return
    if (!validateForm()) return

    setSubmitting(true)
    try {
      const payload = {
        nome: formData.nome.trim(),
        usuario_id: formData.usuario_id === 'none' ? null : formData.usuario_id,
        percentual_comissao: parseFloat(formData.percentual_comissao) || 0,
      }

      if (editingVendedor) {
        const { error: err } = await VendedoresService.update(
          empresaId,
          editingVendedor.id,
          payload,
        )
        if (err) throw err
        toast.success('Vendedor atualizado com sucesso!')
      } else {
        const { error: err } = await VendedoresService.create(empresaId, payload)
        if (err) throw err
        toast.success('Vendedor cadastrado com sucesso!')
      }

      setDialogOpen(false)
      await fetchVendedores(search)
    } catch (err: any) {
      if (err.code === '23505' || err.message?.includes('idx_vendedores_usuario_unico')) {
        toast.error('Este usuário já está vinculado a outro vendedor.')
      } else {
        toast.error(err.message || 'Erro ao salvar vendedor. Verifique os dados e tente novamente.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Toggle ativo/inativo (exclusão lógica)
  const handleToggleAtivo = async () => {
    if (!empresaId || !confirmToggleVendedor) return
    setToggling(true)
    const novoStatus = !confirmToggleVendedor.ativo
    try {
      const { error: err } = await VendedoresService.toggleAtivo(
        empresaId,
        confirmToggleVendedor.id,
        novoStatus,
      )
      if (err) throw err
      toast.success(
        novoStatus ? 'Vendedor ativado com sucesso!' : 'Vendedor inativado com sucesso!',
      )
      setConfirmToggleVendedor(null)
      await fetchVendedores(search)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao alterar status do vendedor.')
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipe de Vendedores"
        description="Gestão da equipe comercial, vínculos com usuários e percentuais padrão de comissão."
        badge={
          <span>
            <AnimatedNumber value={vendedores.length} /> Vendedores
          </span>
        }
        actions={
          <Button
            onClick={handleOpenCreate}
            className="bg-[#0066FF] hover:bg-[#0052CC] text-white flex items-center gap-1.5 shadow-sm rounded-xl font-medium"
          >
            <Plus className="w-4 h-4" />
            Novo Vendedor
          </Button>
        }
      />

      {/* Barra de Busca e Filtros */}
      <div className="glass-card flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between p-4 rounded-2xl border border-slate-200/80 dark:border-[#1A294A]">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <Input
            placeholder="Buscar por nome do vendedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 bg-slate-50/70 dark:bg-[#0A1328]/50 border-slate-200 dark:border-[#1A294A] text-xs rounded-xl"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-[#0A1328]/80 p-1 rounded-xl border border-slate-200/80 dark:border-[#1A294A] text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-0.5" />
            <button
              type="button"
              onClick={() => {
                setStatusFilter('todos')
                setCurrentPage(1)
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                statusFilter === 'todos'
                  ? 'bg-[#0066FF] text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Todos ({vendedores.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ativos')
                setCurrentPage(1)
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                statusFilter === 'ativos'
                  ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Ativos ({vendedores.filter((v) => v.ativo).length})
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('inativos')
                setCurrentPage(1)
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                statusFilter === 'inativos'
                  ? 'bg-rose-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Inativos ({vendedores.filter((v) => !v.ativo).length})
            </button>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      {loading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => fetchVendedores(search)} />
      ) : filteredVendedores.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title={
            search || statusFilter !== 'todos'
              ? 'Nenhum vendedor encontrado'
              : 'Nenhum vendedor cadastrado'
          }
          description={
            search || statusFilter !== 'todos'
              ? 'Tente ajustar os filtros ou o termo de busca para encontrar o registro.'
              : 'Cadastre vendedores para associá-los a clientes, pedidos e apuração de comissões.'
          }
          actionLabel={
            search || statusFilter !== 'todos' ? undefined : 'Cadastrar Primeiro Vendedor'
          }
          onAction={search || statusFilter !== 'todos' ? undefined : handleOpenCreate}
        />
      ) : (
        <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-[#1A294A] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-[#C0C6CF]">
              <thead className="bg-slate-50/80 dark:bg-[#0A1328]/80 border-b border-slate-200/80 dark:border-[#1A294A] text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-3.5 px-4">Nome do Vendedor</th>
                  <th className="py-3.5 px-4">Usuário Vinculado</th>
                  <th className="py-3.5 px-4">Comissão Padrão</th>
                  <th className="py-3.5 px-4">Vendas (Qtd)</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1A294A]">
                {paginatedVendedores.map((vend) => (
                  <tr
                    key={vend.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#0066FF]/10 text-[#0066FF] dark:text-[#3B82F6] flex items-center justify-center font-bold text-xs">
                          {vend.nome.charAt(0).toUpperCase()}
                        </div>
                        <span>{vend.nome}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                      {vend.usuarios?.email ? (
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-mono text-[11px]">{vend.usuarios.email}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-mono">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-[#0066FF] dark:text-[#3B82F6] tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Percent className="w-3 h-3 text-[#0066FF]" />
                        {formatPercent(vend.percentual_comissao)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 tabular-nums">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-[#1A294A] text-slate-700 dark:text-slate-300 font-semibold text-xs">
                        <ShoppingCart className="w-3 h-3 text-slate-400" />
                        {vend.total_vendas ?? 0}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          vend.ativo
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'
                            : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25'
                        }`}
                      >
                        {vend.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(vend)}
                          className="h-8 w-8 p-0 text-slate-600 dark:text-slate-300 hover:text-[#0066FF] hover:bg-[#0066FF]/10 rounded-lg"
                          title="Editar vendedor"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmToggleVendedor(vend)}
                          className={`h-8 w-8 p-0 rounded-lg ${
                            vend.ativo
                              ? 'text-rose-600 hover:text-rose-700 hover:bg-rose-500/10'
                              : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10'
                          }`}
                          title={vend.ativo ? 'Inativar vendedor' : 'Ativar vendedor'}
                        >
                          {vend.ativo ? (
                            <PowerOff className="w-3.5 h-3.5" />
                          ) : (
                            <Power className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200/80 dark:border-[#1A294A] bg-slate-50/50 dark:bg-[#0A1328]/50 text-xs text-slate-600 dark:text-[#C0C6CF]">
            <div>
              Mostrando{' '}
              <span className="font-semibold text-slate-900 dark:text-white">
                {Math.min(filteredVendedores.length, (currentPage - 1) * PAGE_SIZE + 1)}
              </span>{' '}
              a{' '}
              <span className="font-semibold text-slate-900 dark:text-white">
                {Math.min(filteredVendedores.length, currentPage * PAGE_SIZE)}
              </span>{' '}
              de{' '}
              <span className="font-semibold text-slate-900 dark:text-white">
                {filteredVendedores.length}
              </span>{' '}
              vendedores
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 px-2.5 text-xs rounded-xl border-slate-200 dark:border-[#1A294A]"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                Anterior
              </Button>
              <span className="px-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="h-8 px-2.5 text-xs rounded-xl border-slate-200 dark:border-[#1A294A]"
              >
                Próxima
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog Único de Cadastro / Edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-[#0A1328] border-slate-200 dark:border-[#1A294A]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <div className="p-2 rounded-xl bg-[#0066FF]/10 text-[#0066FF] dark:text-[#3B82F6]">
                <Users className="w-5 h-5" />
              </div>
              {editingVendedor ? 'Editar Vendedor' : 'Novo Vendedor'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-[#C0C6CF]/80">
              {editingVendedor
                ? 'Atualize o nome, usuário vinculado ou percentual de comissão.'
                : 'Cadastre um novo integrante da equipe de vendas da distribuidora.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label
                htmlFor="nome"
                className="text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Nome do Vendedor <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => {
                  setFormData({ ...formData, nome: e.target.value })
                  if (formErrors.nome) setFormErrors({ ...formErrors, nome: '' })
                }}
                placeholder="Ex: Carlos Eduardo de Oliveira"
                className={`h-9 text-xs bg-white dark:bg-[#071126] border-slate-200 dark:border-[#1A294A] text-slate-900 dark:text-slate-100 rounded-xl ${
                  formErrors.nome ? 'border-rose-500' : ''
                }`}
                required
              />
              {formErrors.nome && (
                <p className="text-[11px] text-rose-500 font-medium">{formErrors.nome}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="usuario"
                className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
              >
                <Users className="w-3.5 h-3.5 text-[#0066FF] dark:text-[#3B82F6]" />
                Usuário Vinculado (Opcional)
              </Label>
              <Select
                value={formData.usuario_id}
                onValueChange={(val) => setFormData({ ...formData, usuario_id: val })}
              >
                <SelectTrigger
                  id="usuario"
                  className="h-9 text-xs bg-white dark:bg-[#071126] border-slate-200 dark:border-[#1A294A] text-slate-900 dark:text-slate-100 rounded-xl"
                >
                  <SelectValue placeholder="Selecione um usuário" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-[#0A1328] border-slate-200 dark:border-[#1A294A]">
                  <SelectItem value="none" className="text-xs text-slate-500 dark:text-slate-400">
                    Sem vínculo
                  </SelectItem>
                  {usuarios.map((u) => (
                    <SelectItem
                      key={u.id}
                      value={u.id}
                      className="text-xs text-slate-700 dark:text-slate-200"
                    >
                      {u.nome} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-slate-500 dark:text-[#C0C6CF]/70 font-medium">
                Permite que o usuário acesse o sistema identificado como este vendedor.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="percentual_comissao"
                className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
              >
                <Percent className="w-3.5 h-3.5 text-[#0066FF] dark:text-[#3B82F6]" />
                Percentual de Comissão (%)
              </Label>
              <Input
                id="percentual_comissao"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formData.percentual_comissao}
                onChange={(e) => {
                  setFormData({ ...formData, percentual_comissao: e.target.value })
                  if (formErrors.percentual_comissao) {
                    setFormErrors({ ...formErrors, percentual_comissao: '' })
                  }
                }}
                placeholder="Ex: 3.5"
                className={`h-9 text-xs font-mono bg-white dark:bg-[#071126] border-slate-200 dark:border-[#1A294A] text-slate-900 dark:text-slate-100 rounded-xl ${
                  formErrors.percentual_comissao ? 'border-rose-500' : ''
                }`}
              />
              {formErrors.percentual_comissao && (
                <p className="text-[11px] text-rose-500 font-medium">
                  {formErrors.percentual_comissao}
                </p>
              )}
              <p className="text-[11px] text-slate-500 dark:text-[#C0C6CF]/70 font-medium">
                Alíquota aplicada automaticamente ao finalizar vendas com este vendedor.
              </p>
            </div>

            <DialogFooter className="pt-4 border-t border-slate-200/80 dark:border-[#1A294A] flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
                className="text-xs h-9 border-slate-200 dark:border-[#1A294A] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1A294A] rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs h-9 font-bold flex items-center gap-1.5 rounded-xl shadow-md shadow-[#0066FF]/20"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Vendedor'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* AlertDialog de Confirmação para Inativar / Ativar */}
      <AlertDialog
        open={Boolean(confirmToggleVendedor)}
        onOpenChange={(open) => {
          if (!open) setConfirmToggleVendedor(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900 text-base">
              {confirmToggleVendedor?.ativo ? 'Inativar vendedor?' : 'Ativar vendedor?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600">
              {confirmToggleVendedor?.ativo
                ? `Tem certeza que deseja inativar o vendedor "${confirmToggleVendedor?.nome}"? Vendedores inativos não aparecem na seleção de novas vendas e pedidos.`
                : `Deseja reativar o vendedor "${confirmToggleVendedor?.nome}" para emissão de pedidos e vendas comerciais?`}
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
                confirmToggleVendedor?.ativo
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {toggling ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  Processando...
                </>
              ) : confirmToggleVendedor?.ativo ? (
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
