import { useState, useEffect, useMemo, useCallback } from 'react'
import { PageHeader, EmptyState, TableSkeleton, ErrorState } from '@/components/common/CommonUI'
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
        badge={`${vendedores.length} Vendedores`}
        actions={
          <Button
            onClick={handleOpenCreate}
            className="bg-teal-700 hover:bg-teal-800 text-white flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Novo Vendedor
          </Button>
        }
      />

      {/* Barra de Busca e Filtros */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <Input
            placeholder="Buscar por nome do vendedor..."
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
              Todos ({vendedores.length})
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
              Ativos ({vendedores.filter((v) => v.ativo).length})
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
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3.5 px-4">Nome do Vendedor</th>
                  <th className="py-3.5 px-4">Usuário Vinculado</th>
                  <th className="py-3.5 px-4">Comissão Padrão</th>
                  <th className="py-3.5 px-4">Vendas (Qtd)</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedVendedores.map((vend) => (
                  <tr key={vend.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs">
                          {vend.nome.charAt(0).toUpperCase()}
                        </div>
                        <span>{vend.nome}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {vend.usuarios?.email ? (
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-mono text-[11px]">{vend.usuarios.email}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-mono">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-bold text-teal-700 tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Percent className="w-3 h-3 text-teal-600" />
                        {formatPercent(vend.percentual_comissao)}
                      </span>
                    </td>
                    <td className="py-3 px-4 tabular-nums">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-200">
                        <ShoppingCart className="w-3 h-3 text-slate-400" />
                        {vend.total_vendas ?? 0}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant="outline"
                        className={
                          vend.ativo
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-medium'
                            : 'bg-red-50 text-red-700 border-red-200 font-medium'
                        }
                      >
                        {vend.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(vend)}
                          className="h-8 w-8 p-0 text-slate-600 hover:text-teal-700 hover:bg-teal-50"
                          title="Editar vendedor"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmToggleVendedor(vend)}
                          className={`h-8 w-8 p-0 ${
                            vend.ativo
                              ? 'text-red-600 hover:text-red-700 hover:bg-red-50'
                              : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
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
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-600">
            <div>
              Mostrando{' '}
              <span className="font-semibold text-slate-900">
                {Math.min(filteredVendedores.length, (currentPage - 1) * PAGE_SIZE + 1)}
              </span>{' '}
              a{' '}
              <span className="font-semibold text-slate-900">
                {Math.min(filteredVendedores.length, currentPage * PAGE_SIZE)}
              </span>{' '}
              de <span className="font-semibold text-slate-900">{filteredVendedores.length}</span>{' '}
              vendedores
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

      {/* Dialog Único de Cadastro / Edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              {editingVendedor ? 'Editar Vendedor' : 'Novo Vendedor'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {editingVendedor
                ? 'Atualize o nome, usuário vinculado ou percentual de comissão.'
                : 'Cadastre um novo integrante da equipe de vendas da distribuidora.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="nome" className="text-xs font-semibold text-slate-700">
                Nome do Vendedor <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => {
                  setFormData({ ...formData, nome: e.target.value })
                  if (formErrors.nome) setFormErrors({ ...formErrors, nome: '' })
                }}
                placeholder="Ex: Carlos Eduardo de Oliveira"
                className={`h-9 text-xs ${formErrors.nome ? 'border-red-500' : ''}`}
                required
              />
              {formErrors.nome && <p className="text-[11px] text-red-500">{formErrors.nome}</p>}
            </div>

            <div className="space-y-1">
              <Label
                htmlFor="usuario"
                className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
              >
                <Users className="w-3.5 h-3.5 text-slate-500" />
                Usuário Vinculado (Opcional)
              </Label>
              <Select
                value={formData.usuario_id}
                onValueChange={(val) => setFormData({ ...formData, usuario_id: val })}
              >
                <SelectTrigger id="usuario" className="h-9 text-xs">
                  <SelectValue placeholder="Selecione um usuário" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-xs text-slate-500">
                    Sem vínculo
                  </SelectItem>
                  {usuarios.map((u) => (
                    <SelectItem key={u.id} value={u.id} className="text-xs">
                      {u.nome} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-slate-500">
                Permite que o usuário acesse o sistema identificado como este vendedor.
              </p>
            </div>

            <div className="space-y-1">
              <Label
                htmlFor="percentual_comissao"
                className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
              >
                <Percent className="w-3.5 h-3.5 text-slate-500" />
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
                className={`h-9 text-xs font-mono ${formErrors.percentual_comissao ? 'border-red-500' : ''}`}
              />
              {formErrors.percentual_comissao && (
                <p className="text-[11px] text-red-500">{formErrors.percentual_comissao}</p>
              )}
              <p className="text-[11px] text-slate-500">
                Alíquota aplicada automaticamente ao finalizar vendas com este vendedor.
              </p>
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
