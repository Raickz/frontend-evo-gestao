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
import { useAuth } from '@/hooks/use-auth'
import { useEmpresa } from '@/hooks/use-empresa'
import { FornecedoresService, Fornecedor } from '@/services/fornecedores'
import { toast } from 'sonner'
import {
  Truck,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  Edit2,
  Power,
  PowerOff,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react'

const ESTADOS_BRASIL = [
  { sigla: 'AC', nome: 'Acre' },
  { sigla: 'AL', nome: 'Alagoas' },
  { sigla: 'AP', nome: 'Amapá' },
  { sigla: 'AM', nome: 'Amazonas' },
  { sigla: 'BA', nome: 'Bahia' },
  { sigla: 'CE', nome: 'Ceará' },
  { sigla: 'DF', nome: 'Distrito Federal' },
  { sigla: 'ES', nome: 'Espírito Santo' },
  { sigla: 'GO', nome: 'Goiás' },
  { sigla: 'MA', nome: 'Maranhão' },
  { sigla: 'MT', nome: 'Mato Grosso' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul' },
  { sigla: 'MG', nome: 'Minas Gerais' },
  { sigla: 'PA', nome: 'Pará' },
  { sigla: 'PB', nome: 'Paraíba' },
  { sigla: 'PR', nome: 'Paraná' },
  { sigla: 'PE', nome: 'Pernambuco' },
  { sigla: 'PI', nome: 'Piauí' },
  { sigla: 'RJ', nome: 'Rio de Janeiro' },
  { sigla: 'RN', nome: 'Rio Grande do Norte' },
  { sigla: 'RS', nome: 'Rio Grande do Sul' },
  { sigla: 'RO', nome: 'Rondônia' },
  { sigla: 'RR', nome: 'Roraima' },
  { sigla: 'SC', nome: 'Santa Catarina' },
  { sigla: 'SP', nome: 'São Paulo' },
  { sigla: 'SE', nome: 'Sergipe' },
  { sigla: 'TO', nome: 'Tocantins' },
]

interface FormState {
  nome: string
  documento: string
  telefone: string
  email: string
  estado: string
  cidade: string
  observacoes: string
}

const initialFormState: FormState = {
  nome: '',
  documento: '',
  telefone: '',
  email: '',
  estado: '',
  cidade: '',
  observacoes: '',
}

type StatusFilter = 'todos' | 'ativos' | 'inativos'

const PAGE_SIZE = 20

export default function FornecedoresPage() {
  const { usuario } = useAuth()
  const { empresaId } = useEmpresa()

  // Permissões no frontend: apenas master, admin e gerente podem criar/editar/ativar/inativar
  const canManage = useMemo(() => {
    const role = usuario?.perfil?.toLowerCase()
    return role === 'master' || role === 'admin' || role === 'gerente'
  }, [usuario?.perfil])

  // State
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos')
  const [currentPage, setCurrentPage] = useState(1)

  // Dialog CRUD state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingFornecedor, setEditingFornecedor] = useState<Fornecedor | null>(null)
  const [formData, setFormData] = useState<FormState>(initialFormState)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  // Toggle ativo state
  const [confirmToggleFornecedor, setConfirmToggleFornecedor] = useState<Fornecedor | null>(null)
  const [toggling, setToggling] = useState(false)

  // Load suppliers with backend search or list
  const fetchFornecedores = useCallback(
    async (searchTerm: string) => {
      if (!empresaId) return
      setLoading(true)
      setError(null)
      try {
        const { data, error: err } = searchTerm.trim()
          ? await FornecedoresService.search(empresaId, searchTerm)
          : await FornecedoresService.list(empresaId)

        if (err) throw err
        setFornecedores((data as Fornecedor[]) || [])
      } catch (e: any) {
        setError(e.message || 'Falha ao buscar fornecedores')
      } finally {
        setLoading(false)
      }
    },
    [empresaId],
  )

  // Debounced search trigger (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchFornecedores(search)
      setCurrentPage(1)
    }, 300)

    return () => clearTimeout(handler)
  }, [search, fetchFornecedores])

  // Filter and pagination
  const filteredFornecedores = useMemo(() => {
    return fornecedores.filter((f) => {
      if (statusFilter === 'ativos') return f.ativo === true
      if (statusFilter === 'inativos') return f.ativo === false
      return true
    })
  }, [fornecedores, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredFornecedores.length / PAGE_SIZE))
  const paginatedFornecedores = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE
    return filteredFornecedores.slice(startIndex, startIndex + PAGE_SIZE)
  }, [filteredFornecedores, currentPage])

  // Open modal for create
  const handleOpenCreate = () => {
    setEditingFornecedor(null)
    setFormData(initialFormState)
    setFormErrors({})
    setDialogOpen(true)
  }

  // Open modal for edit
  const handleOpenEdit = (fornecedor: Fornecedor) => {
    setEditingFornecedor(fornecedor)
    setFormData({
      nome: fornecedor.nome || '',
      documento: fornecedor.documento || '',
      telefone: fornecedor.telefone || '',
      email: fornecedor.email || '',
      estado: fornecedor.estado || '',
      cidade: fornecedor.cidade || '',
      observacoes: fornecedor.observacoes || '',
    })
    setFormErrors({})
    setDialogOpen(true)
  }

  // Validate form
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!formData.nome.trim() || formData.nome.trim().length < 2) {
      errors.nome = 'Nome é obrigatório e deve ter pelo menos 2 caracteres.'
    }

    if (formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(formData.email.trim())) {
        errors.email = 'E-mail informado é inválido.'
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Form submit (create / update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!empresaId) return
    if (!validateForm()) return

    setSubmitting(true)
    try {
      const payload = {
        nome: formData.nome.trim(),
        documento: formData.documento.trim() || null,
        telefone: formData.telefone.trim() || null,
        email: formData.email.trim() || null,
        estado: formData.estado.trim() || null,
        cidade: formData.cidade.trim() || null,
        observacoes: formData.observacoes.trim() || null,
      }

      if (editingFornecedor) {
        const { error: err } = await FornecedoresService.update(
          empresaId,
          editingFornecedor.id,
          payload,
        )
        if (err) throw err
        toast.success('Fornecedor atualizado com sucesso!')
      } else {
        const { error: err } = await FornecedoresService.create(empresaId, payload)
        if (err) throw err
        toast.success('Fornecedor cadastrado com sucesso!')
      }

      setDialogOpen(false)
      await fetchFornecedores(search)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar fornecedor. Verifique os dados e tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  // Toggle active status (lógica)
  const handleToggleAtivo = async () => {
    if (!empresaId || !confirmToggleFornecedor) return
    setToggling(true)
    const novoStatus = !confirmToggleFornecedor.ativo
    try {
      const { error: err } = await FornecedoresService.toggleAtivo(
        empresaId,
        confirmToggleFornecedor.id,
        novoStatus,
      )
      if (err) throw err
      toast.success(
        novoStatus ? 'Fornecedor ativado com sucesso!' : 'Fornecedor inativado com sucesso!',
      )
      setConfirmToggleFornecedor(null)
      await fetchFornecedores(search)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao alterar status do fornecedor.')
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestão de Fornecedores"
        description="Gerencie os parceiros comerciais, contatos e fornecedores da distribuidora."
        badge={`${fornecedores.length} Cadastrados`}
        actions={
          canManage ? (
            <Button
              onClick={handleOpenCreate}
              className="bg-[#0066FF] hover:bg-[#0052CC] text-white flex items-center gap-1.5 shadow-sm rounded-xl font-medium"
            >
              <Plus className="w-4 h-4" />
              Novo Fornecedor
            </Button>
          ) : undefined
        }
      />

      {/* Filter and Search Bar */}
      <div className="glass-card flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between p-4 rounded-2xl border border-slate-200/80 dark:border-[#1A294A]">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <Input
            placeholder="Buscar por nome, documento ou telefone..."
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
              Todos ({fornecedores.length})
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
              Ativos ({fornecedores.filter((f) => f.ativo).length})
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
              Inativos ({fornecedores.filter((f) => !f.ativo).length})
            </button>
          </div>
        </div>
      </div>

      {/* Content State */}
      {loading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => fetchFornecedores(search)} />
      ) : filteredFornecedores.length === 0 ? (
        <EmptyState
          icon={Truck}
          title={
            search || statusFilter !== 'todos'
              ? 'Nenhum fornecedor encontrado'
              : 'Nenhum fornecedor cadastrado'
          }
          description={
            search || statusFilter !== 'todos'
              ? 'Tente ajustar os filtros ou termos de busca para encontrar o registro desejado.'
              : 'Cadastre seus primeiros fornecedores para vincular a produtos e compras.'
          }
          actionLabel={
            search || statusFilter !== 'todos' || !canManage
              ? undefined
              : 'Cadastrar Primeiro Fornecedor'
          }
          onAction={search || statusFilter !== 'todos' || !canManage ? undefined : handleOpenCreate}
        />
      ) : (
        <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-[#1A294A] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-[#C0C6CF]">
              <thead className="bg-slate-50/80 dark:bg-[#0A1328]/80 border-b border-slate-200/80 dark:border-[#1A294A] text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-3.5 px-4">Nome / Fornecedor</th>
                  <th className="py-3.5 px-4">Documento</th>
                  <th className="py-3.5 px-4">Contato</th>
                  <th className="py-3.5 px-4">Cidade / Estado</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1A294A]">
                {paginatedFornecedores.map((fornecedor) => (
                  <tr
                    key={fornecedor.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                      <div>{fornecedor.nome}</div>
                      {fornecedor.observacoes && (
                        <p
                          className="text-[11px] font-normal text-slate-500 dark:text-slate-400 truncate max-w-xs mt-0.5"
                          title={fornecedor.observacoes}
                        >
                          {fornecedor.observacoes}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-300">
                      {fornecedor.documento || '-'}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-0.5">
                        {fornecedor.telefone && (
                          <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                            <Phone className="w-3 h-3 text-[#0066FF]" /> {fornecedor.telefone}
                          </span>
                        )}
                        {fornecedor.email && (
                          <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                            <Mail className="w-3 h-3 text-slate-400" /> {fornecedor.email}
                          </span>
                        )}
                        {!fornecedor.telefone && !fornecedor.email && '-'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {fornecedor.cidade || fornecedor.estado ? (
                        <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                          <MapPin className="w-3 h-3 text-[#0066FF]" />
                          {[fornecedor.cidade, fornecedor.estado].filter(Boolean).join(' - ')}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          fornecedor.ativo
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'
                            : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25'
                        }`}
                      >
                        {fornecedor.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {canManage ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(fornecedor)}
                            className="h-8 w-8 p-0 text-slate-600 dark:text-slate-300 hover:text-[#0066FF] hover:bg-[#0066FF]/10 rounded-lg"
                            title="Editar fornecedor"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmToggleFornecedor(fornecedor)}
                            className={`h-8 w-8 p-0 rounded-lg ${
                              fornecedor.ativo
                                ? 'text-rose-600 hover:text-rose-700 hover:bg-rose-500/10'
                                : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10'
                            }`}
                            title={fornecedor.ativo ? 'Inativar fornecedor' : 'Ativar fornecedor'}
                          >
                            {fornecedor.ativo ? (
                              <PowerOff className="w-3.5 h-3.5" />
                            ) : (
                              <Power className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        </div>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 text-[11px]">
                          Visualização
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination bar */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200/80 dark:border-[#1A294A] bg-slate-50/50 dark:bg-[#0A1328]/50 text-xs text-slate-600 dark:text-[#C0C6CF]">
            <div>
              Mostrando{' '}
              <span className="font-semibold text-slate-900 dark:text-white">
                {Math.min(filteredFornecedores.length, (currentPage - 1) * PAGE_SIZE + 1)}
              </span>{' '}
              a{' '}
              <span className="font-semibold text-slate-900 dark:text-white">
                {Math.min(filteredFornecedores.length, currentPage * PAGE_SIZE)}
              </span>{' '}
              de{' '}
              <span className="font-semibold text-slate-900 dark:text-white">
                {filteredFornecedores.length}
              </span>{' '}
              fornecedores
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

      {/* Modal Dialog CRUD */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              {editingFornecedor ? 'Editar Fornecedor' : 'Novo Fornecedor'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {editingFornecedor
                ? 'Atualize os dados cadastrais, contato e localização do fornecedor.'
                : 'Preencha as informações para cadastrar um novo fornecedor na empresa.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {/* Seção Identificação */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 pb-1 border-b border-slate-100">
                Identificação
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="nome" className="text-xs font-semibold text-slate-700">
                    Nome / Razão Social <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => {
                      setFormData({ ...formData, nome: e.target.value })
                      if (formErrors.nome) setFormErrors({ ...formErrors, nome: '' })
                    }}
                    placeholder="Ex: Distribuidora Central Ltda ou Indústria ABC"
                    className={`h-9 text-xs ${formErrors.nome ? 'border-red-500' : ''}`}
                    required
                  />
                  {formErrors.nome && <p className="text-[11px] text-red-500">{formErrors.nome}</p>}
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="documento" className="text-xs font-semibold text-slate-700">
                    Documento (CNPJ / CPF)
                  </Label>
                  <Input
                    id="documento"
                    value={formData.documento}
                    onChange={(e) => setFormData({ ...formData, documento: e.target.value })}
                    placeholder="CNPJ ou CPF do fornecedor"
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Seção Contato */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 pb-1 border-b border-slate-100">
                Contato
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="telefone" className="text-xs font-semibold text-slate-700">
                    Telefone
                  </Label>
                  <Input
                    id="telefone"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    placeholder="(00) 0000-0000"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                    E-mail
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value })
                      if (formErrors.email) setFormErrors({ ...formErrors, email: '' })
                    }}
                    placeholder="contato@fornecedor.com"
                    className={`h-9 text-xs ${formErrors.email ? 'border-red-500' : ''}`}
                  />
                  {formErrors.email && (
                    <p className="text-[11px] text-red-500">{formErrors.email}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Seção Localização */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 pb-1 border-b border-slate-100">
                Localização
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="estado" className="text-xs font-semibold text-slate-700">
                    Estado (UF)
                  </Label>
                  <Select
                    value={formData.estado}
                    onValueChange={(val) => setFormData({ ...formData, estado: val })}
                  >
                    <SelectTrigger id="estado" className="h-9 text-xs">
                      <SelectValue placeholder="Selecione o estado" />
                    </SelectTrigger>
                    <SelectContent>
                      {ESTADOS_BRASIL.map((uf) => (
                        <SelectItem key={uf.sigla} value={uf.sigla} className="text-xs">
                          {uf.sigla} - {uf.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="cidade" className="text-xs font-semibold text-slate-700">
                    Cidade
                  </Label>
                  <Input
                    id="cidade"
                    value={formData.cidade}
                    onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                    placeholder="Cidade do fornecedor"
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Seção Observações */}
            <div className="space-y-1 pt-2">
              <Label htmlFor="observacoes" className="text-xs font-semibold text-slate-700">
                Observações
              </Label>
              <Textarea
                id="observacoes"
                rows={3}
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Prazos de entrega padrão, condições de pagamento, vendedor responsável..."
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
                  'Salvar Fornecedor'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Toggle Active */}
      <AlertDialog
        open={Boolean(confirmToggleFornecedor)}
        onOpenChange={(open) => {
          if (!open) setConfirmToggleFornecedor(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900 text-base">
              {confirmToggleFornecedor?.ativo ? 'Inativar fornecedor?' : 'Ativar fornecedor?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600">
              {confirmToggleFornecedor?.ativo
                ? `Tem certeza que deseja inativar o fornecedor "${confirmToggleFornecedor?.nome}"? Fornecedores inativos não serão sugeridos para novos cadastros e compras.`
                : `Deseja reativar o fornecedor "${confirmToggleFornecedor?.nome}" para produtos e compras?`}
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
                confirmToggleFornecedor?.ativo
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {toggling ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  Processando...
                </>
              ) : confirmToggleFornecedor?.ativo ? (
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
