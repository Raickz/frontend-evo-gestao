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
import { ClientesService, Cliente } from '@/services/clientes'
import { toast } from 'sonner'
import {
  Users,
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
  whatsapp: string
  email: string
  cep: string
  estado: string
  cidade: string
  endereco: string
  numero: string
  bairro: string
  limite_credito: string
  observacoes: string
}

const initialFormState: FormState = {
  nome: '',
  documento: '',
  telefone: '',
  whatsapp: '',
  email: '',
  cep: '',
  estado: '',
  cidade: '',
  endereco: '',
  numero: '',
  bairro: '',
  limite_credito: '0',
  observacoes: '',
}

type StatusFilter = 'todos' | 'ativos' | 'inativos'

const PAGE_SIZE = 20

export default function ClientesPage() {
  const { empresaId } = useEmpresa()

  // State
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos')
  const [currentPage, setCurrentPage] = useState(1)

  // Dialog CRUD state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null)
  const [formData, setFormData] = useState<FormState>(initialFormState)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  // Toggle ativo state
  const [confirmToggleCliente, setConfirmToggleCliente] = useState<Cliente | null>(null)
  const [toggling, setToggling] = useState(false)

  // Load clients with backend search or list
  const fetchClientes = useCallback(
    async (searchTerm: string) => {
      if (!empresaId) return
      setLoading(true)
      setError(null)
      try {
        const { data, error: err } = searchTerm.trim()
          ? await ClientesService.search(empresaId, searchTerm)
          : await ClientesService.list(empresaId)

        if (err) throw err
        setClientes((data as Cliente[]) || [])
      } catch (e: any) {
        setError(e.message || 'Falha ao buscar clientes')
      } finally {
        setLoading(false)
      }
    },
    [empresaId],
  )

  // Debounced search trigger
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchClientes(search)
      setCurrentPage(1)
    }, 300)

    return () => clearTimeout(handler)
  }, [search, fetchClientes])

  // Filter and pagination
  const filteredClientes = useMemo(() => {
    return clientes.filter((c) => {
      if (statusFilter === 'ativos') return c.ativo === true
      if (statusFilter === 'inativos') return c.ativo === false
      return true
    })
  }, [clientes, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredClientes.length / PAGE_SIZE))
  const paginatedClientes = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE
    return filteredClientes.slice(startIndex, startIndex + PAGE_SIZE)
  }, [filteredClientes, currentPage])

  // Helpers
  const formatCurrency = (val: number | null | undefined) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
  }

  // Open modal for create
  const handleOpenCreate = () => {
    setEditingCliente(null)
    setFormData(initialFormState)
    setFormErrors({})
    setDialogOpen(true)
  }

  // Open modal for edit
  const handleOpenEdit = (cliente: Cliente) => {
    setEditingCliente(cliente)
    setFormData({
      nome: cliente.nome || '',
      documento: cliente.documento || '',
      telefone: cliente.telefone || '',
      whatsapp: cliente.whatsapp || '',
      email: cliente.email || '',
      cep: cliente.cep || '',
      estado: cliente.estado || '',
      cidade: cliente.cidade || '',
      endereco: cliente.endereco || '',
      numero: cliente.numero || '',
      bairro: cliente.bairro || '',
      limite_credito:
        cliente.limite_credito !== undefined && cliente.limite_credito !== null
          ? String(cliente.limite_credito)
          : '0',
      observacoes: cliente.observacoes || '',
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

    const limiteNum = parseFloat(formData.limite_credito)
    if (isNaN(limiteNum) || limiteNum < 0) {
      errors.limite_credito = 'Limite de crédito não pode ser negativo.'
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
        whatsapp: formData.whatsapp.trim() || null,
        email: formData.email.trim() || null,
        cep: formData.cep.trim() || null,
        estado: formData.estado.trim() || null,
        cidade: formData.cidade.trim() || null,
        endereco: formData.endereco.trim() || null,
        numero: formData.numero.trim() || null,
        bairro: formData.bairro.trim() || null,
        limite_credito: parseFloat(formData.limite_credito) || 0,
        observacoes: formData.observacoes.trim() || null,
      }

      if (editingCliente) {
        const { error: err } = await ClientesService.update(empresaId, editingCliente.id, payload)
        if (err) throw err
        toast.success('Cliente atualizado com sucesso!')
      } else {
        const { error: err } = await ClientesService.create(empresaId, payload)
        if (err) throw err
        toast.success('Cliente criado com sucesso!')
      }

      setDialogOpen(false)
      await fetchClientes(search)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar cliente. Verifique os dados e tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  // Toggle active status
  const handleToggleAtivo = async () => {
    if (!empresaId || !confirmToggleCliente) return
    setToggling(true)
    const novoStatus = !confirmToggleCliente.ativo
    try {
      const { error: err } = await ClientesService.toggleAtivo(
        empresaId,
        confirmToggleCliente.id,
        novoStatus,
      )
      if (err) throw err
      toast.success(novoStatus ? 'Cliente ativado com sucesso!' : 'Cliente inativado com sucesso!')
      setConfirmToggleCliente(null)
      await fetchClientes(search)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao alterar status do cliente.')
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestão de Clientes"
        description="Consulte a carteira de clientes, limites de crédito e contatos da distribuidora."
        badge={`${clientes.length} Cadastrados`}
        actions={
          <Button
            onClick={handleOpenCreate}
            className="bg-[#0066FF] hover:bg-[#0052CC] text-white flex items-center gap-1.5 shadow-sm rounded-xl font-medium"
          >
            <Plus className="w-4 h-4" />
            Novo Cliente
          </Button>
        }
      />

      {/* Filter and Search Bar */}
      <div className="glass-card flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between p-4 rounded-2xl border border-slate-200/80 dark:border-[#1A294A]">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <Input
            placeholder="Buscar por nome, CPF/CNPJ ou telefone..."
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
              Todos ({clientes.length})
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
              Ativos ({clientes.filter((c) => c.ativo).length})
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
              Inativos ({clientes.filter((c) => !c.ativo).length})
            </button>
          </div>
        </div>
      </div>

      {/* Content State */}
      {loading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => fetchClientes(search)} />
      ) : filteredClientes.length === 0 ? (
        <EmptyState
          icon={Users}
          title={
            search || statusFilter !== 'todos'
              ? 'Nenhum cliente encontrado'
              : 'Nenhum cliente cadastrado'
          }
          description={
            search || statusFilter !== 'todos'
              ? 'Tente ajustar os filtros ou termos de busca para encontrar o registro desejado.'
              : 'Cadastre seus primeiros clientes para iniciar os pedidos e vendas comerciais.'
          }
          actionLabel={
            search || statusFilter !== 'todos' ? undefined : 'Cadastrar Primeiro Cliente'
          }
          onAction={search || statusFilter !== 'todos' ? undefined : handleOpenCreate}
        />
      ) : (
        <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-[#1A294A] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-[#C0C6CF]">
              <thead className="bg-slate-50/80 dark:bg-[#0A1328]/80 border-b border-slate-200/80 dark:border-[#1A294A] text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-3.5 px-4">Cliente / Razão</th>
                  <th className="py-3.5 px-4">Documento</th>
                  <th className="py-3.5 px-4">Contato</th>
                  <th className="py-3.5 px-4">Localização</th>
                  <th className="py-3.5 px-4">Limite Crédito</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1A294A]">
                {paginatedClientes.map((cliente) => (
                  <tr
                    key={cliente.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                      <div>{cliente.nome}</div>
                      {cliente.observacoes && (
                        <p
                          className="text-[11px] font-normal text-slate-500 dark:text-slate-400 truncate max-w-xs mt-0.5"
                          title={cliente.observacoes}
                        >
                          {cliente.observacoes}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-300">
                      {cliente.documento || '-'}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-0.5">
                        {cliente.telefone && (
                          <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                            <Phone className="w-3 h-3 text-[#0066FF]" /> {cliente.telefone}
                          </span>
                        )}
                        {cliente.email && (
                          <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                            <Mail className="w-3 h-3 text-slate-400" /> {cliente.email}
                          </span>
                        )}
                        {!cliente.telefone && !cliente.email && '-'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {cliente.cidade || cliente.estado ? (
                        <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                          <MapPin className="w-3 h-3 text-[#0066FF]" />
                          {[cliente.cidade, cliente.estado].filter(Boolean).join(' - ')}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white tabular-nums">
                      {formatCurrency(cliente.limite_credito)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          cliente.ativo
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'
                            : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25'
                        }`}
                      >
                        {cliente.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(cliente)}
                          className="h-8 w-8 p-0 text-slate-600 dark:text-slate-300 hover:text-[#0066FF] hover:bg-[#0066FF]/10 rounded-lg"
                          title="Editar cliente"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setConfirmToggleCliente(cliente)
                          }}
                          className={`h-8 w-8 p-0 rounded-lg ${
                            cliente.ativo
                              ? 'text-rose-600 hover:text-rose-700 hover:bg-rose-500/10'
                              : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10'
                          }`}
                          title={cliente.ativo ? 'Inativar cliente' : 'Ativar cliente'}
                        >
                          {cliente.ativo ? (
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

          {/* Pagination bar */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200/80 dark:border-[#1A294A] bg-slate-50/50 dark:bg-[#0A1328]/50 text-xs text-slate-600 dark:text-[#C0C6CF]">
            <div>
              Mostrando{' '}
              <span className="font-semibold text-slate-900 dark:text-white">
                {Math.min(filteredClientes.length, (currentPage - 1) * PAGE_SIZE + 1)}
              </span>{' '}
              a{' '}
              <span className="font-semibold text-slate-900 dark:text-white">
                {Math.min(filteredClientes.length, currentPage * PAGE_SIZE)}
              </span>{' '}
              de{' '}
              <span className="font-semibold text-slate-900 dark:text-white">
                {filteredClientes.length}
              </span>{' '}
              clientes
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              {editingCliente ? 'Editar Cliente' : 'Novo Cliente'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {editingCliente
                ? 'Atualize os dados cadastrais, endereço e limites do cliente.'
                : 'Preencha as informações para cadastrar um novo cliente na empresa.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {/* Dados Principais */}
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
                    placeholder="Ex: Comercial Alvorada Ltda ou João da Silva"
                    className={`h-9 text-xs ${formErrors.nome ? 'border-red-500' : ''}`}
                    required
                  />
                  {formErrors.nome && <p className="text-[11px] text-red-500">{formErrors.nome}</p>}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="documento" className="text-xs font-semibold text-slate-700">
                    Documento (CPF / CNPJ)
                  </Label>
                  <Input
                    id="documento"
                    value={formData.documento}
                    onChange={(e) => setFormData({ ...formData, documento: e.target.value })}
                    placeholder="CPF ou CNPJ"
                    className="h-9 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="limite_credito" className="text-xs font-semibold text-slate-700">
                    Limite de Crédito (R$)
                  </Label>
                  <Input
                    id="limite_credito"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.limite_credito}
                    onChange={(e) => {
                      setFormData({ ...formData, limite_credito: e.target.value })
                      if (formErrors.limite_credito)
                        setFormErrors({ ...formErrors, limite_credito: '' })
                    }}
                    placeholder="0.00"
                    className={`h-9 text-xs font-mono ${formErrors.limite_credito ? 'border-red-500' : ''}`}
                  />
                  {formErrors.limite_credito && (
                    <p className="text-[11px] text-red-500">{formErrors.limite_credito}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Contato */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 pb-1 border-b border-slate-100">
                Contato
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                  <Label htmlFor="whatsapp" className="text-xs font-semibold text-slate-700">
                    WhatsApp
                  </Label>
                  <Input
                    id="whatsapp"
                    value={formData.whatsapp}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    placeholder="(00) 90000-0000"
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
                    placeholder="cliente@empresa.com"
                    className={`h-9 text-xs ${formErrors.email ? 'border-red-500' : ''}`}
                  />
                  {formErrors.email && (
                    <p className="text-[11px] text-red-500">{formErrors.email}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Endereço */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 pb-1 border-b border-slate-100">
                Endereço
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="cep" className="text-xs font-semibold text-slate-700">
                    CEP
                  </Label>
                  <Input
                    id="cep"
                    value={formData.cep}
                    onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                    placeholder="00000-000"
                    className="h-9 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
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

                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="cidade" className="text-xs font-semibold text-slate-700">
                    Cidade
                  </Label>
                  <Input
                    id="cidade"
                    value={formData.cidade}
                    onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                    placeholder="Cidade"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1 sm:col-span-3">
                  <Label htmlFor="endereco" className="text-xs font-semibold text-slate-700">
                    Logradouro / Endereço
                  </Label>
                  <Input
                    id="endereco"
                    value={formData.endereco}
                    onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                    placeholder="Rua, Avenida, etc."
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1 sm:col-span-1">
                  <Label htmlFor="numero" className="text-xs font-semibold text-slate-700">
                    Número
                  </Label>
                  <Input
                    id="numero"
                    value={formData.numero}
                    onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                    placeholder="123"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="bairro" className="text-xs font-semibold text-slate-700">
                    Bairro
                  </Label>
                  <Input
                    id="bairro"
                    value={formData.bairro}
                    onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                    placeholder="Bairro"
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-1 pt-2">
              <Label htmlFor="observacoes" className="text-xs font-semibold text-slate-700">
                Observações
              </Label>
              <Textarea
                id="observacoes"
                rows={3}
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Informações adicionais, referências comerciais ou preferências de entrega..."
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
        open={Boolean(confirmToggleCliente)}
        onOpenChange={(open) => {
          if (!open) setConfirmToggleCliente(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900 text-base">
              {confirmToggleCliente?.ativo ? 'Inativar cliente?' : 'Ativar cliente?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600">
              {confirmToggleCliente?.ativo
                ? `Tem certeza que deseja inativar o cliente "${confirmToggleCliente?.nome}"? Clientes inativos não aparecem para novos pedidos por padrão.`
                : `Deseja reativar o cliente "${confirmToggleCliente?.nome}" para movimentações e vendas?`}
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
                confirmToggleCliente?.ativo
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {toggling ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  Processando...
                </>
              ) : confirmToggleCliente?.ativo ? (
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
