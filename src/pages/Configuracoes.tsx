import React, { useState, useEffect, useCallback } from 'react'
import { PageHeader, TableSkeleton, ErrorState, EmptyState } from '@/components/common/CommonUI'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useEmpresa } from '@/hooks/use-empresa'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import { ConfiguracoesService, Usuario as UsuarioType } from '@/services/configuracoes'
import { formatPerfilBadge } from '@/lib/permissions'
import { toast } from 'sonner'
import {
  Building2,
  Palette,
  Users,
  Shield,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Key,
  Plus,
  Loader2,
  Save,
  Image as ImageIcon,
  UserCheck,
  Lock,
  HelpCircle,
  Upload,
  Trash2,
  CreditCard,
  Clock,
  Check,
  Calendar,
  Sparkles,
} from 'lucide-react'
import { AssinaturasService, AssinaturaComPlano, AssinaturaStatus } from '@/services/assinaturas'

const PAGE_SIZE = 20

export default function ConfiguracoesPage() {
  const { empresaId, empresa, refreshEmpresa } = useEmpresa()
  const { user, usuario: usuarioLogado } = useAuth()

  const perfilLogado = (usuarioLogado?.perfil || '').toLowerCase()
  const isMasterOrAdmin = perfilLogado === 'master' || perfilLogado === 'admin'
  const isMaster = perfilLogado === 'master'

  // =========================================================================
  // ABA PLANO E ASSINATURA (apenas Master / Admin)
  // =========================================================================
  const [assinatura, setAssinatura] = useState<AssinaturaComPlano | null>(null)
  const [loadingAssinatura, setLoadingAssinatura] = useState(true)
  const [errorAssinatura, setErrorAssinatura] = useState<string | null>(null)

  // Contagens de uso atual para a aba Plano & Assinatura
  const [limitesUso, setLimitesUso] = useState<{
    usuarios: number
    vendedores: number
    produtos: number
    clientes: number
    vendasMes: number
  }>({
    usuarios: 0,
    vendedores: 0,
    produtos: 0,
    clientes: 0,
    vendasMes: 0,
  })

  const loadAssinatura = useCallback(async () => {
    if (!empresaId || !isMasterOrAdmin) {
      setLoadingAssinatura(false)
      return
    }

    setLoadingAssinatura(true)
    setErrorAssinatura(null)
    try {
      const inicioMes = new Date()
      inicioMes.setDate(1)
      inicioMes.setHours(0, 0, 0, 0)

      const [assinaturaRes, usuariosRes, vendedoresRes, produtosRes, clientesRes, vendasMesRes] =
        await Promise.all([
          AssinaturasService.getByEmpresaId(empresaId),
          supabase
            .from('usuarios')
            .select('id', { count: 'exact', head: true })
            .eq('empresa_id', empresaId)
            .eq('ativo', true),
          supabase
            .from('vendedores')
            .select('id', { count: 'exact', head: true })
            .eq('empresa_id', empresaId)
            .eq('ativo', true),
          supabase
            .from('produtos')
            .select('id', { count: 'exact', head: true })
            .eq('empresa_id', empresaId)
            .eq('ativo', true),
          supabase
            .from('clientes')
            .select('id', { count: 'exact', head: true })
            .eq('empresa_id', empresaId)
            .eq('ativo', true),
          supabase
            .from('vendas')
            .select('id', { count: 'exact', head: true })
            .eq('empresa_id', empresaId)
            .eq('status', 'finalizada')
            .gte('created_at', inicioMes.toISOString()),
        ])

      if (assinaturaRes.error) throw assinaturaRes.error
      setAssinatura(assinaturaRes.data)

      setLimitesUso({
        usuarios: usuariosRes.count ?? 0,
        vendedores: vendedoresRes.count ?? 0,
        produtos: produtosRes.count ?? 0,
        clientes: clientesRes.count ?? 0,
        vendasMes: vendasMesRes.count ?? 0,
      })
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.error('Erro ao carregar assinatura:', err)
      }
      setErrorAssinatura(err.message || 'Falha ao carregar informações de plano e assinatura.')
    } finally {
      setLoadingAssinatura(false)
    }
  }, [empresaId, isMasterOrAdmin])

  useEffect(() => {
    if (isMasterOrAdmin) {
      loadAssinatura()
    }
  }, [isMasterOrAdmin, loadAssinatura])

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  }

  const formatStatusAssinatura = (status?: AssinaturaStatus | string) => {
    switch (status) {
      case 'trial':
        return {
          label: 'Período de Teste (Trial)',
          color: 'bg-amber-100 text-amber-800 border-amber-200',
        }
      case 'ativa':
        return {
          label: 'Assinatura Ativa',
          color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        }
      case 'pendente':
        return {
          label: 'Pagamento Pendente',
          color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        }
      case 'atrasada':
        return {
          label: 'Fatura Atrasada',
          color: 'bg-orange-100 text-orange-800 border-orange-200',
        }
      case 'cancelada':
        return {
          label: 'Assinatura Cancelada',
          color: 'bg-rose-100 text-rose-800 border-rose-200',
        }
      case 'bloqueada':
        return {
          label: 'Acesso Bloqueado',
          color: 'bg-slate-200 text-slate-800 border-slate-300',
        }
      default:
        return {
          label: status || 'Sem Assinatura',
          color: 'bg-slate-100 text-slate-700 border-slate-200',
        }
    }
  }

  const calcularDiasRestantesTrial = (fimStr?: string | null): number => {
    if (!fimStr) return 0
    try {
      const fim = new Date(fimStr)
      const hoje = new Date()
      hoje.setHours(0, 0, 0, 0)
      fim.setHours(0, 0, 0, 0)
      const diffMs = fim.getTime() - hoje.getTime()
      return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    } catch {
      return 0
    }
  }

  // =========================================================================
  // ABA 1: EMPRESA
  // =========================================================================
  const [empresaForm, setEmpresaForm] = useState({
    nome: '',
    nome_fantasia: '',
    cnpj: '',
    email: '',
    telefone: '',
    logo_url: '',
  })
  const [savingEmpresa, setSavingEmpresa] = useState(false)

  // Sincronizar form com dados da empresa
  useEffect(() => {
    if (empresa) {
      setEmpresaForm({
        nome: empresa.nome || '',
        nome_fantasia: empresa.nome_fantasia || '',
        cnpj: empresa.cnpj || '',
        email: empresa.email || '',
        telefone: empresa.telefone || '',
        logo_url: empresa.logo_url || '',
      })
    }
  }, [empresa])

  const handleSalvarEmpresa = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!empresaId) return

    if (!isMasterOrAdmin) {
      toast.error('Você não tem permissão para alterar os dados da empresa.')
      return
    }

    const nomeTrimmed = empresaForm.nome.trim()
    if (!nomeTrimmed) {
      toast.error('Razão Social (nome) é obrigatória.')
      return
    }

    if (empresaForm.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(empresaForm.email.trim())) {
        toast.error('Informe um e-mail com formato válido.')
        return
      }
    }

    if (empresaForm.cnpj.trim()) {
      const cnpjDigits = empresaForm.cnpj.replace(/\D/g, '')
      if (cnpjDigits.length < 14) {
        toast.error('CNPJ deve conter no mínimo 14 dígitos.')
        return
      }
    }

    setSavingEmpresa(true)
    try {
      const { error } = await ConfiguracoesService.updateEmpresa(empresaId, {
        nome: nomeTrimmed,
        nome_fantasia: empresaForm.nome_fantasia.trim() || undefined,
        cnpj: empresaForm.cnpj.trim() || undefined,
        email: empresaForm.email.trim() || undefined,
        telefone: empresaForm.telefone.trim() || undefined,
        logo_url: empresaForm.logo_url.trim() || undefined,
      })

      if (error) throw error

      toast.success('Dados da empresa atualizados com sucesso.')
      await refreshEmpresa()
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.error('Erro ao atualizar empresa:', err)
      }
      toast.error(err.message || 'Falha ao atualizar dados da empresa.')
    } finally {
      setSavingEmpresa(false)
    }
  }

  // =========================================================================
  // ABA 2: APARÊNCIA (Logo Upload & URL manual)
  // =========================================================================
  const [logoUrlInput, setLogoUrlInput] = useState('')
  const [savingLogo, setSavingLogo] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [removingLogo, setRemovingLogo] = useState(false)
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null)
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (empresa?.logo_url) {
      setLogoUrlInput(empresa.logo_url)
    } else {
      setLogoUrlInput('')
    }
  }, [empresa?.logo_url])

  // Limpa preview local quando empresa mudar ou ao desmontar
  useEffect(() => {
    return () => {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl)
      }
    }
  }, [localPreviewUrl])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar tipo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Formato de arquivo inválido. Apenas JPG, PNG e WebP são permitidos.')
      e.target.value = ''
      return
    }

    // Validar tamanho (5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error('O arquivo da logo excede o tamanho máximo permitido de 5 MB.')
      e.target.value = ''
      return
    }

    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl)
    }

    setSelectedLogoFile(file)
    setLocalPreviewUrl(URL.createObjectURL(file))
  }

  const handleUploadLogo = async () => {
    if (!empresaId) return
    if (!isMasterOrAdmin) {
      toast.error('Você não tem permissão para alterar a logo.')
      return
    }
    if (!selectedLogoFile) {
      toast.error('Selecione uma imagem para enviar.')
      return
    }

    setUploadingLogo(true)
    try {
      const ext = selectedLogoFile.name.split('.').pop()?.toLowerCase() || 'png'
      const filePath = `${empresaId}/logo.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, selectedLogoFile, { upsert: true })

      if (uploadError) throw uploadError

      const { data: publicData } = supabase.storage.from('logos').getPublicUrl(filePath)
      const publicUrl = `${publicData.publicUrl}?t=${Date.now()}`

      const { error: updateError } = await ConfiguracoesService.updateEmpresa(empresaId, {
        logo_url: publicUrl,
      })
      if (updateError) throw updateError

      toast.success('Logo atualizada com sucesso!')
      setSelectedLogoFile(null)
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl)
        setLocalPreviewUrl(null)
      }
      await refreshEmpresa()
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.error('Erro ao fazer upload da logo:', err)
      }
      toast.error(err.message || 'Falha ao fazer upload da logo.')
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleRemoverLogo = async () => {
    if (!empresaId) return
    if (!isMasterOrAdmin) {
      toast.error('Você não tem permissão para remover a logo.')
      return
    }

    setRemovingLogo(true)
    try {
      if (empresa?.logo_url && empresa.logo_url.includes('/logos/')) {
        try {
          const urlObj = new URL(empresa.logo_url)
          const pathParts = urlObj.pathname.split('/logos/')
          if (pathParts.length > 1) {
            const rawPath = pathParts[1]
            await supabase.storage.from('logos').remove([decodeURIComponent(rawPath)])
          }
        } catch {
          // Ignora erro de parsing e segue para limpar na tabela
        }
      }

      const { error: updateError } = await ConfiguracoesService.updateEmpresa(empresaId, {
        logo_url: null,
      })
      if (updateError) throw updateError

      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl)
        setLocalPreviewUrl(null)
      }
      setSelectedLogoFile(null)
      setLogoUrlInput('')

      toast.success('Logo removida com sucesso.')
      await refreshEmpresa()
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.error('Erro ao remover logo:', err)
      }
      toast.error(err.message || 'Falha ao remover logo.')
    } finally {
      setRemovingLogo(false)
    }
  }

  const handleSalvarLogoUrl = async () => {
    if (!empresaId) return
    if (!isMasterOrAdmin) {
      toast.error('Você não tem permissão para alterar a logo.')
      return
    }

    setSavingLogo(true)
    try {
      const val = logoUrlInput.trim()
      const { error } = await ConfiguracoesService.updateEmpresa(empresaId, {
        logo_url: val || null,
      })
      if (error) throw error
      toast.success('URL da logo atualizada com sucesso.')
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl)
        setLocalPreviewUrl(null)
      }
      setSelectedLogoFile(null)
      await refreshEmpresa()
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.error('Erro ao salvar URL da logo:', err)
      }
      toast.error(err.message || 'Falha ao atualizar logo.')
    } finally {
      setSavingLogo(false)
    }
  }

  // =========================================================================
  // ABA 3: USUÁRIOS
  // =========================================================================
  const [usuarios, setUsuarios] = useState<UsuarioType[]>([])
  const [totalUsuarios, setTotalUsuarios] = useState(0)
  const [loadingUsuarios, setLoadingUsuarios] = useState(true)
  const [errorUsuarios, setErrorUsuarios] = useState<string | null>(null)

  // Filtros
  const [searchUsuario, setSearchUsuario] = useState('')
  const [debouncedSearchUsuario, setDebouncedSearchUsuario] = useState('')
  const [perfilFilter, setPerfilFilter] = useState('todos')
  const [statusFilter, setStatusFilter] = useState<'todos' | 'ativo' | 'inativo'>('todos')
  const [page, setPage] = useState(1)

  // Debounce search (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchUsuario(searchUsuario)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchUsuario])

  const loadUsuarios = useCallback(async () => {
    if (!empresaId) return
    setLoadingUsuarios(true)
    setErrorUsuarios(null)
    try {
      const excludeMasters = perfilLogado === 'admin'

      const filterOpts = {
        search: debouncedSearchUsuario,
        perfil: perfilFilter,
        status: statusFilter,
        excludeMasters,
        page,
        pageSize: PAGE_SIZE,
      }

      const [listRes, countRes] = await Promise.all([
        ConfiguracoesService.listUsuariosEmpresa(empresaId, filterOpts),
        ConfiguracoesService.countUsuariosEmpresa(empresaId, {
          search: debouncedSearchUsuario,
          perfil: perfilFilter,
          status: statusFilter,
          excludeMasters,
        }),
      ])

      if (listRes.error) throw listRes.error
      if (countRes.error) throw countRes.error

      setUsuarios((listRes.data as UsuarioType[]) || [])
      setTotalUsuarios(countRes.count || 0)
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.error('Erro ao carregar usuários:', err)
      }
      setErrorUsuarios(err.message || 'Falha ao carregar lista de usuários.')
    } finally {
      setLoadingUsuarios(false)
    }
  }, [empresaId, debouncedSearchUsuario, perfilFilter, statusFilter, page, perfilLogado])

  useEffect(() => {
    loadUsuarios()
  }, [loadUsuarios])

  const limparFiltrosUsuarios = () => {
    setSearchUsuario('')
    setDebouncedSearchUsuario('')
    setPerfilFilter('todos')
    setStatusFilter('todos')
    setPage(1)
  }

  const temFiltroAtivoUsuarios =
    debouncedSearchUsuario !== '' || perfilFilter !== 'todos' || statusFilter !== 'todos'

  const totalPaginasUsuarios = Math.ceil(totalUsuarios / PAGE_SIZE) || 1

  // =========================================================================
  // DIALOGS: USUÁRIOS (Toggle Ativo, Alterar Perfil e Novo Usuário)
  // =========================================================================
  const [dialogToggleUser, setDialogToggleUser] = useState<UsuarioType | null>(null)
  const [submittingToggle, setSubmittingToggle] = useState(false)

  const [dialogPerfilUser, setDialogPerfilUser] = useState<UsuarioType | null>(null)
  const [novoPerfilSelecionado, setNovoPerfilSelecionado] = useState<string>('')
  const [submittingPerfil, setSubmittingPerfil] = useState(false)

  // =========================================================================
  // DIALOG: NOVO USUÁRIO
  // =========================================================================
  const [dialogNovoUsuario, setDialogNovoUsuario] = useState(false)
  const [novoUsuarioNome, setNovoUsuarioNome] = useState('')
  const [novoUsuarioEmail, setNovoUsuarioEmail] = useState('')
  const [novoUsuarioPerfil, setNovoUsuarioPerfil] = useState('vendedor')
  const [novoUsuarioSenha, setNovoUsuarioSenha] = useState('')
  const [submittingNovoUsuario, setSubmittingNovoUsuario] = useState(false)

  const handleCreateUsuario = async () => {
    if (!novoUsuarioNome.trim()) {
      toast.error('Nome é obrigatório.')
      return
    }
    if (!novoUsuarioEmail.trim()) {
      toast.error('E-mail é obrigatório.')
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(novoUsuarioEmail.trim())) {
      toast.error('E-mail inválido.')
      return
    }
    if (!novoUsuarioSenha || novoUsuarioSenha.length < 6) {
      toast.error('Senha deve ter no mínimo 6 caracteres.')
      return
    }
    if (!novoUsuarioPerfil) {
      toast.error('Perfil é obrigatório.')
      return
    }

    setSubmittingNovoUsuario(true)
    try {
      const { error } = await ConfiguracoesService.createUsuario({
        nome: novoUsuarioNome.trim(),
        email: novoUsuarioEmail.trim().toLowerCase(),
        perfil: novoUsuarioPerfil,
        senha: novoUsuarioSenha,
      })
      if (error) throw error
      toast.success('Usuário criado com sucesso.')
      setDialogNovoUsuario(false)
      setNovoUsuarioNome('')
      setNovoUsuarioEmail('')
      setNovoUsuarioPerfil('vendedor')
      setNovoUsuarioSenha('')
      loadUsuarios()
    } catch (err: any) {
      toast.error(err.message || 'Não foi possível criar o usuário.')
    } finally {
      setSubmittingNovoUsuario(false)
    }
  }

  const handleConfirmToggleAtivo = async () => {
    if (!dialogToggleUser) return
    const novoStatus = !dialogToggleUser.ativo

    setSubmittingToggle(true)
    try {
      const { error } = await ConfiguracoesService.toggleUsuarioAtivo(
        dialogToggleUser.id,
        novoStatus,
      )
      if (error) throw error

      toast.success(
        `Usuário ${dialogToggleUser.nome} ${novoStatus ? 'ativado' : 'inativado'} com sucesso.`,
      )
      setDialogToggleUser(null)
      loadUsuarios()
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.error('Erro ao alterar status do usuário:', err)
      }
      toast.error(err.message || 'Falha ao alterar status do usuário.')
    } finally {
      setSubmittingToggle(false)
    }
  }

  const handleOpenDialogPerfil = (targetUser: UsuarioType) => {
    if (targetUser.id === usuarioLogado?.id) {
      toast.error('Você não pode alterar o seu próprio perfil.')
      return
    }
    const targetPerfil = (targetUser.perfil || '').toLowerCase()
    if (!isMaster && targetPerfil === 'master') {
      toast.error('Apenas usuários Master podem gerenciar outros usuários Master.')
      return
    }

    setDialogPerfilUser(targetUser)
    setNovoPerfilSelecionado(targetPerfil || 'vendedor')
  }

  const handleConfirmUpdatePerfil = async () => {
    if (!dialogPerfilUser || !novoPerfilSelecionado) return

    if (dialogPerfilUser.id === usuarioLogado?.id) {
      toast.error('Você não pode alterar o seu próprio perfil.')
      return
    }

    const targetPerfil = (dialogPerfilUser.perfil || '').toLowerCase()
    if (!isMaster && targetPerfil === 'master') {
      toast.error('Apenas usuários Master podem alterar perfis de usuários Master.')
      return
    }

    if (!isMaster && novoPerfilSelecionado === 'master') {
      toast.error('Apenas usuários Master podem promover outros usuários para Master.')
      return
    }

    setSubmittingPerfil(true)
    try {
      const { error } = await ConfiguracoesService.updateUsuarioPerfil(
        dialogPerfilUser.id,
        novoPerfilSelecionado,
      )
      if (error) throw error

      toast.success(
        `Perfil de ${dialogPerfilUser.nome} alterado para ${novoPerfilSelecionado.toUpperCase()} com sucesso.`,
      )
      setDialogPerfilUser(null)
      loadUsuarios()
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.error('Erro ao alterar perfil:', err)
      }
      toast.error(err.message || 'Falha ao alterar perfil do usuário.')
    } finally {
      setSubmittingPerfil(false)
    }
  }

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-'
    try {
      return new Date(dateStr).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    } catch {
      return '-'
    }
  }

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return 'Não registrado'
    try {
      return new Date(dateStr).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return 'Não registrado'
    }
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <PageHeader
          title="Configurações"
          description="Gerencie os dados da empresa, aparência, usuários e segurança."
        />

        <Tabs defaultValue="empresa" className="space-y-6">
          {/* Navegação de Abas */}
          <TabsList
            className={`bg-slate-100 p-1 border border-slate-200 grid ${
              isMasterOrAdmin ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4'
            } w-full sm:w-auto h-auto gap-1`}
          >
            <TabsTrigger
              value="empresa"
              className="flex items-center gap-2 text-xs font-semibold py-2 data-[state=active]:bg-white data-[state=active]:text-teal-800 data-[state=active]:shadow-xs"
            >
              <Building2 className="w-4 h-4" />
              <span>Empresa</span>
            </TabsTrigger>

            <TabsTrigger
              value="aparencia"
              className="flex items-center gap-2 text-xs font-semibold py-2 data-[state=active]:bg-white data-[state=active]:text-teal-800 data-[state=active]:shadow-xs"
            >
              <Palette className="w-4 h-4" />
              <span>Aparência</span>
            </TabsTrigger>

            <TabsTrigger
              value="usuarios"
              className="flex items-center gap-2 text-xs font-semibold py-2 data-[state=active]:bg-white data-[state=active]:text-teal-800 data-[state=active]:shadow-xs"
            >
              <Users className="w-4 h-4" />
              <span>Usuários</span>
            </TabsTrigger>

            {isMasterOrAdmin && (
              <TabsTrigger
                value="plano"
                className="flex items-center gap-2 text-xs font-semibold py-2 data-[state=active]:bg-white data-[state=active]:text-teal-800 data-[state=active]:shadow-xs"
              >
                <CreditCard className="w-4 h-4" />
                <span>Plano & Assinatura</span>
              </TabsTrigger>
            )}

            <TabsTrigger
              value="seguranca"
              className="flex items-center gap-2 text-xs font-semibold py-2 data-[state=active]:bg-white data-[state=active]:text-teal-800 data-[state=active]:shadow-xs"
            >
              <Shield className="w-4 h-4" />
              <span>Segurança</span>
            </TabsTrigger>
          </TabsList>

          {/* =========================================================================
              ABA 1: DADOS DA EMPRESA
              ========================================================================= */}
          <TabsContent value="empresa" className="space-y-6">
            <Card className="border border-slate-200 bg-white shadow-xs">
              <CardHeader className="border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2 text-teal-700">
                  <Building2 className="w-5 h-5" />
                  <CardTitle className="text-base font-bold text-slate-900">
                    Dados Cadastrais da Empresa
                  </CardTitle>
                </div>
                <CardDescription className="text-xs text-slate-500">
                  Mantenha as informações legais e de contato da sua distribuidora sempre
                  atualizadas.
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-6">
                <form onSubmit={handleSalvarEmpresa} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Razão Social (nome) */}
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label
                        htmlFor="empresa-nome"
                        className="text-xs font-semibold text-slate-700"
                      >
                        Razão Social <span className="text-rose-500">*</span>
                      </Label>
                      <Input
                        id="empresa-nome"
                        value={empresaForm.nome}
                        onChange={(e) => setEmpresaForm({ ...empresaForm, nome: e.target.value })}
                        placeholder="Nome empresarial oficial"
                        required
                        disabled={!isMasterOrAdmin || savingEmpresa}
                        className="text-xs h-9 bg-white border-slate-200"
                      />
                    </div>

                    {/* Nome Fantasia */}
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="empresa-fantasia"
                        className="text-xs font-semibold text-slate-700"
                      >
                        Nome Fantasia
                      </Label>
                      <Input
                        id="empresa-fantasia"
                        value={empresaForm.nome_fantasia}
                        onChange={(e) =>
                          setEmpresaForm({ ...empresaForm, nome_fantasia: e.target.value })
                        }
                        placeholder="Nome comercial da empresa"
                        disabled={!isMasterOrAdmin || savingEmpresa}
                        className="text-xs h-9 bg-white border-slate-200"
                      />
                    </div>

                    {/* CNPJ */}
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="empresa-cnpj"
                        className="text-xs font-semibold text-slate-700"
                      >
                        CNPJ
                      </Label>
                      <Input
                        id="empresa-cnpj"
                        value={empresaForm.cnpj}
                        onChange={(e) => setEmpresaForm({ ...empresaForm, cnpj: e.target.value })}
                        placeholder="00.000.000/0000-00"
                        disabled={!isMasterOrAdmin || savingEmpresa}
                        className="text-xs h-9 bg-white border-slate-200 font-mono"
                      />
                    </div>

                    {/* Email de Contato */}
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="empresa-email"
                        className="text-xs font-semibold text-slate-700"
                      >
                        E-mail de Contato
                      </Label>
                      <Input
                        id="empresa-email"
                        type="email"
                        value={empresaForm.email}
                        onChange={(e) => setEmpresaForm({ ...empresaForm, email: e.target.value })}
                        placeholder="contato@empresa.com.br"
                        disabled={!isMasterOrAdmin || savingEmpresa}
                        className="text-xs h-9 bg-white border-slate-200"
                      />
                    </div>

                    {/* Telefone */}
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="empresa-telefone"
                        className="text-xs font-semibold text-slate-700"
                      >
                        Telefone
                      </Label>
                      <Input
                        id="empresa-telefone"
                        value={empresaForm.telefone}
                        onChange={(e) =>
                          setEmpresaForm({ ...empresaForm, telefone: e.target.value })
                        }
                        placeholder="(00) 00000-0000"
                        disabled={!isMasterOrAdmin || savingEmpresa}
                        className="text-xs h-9 bg-white border-slate-200"
                      />
                    </div>
                  </div>

                  {/* Informações adicionais do sistema (somente leitura) */}
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-3 text-slate-600">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-700">Status da Conta:</span>
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                        {empresa?.status || 'Ativo'}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-slate-500">Cadastrada em: </span>
                      <span className="font-medium text-slate-700">
                        {formatDate(empresa?.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Ação Salvar */}
                  {isMasterOrAdmin ? (
                    <div className="flex justify-end pt-2">
                      <Button
                        type="submit"
                        disabled={savingEmpresa}
                        className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold flex items-center gap-2 shadow-xs h-9 px-4"
                      >
                        {savingEmpresa ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Salvando Alterações...
                          </>
                        ) : (
                          <>
                            <Save className="w-3.5 h-3.5" />
                            Salvar Alterações
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="text-xs text-amber-600 bg-amber-50 p-2.5 rounded border border-amber-200 flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 shrink-0" />
                      Apenas usuários com perfil Master ou Administrador podem editar os dados da
                      empresa.
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* =========================================================================
              ABA 2: APARÊNCIA
              ========================================================================= */}
          <TabsContent value="aparencia" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card Identidade Visual & Logo */}
              <Card className="border border-slate-200 bg-white shadow-xs">
                <CardHeader className="border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 text-teal-700">
                    <ImageIcon className="w-5 h-5" />
                    <CardTitle className="text-base font-bold text-slate-900">
                      Identidade Visual
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs text-slate-500">
                    Logo e identidade da empresa exibidas na barra superior e relatórios.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-5 space-y-5">
                  {/* Preview da Logo */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-xs font-semibold text-slate-700 block">
                        Preview da Logo
                      </Label>
                      {selectedLogoFile && (
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-teal-50 text-teal-700 border-teal-200"
                        >
                          Novo arquivo selecionado
                        </Badge>
                      )}
                    </div>
                    <div className="w-full h-40 rounded-xl border border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center p-4 overflow-hidden relative group">
                      {localPreviewUrl || empresa?.logo_url ? (
                        <img
                          src={localPreviewUrl || empresa?.logo_url || ''}
                          alt="Logo da Empresa"
                          className="h-full w-full object-contain rounded"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            ;(e.currentTarget as HTMLElement).style.display = 'none'
                          }}
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-slate-400">
                          <Building2 className="w-10 h-10 text-slate-300" />
                          <span className="text-xs font-medium">Nenhuma logo cadastrada</span>
                          <span className="text-[11px] text-slate-400">
                            JPG, PNG ou WebP até 5 MB
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Upload direto de arquivo */}
                  <div className="space-y-3 pt-1 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-slate-700">
                        Upload de Logo (Supabase Storage)
                      </Label>
                      <span className="text-[11px] text-slate-400">Máx. 5 MB</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="file"
                        id="logo-file-input"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        disabled={!isMasterOrAdmin || uploadingLogo || removingLogo}
                        onChange={handleFileChange}
                      />
                      <label htmlFor="logo-file-input">
                        <Button
                          type="button"
                          variant="outline"
                          asChild
                          disabled={!isMasterOrAdmin || uploadingLogo || removingLogo}
                          className="text-xs h-9 cursor-pointer border-slate-200 hover:bg-slate-50"
                        >
                          <span>
                            <Upload className="w-3.5 h-3.5 mr-1.5 text-slate-600" />
                            {selectedLogoFile ? 'Trocar Arquivo' : 'Selecionar Arquivo'}
                          </span>
                        </Button>
                      </label>

                      {selectedLogoFile && (
                        <Button
                          type="button"
                          onClick={handleUploadLogo}
                          disabled={!isMasterOrAdmin || uploadingLogo || removingLogo}
                          className="bg-teal-700 hover:bg-teal-800 text-white text-xs h-9 font-medium shadow-xs"
                        >
                          {uploadingLogo ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                              Enviando...
                            </>
                          ) : (
                            <>
                              <Upload className="w-3.5 h-3.5 mr-1.5" />
                              Confirmar Envio
                            </>
                          )}
                        </Button>
                      )}

                      {(empresa?.logo_url || selectedLogoFile) && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleRemoverLogo}
                          disabled={!isMasterOrAdmin || uploadingLogo || removingLogo}
                          className="text-xs h-9 border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        >
                          {removingLogo ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                          )}
                          Remover Logo
                        </Button>
                      )}
                    </div>

                    {selectedLogoFile && (
                      <p className="text-[11px] text-slate-500 truncate">
                        Selecionado:{' '}
                        <span className="font-mono text-slate-700">{selectedLogoFile.name}</span> (
                        {(selectedLogoFile.size / 1024).toFixed(1)} KB)
                      </p>
                    )}
                  </div>

                  {/* Input de URL manual */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <Label
                      htmlFor="logo-url-input"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Ou informe a URL da Logo (Link Externo)
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="logo-url-input"
                        type="url"
                        value={logoUrlInput}
                        onChange={(e) => setLogoUrlInput(e.target.value)}
                        placeholder="https://exemplo.com/logo.png"
                        disabled={!isMasterOrAdmin || savingLogo || uploadingLogo || removingLogo}
                        className="text-xs h-9 bg-white border-slate-200"
                      />
                      <Button
                        type="button"
                        onClick={handleSalvarLogoUrl}
                        disabled={!isMasterOrAdmin || savingLogo || uploadingLogo || removingLogo}
                        className="bg-teal-700 hover:bg-teal-800 text-white text-xs h-9 shrink-0 font-medium"
                      >
                        {savingLogo ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          'Salvar URL'
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Card Cores e Tema */}
              <Card className="border border-slate-200 bg-white shadow-xs">
                <CardHeader className="border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 text-teal-700">
                    <Palette className="w-5 h-5" />
                    <CardTitle className="text-base font-bold text-slate-900">
                      Cores e Tema
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs text-slate-500">
                    Personalização do esquema de cores e layout do painel.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="p-8 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center space-y-2">
                    <Palette className="w-10 h-10 text-slate-300 mx-auto" />
                    <p className="text-sm font-semibold text-slate-700">
                      Personalização de cores e tema disponível em breve.
                    </p>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Em atualizações futuras você poderá configurar temas claros/escuros e paletas
                      personalizadas com a cor da sua marca.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* =========================================================================
              ABA 3: USUÁRIOS
              ========================================================================= */}
          <TabsContent value="usuarios" className="space-y-6">
            <Card className="border border-slate-200 bg-white shadow-xs">
              <CardHeader className="border-b border-slate-100 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2 text-teal-700">
                    <Users className="w-5 h-5" />
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-bold text-slate-900">
                          Usuários da Empresa
                        </CardTitle>
                        <Badge
                          variant="outline"
                          className="bg-teal-50 text-teal-700 border-teal-200 font-semibold"
                        >
                          {totalUsuarios} {totalUsuarios === 1 ? 'usuário' : 'usuários'}
                        </Badge>
                      </div>
                      <CardDescription className="text-xs text-slate-500 mt-0.5">
                        Gerencie acessos, papéis de permissão e status de membros da sua equipe.
                      </CardDescription>
                    </div>
                  </div>

                  {/* Botão Novo Usuário */}
                  {isMasterOrAdmin && (
                    <div className="flex flex-col items-start sm:items-end">
                      <Button
                        type="button"
                        onClick={() => setDialogNovoUsuario(true)}
                        className="bg-teal-700 hover:bg-teal-800 text-white text-xs h-9 flex items-center gap-1.5"
                      >
                        <Plus className="w-4 h-4" />
                        Novo Usuário
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="pt-4 space-y-4">
                {/* Filtros */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3 items-center">
                    {/* Input de Busca */}
                    <div className="sm:col-span-2 relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <Input
                        placeholder="Buscar por nome ou e-mail..."
                        value={searchUsuario}
                        onChange={(e) => setSearchUsuario(e.target.value)}
                        className="pl-9 bg-white border-slate-200 text-xs h-9"
                      />
                      {searchUsuario && (
                        <button
                          type="button"
                          onClick={() => setSearchUsuario('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Select de Perfil */}
                    <div>
                      <Select
                        value={perfilFilter}
                        onValueChange={(val) => {
                          setPerfilFilter(val)
                          setPage(1)
                        }}
                      >
                        <SelectTrigger className="text-xs h-9 bg-white border-slate-200">
                          <SelectValue placeholder="Perfil" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos" className="text-xs">
                            Todos os perfis
                          </SelectItem>
                          {perfilLogado !== 'admin' && (
                            <SelectItem value="master" className="text-xs">
                              Master
                            </SelectItem>
                          )}
                          <SelectItem value="admin" className="text-xs">
                            Administrador
                          </SelectItem>
                          <SelectItem value="gerente" className="text-xs">
                            Gerente
                          </SelectItem>
                          <SelectItem value="vendedor" className="text-xs">
                            Vendedor
                          </SelectItem>
                          <SelectItem value="operador" className="text-xs">
                            Operador
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Select de Status */}
                    <div>
                      <Select
                        value={statusFilter}
                        onValueChange={(val: 'todos' | 'ativo' | 'inativo') => {
                          setStatusFilter(val)
                          setPage(1)
                        }}
                      >
                        <SelectTrigger className="text-xs h-9 bg-white border-slate-200">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos" className="text-xs">
                            Todos os status
                          </SelectItem>
                          <SelectItem
                            value="ativo"
                            className="text-xs text-emerald-600 font-medium"
                          >
                            Ativos
                          </SelectItem>
                          <SelectItem value="inativo" className="text-xs text-rose-600 font-medium">
                            Inativos
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {temFiltroAtivoUsuarios && (
                    <div className="flex justify-end pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={limparFiltrosUsuarios}
                        className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1.5 h-7"
                      >
                        <X className="w-3 h-3" />
                        Limpar filtros
                      </Button>
                    </div>
                  )}
                </div>

                {/* Tabela de Usuários */}
                {loadingUsuarios ? (
                  <TableSkeleton rows={4} cols={7} />
                ) : errorUsuarios ? (
                  <ErrorState message={errorUsuarios} onRetry={loadUsuarios} />
                ) : usuarios.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="Nenhum usuário encontrado"
                    description={
                      temFiltroAtivoUsuarios
                        ? 'Nenhum usuário corresponde aos filtros aplicados.'
                        : 'Nenhum usuário cadastrado para esta empresa.'
                    }
                    actionLabel={temFiltroAtivoUsuarios ? 'Limpar Filtros' : undefined}
                    onAction={temFiltroAtivoUsuarios ? limparFiltrosUsuarios : undefined}
                  />
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-600">
                        <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          <tr>
                            <th className="py-3 px-4">Nome</th>
                            <th className="py-3 px-4">E-mail</th>
                            <th className="py-3 px-4">Telefone</th>
                            <th className="py-3 px-4">Perfil</th>
                            <th className="py-3 px-4 text-center">Status</th>
                            <th className="py-3 px-4">Criado em</th>
                            <th className="py-3 px-4 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {usuarios.map((usr) => {
                            const badgeInfo = formatPerfilBadge(usr.perfil)
                            const isSelf = usr.id === usuarioLogado?.id
                            const usrPerfil = (usr.perfil || '').toLowerCase()
                            const isTargetMaster = usrPerfil === 'master'
                            const podeEditarPerfil =
                              isMasterOrAdmin && !isSelf && (isMaster || !isTargetMaster)
                            const podeToggleStatus =
                              isMasterOrAdmin && !isSelf && (isMaster || !isTargetMaster)

                            return (
                              <tr key={usr.id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="py-3 px-4">
                                  <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                    {usr.nome}
                                    {isSelf && (
                                      <Badge
                                        variant="outline"
                                        className="text-[9px] bg-teal-50 text-teal-700 border-teal-200 py-0"
                                      >
                                        Você
                                      </Badge>
                                    )}
                                  </div>
                                </td>

                                <td className="py-3 px-4 font-mono text-slate-600">{usr.email}</td>

                                <td className="py-3 px-4 text-slate-600">{usr.telefone || '-'}</td>

                                <td className="py-3 px-4">
                                  <Badge
                                    variant="outline"
                                    className={`font-semibold text-[10px] uppercase tracking-wider ${badgeInfo.color}`}
                                  >
                                    {badgeInfo.label}
                                  </Badge>
                                </td>

                                <td className="py-3 px-4 text-center">
                                  <Badge
                                    variant="outline"
                                    className={
                                      usr.ativo
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold'
                                        : 'bg-rose-50 text-rose-700 border-rose-200 font-semibold'
                                    }
                                  >
                                    {usr.ativo ? 'Ativo' : 'Inativo'}
                                  </Badge>
                                </td>

                                <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                                  {formatDate(usr.created_at)}
                                </td>

                                <td className="py-3 px-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {/* Alterar Perfil */}
                                    {podeEditarPerfil && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleOpenDialogPerfil(usr)}
                                        className="h-7 text-[11px] px-2 text-slate-700 border-slate-200 hover:bg-slate-50"
                                        title="Alterar Perfil de Acesso"
                                      >
                                        Alterar Perfil
                                      </Button>
                                    )}

                                    {/* Toggle Ativo/Inativo */}
                                    {podeToggleStatus && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setDialogToggleUser(usr)}
                                        className={`h-7 text-[11px] px-2 flex items-center gap-1 ${
                                          usr.ativo
                                            ? 'text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700'
                                            : 'text-emerald-700 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800'
                                        }`}
                                      >
                                        {usr.ativo ? (
                                          <>
                                            <XCircle className="w-3.5 h-3.5" />
                                            Inativar
                                          </>
                                        ) : (
                                          <>
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            Ativar
                                          </>
                                        )}
                                      </Button>
                                    )}

                                    {/* Reenviar Senha (Disabled com Tooltip) */}
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span tabIndex={0}>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            disabled
                                            className="h-7 w-7 p-0 text-slate-400 cursor-not-allowed opacity-60"
                                          >
                                            <Key className="w-3.5 h-3.5" />
                                          </Button>
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="text-xs">
                                          Funcionalidade disponível em breve.
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Paginação */}
                    <div className="py-3 px-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
                      <div>
                        Mostrando{' '}
                        <span className="font-semibold text-slate-900">
                          {totalUsuarios === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}
                        </span>{' '}
                        a{' '}
                        <span className="font-semibold text-slate-900">
                          {Math.min(page * PAGE_SIZE, totalUsuarios)}
                        </span>{' '}
                        de <span className="font-semibold text-slate-900">{totalUsuarios}</span>{' '}
                        usuários
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          className="h-8 w-8 p-0"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <span className="text-xs px-2 font-medium">
                          Página {page} de {totalPaginasUsuarios}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page >= totalPaginasUsuarios}
                          onClick={() => setPage((p) => Math.min(totalPaginasUsuarios, p + 1))}
                          className="h-8 w-8 p-0"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* =========================================================================
              ABA PLANO E ASSINATURA (Master/Admin)
              ========================================================================= */}
          {isMasterOrAdmin && (
            <TabsContent value="plano" className="space-y-6">
              {loadingAssinatura ? (
                <TableSkeleton rows={4} cols={2} />
              ) : errorAssinatura ? (
                <ErrorState message={errorAssinatura} onRetry={loadAssinatura} />
              ) : !assinatura ? (
                <EmptyState
                  icon={CreditCard}
                  title="Nenhuma assinatura ativa"
                  description="Esta empresa não possui um plano ou assinatura vinculado no momento."
                />
              ) : (
                <div className="space-y-6">
                  {/* Card Principal da Assinatura */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="border border-slate-200 bg-white shadow-xs lg:col-span-2">
                      <CardHeader className="border-b border-slate-100 pb-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="flex items-center gap-2.5 text-teal-700">
                            <CreditCard className="w-5 h-5" />
                            <div>
                              <CardTitle className="text-base font-bold text-slate-900">
                                Detalhes da Assinatura
                              </CardTitle>
                              <CardDescription className="text-xs text-slate-500 mt-0.5">
                                Informações do plano contratado e vigência da conta
                              </CardDescription>
                            </div>
                          </div>
                          {(() => {
                            const badge = formatStatusAssinatura(assinatura.status)
                            return (
                              <Badge
                                variant="outline"
                                className={`text-xs font-semibold px-2.5 py-1 ${badge.color}`}
                              >
                                {badge.label}
                              </Badge>
                            )
                          })()}
                        </div>
                      </CardHeader>

                      <CardContent className="pt-6 space-y-6">
                        {/* Bloco Destaque: Plano e Valor */}
                        <div className="p-4 rounded-xl border border-teal-100 bg-teal-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <span className="text-xs font-medium text-teal-800 uppercase tracking-wider block">
                              Plano Atual
                            </span>
                            <h3 className="text-xl font-bold text-slate-900 mt-0.5">
                              {assinatura.planos?.nome || 'Plano Personalizado'}
                            </h3>
                            {assinatura.planos?.descricao && (
                              <p className="text-xs text-slate-600 mt-1 max-w-md">
                                {assinatura.planos.descricao}
                              </p>
                            )}
                          </div>

                          <div className="sm:text-right">
                            <span className="text-xs font-medium text-slate-500 block">
                              Valor Mensal
                            </span>
                            <div className="text-2xl font-extrabold text-teal-900 mt-0.5">
                              {formatCurrency(
                                Number(assinatura.valor || assinatura.planos?.valor_mensal || 0),
                              )}
                              <span className="text-xs font-normal text-slate-500"> /mês</span>
                            </div>
                          </div>
                        </div>

                        {/* Grade de Datas e Prazos */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                          <div className="p-3.5 rounded-lg border border-slate-100 bg-slate-50/70 space-y-1">
                            <span className="text-slate-500 font-medium flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              Data de Início
                            </span>
                            <p className="text-sm font-semibold text-slate-800">
                              {formatDate(assinatura.inicio)}
                            </p>
                          </div>

                          {assinatura.status === 'trial' ? (
                            <div className="p-3.5 rounded-lg border border-amber-200 bg-amber-50/50 space-y-1">
                              <span className="text-amber-800 font-medium flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                                Fim do Período de Teste
                              </span>
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-bold text-amber-950">
                                  {formatDate(assinatura.fim_periodo_teste)}
                                </p>
                                {(() => {
                                  const dias = calcularDiasRestantesTrial(
                                    assinatura.fim_periodo_teste,
                                  )
                                  const cor =
                                    dias <= 0
                                      ? 'text-red-700 bg-red-100 border-red-200'
                                      : dias <= 5
                                        ? 'text-amber-800 bg-amber-100 border-amber-300'
                                        : 'text-teal-800 bg-teal-100 border-teal-200'
                                  return (
                                    <Badge
                                      variant="outline"
                                      className={`text-[11px] font-semibold ${cor}`}
                                    >
                                      {dias <= 0
                                        ? 'Expirado'
                                        : dias === 1
                                          ? 'Resta 1 dia'
                                          : `Restam ${dias} dias`}
                                    </Badge>
                                  )
                                })()}
                              </div>
                            </div>
                          ) : (
                            <div className="p-3.5 rounded-lg border border-slate-100 bg-slate-50/70 space-y-1">
                              <span className="text-slate-500 font-medium flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                Próxima Cobrança
                              </span>
                              <p className="text-sm font-semibold text-slate-800">
                                {assinatura.proxima_cobranca
                                  ? formatDate(assinatura.proxima_cobranca)
                                  : 'Não agendada'}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Aviso informativo de leitura */}
                        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-[11px] text-slate-500 flex items-center gap-2">
                          <HelpCircle className="w-4 h-4 shrink-0 text-slate-400" />
                          <span>
                            As assinaturas e limites operacionais são gerenciados diretamente pelo
                            suporte da plataforma EVO Gestão.
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Card de Limites do Plano (Consumo Atual) */}
                    <Card className="border border-slate-200 bg-white shadow-xs lg:col-span-3">
                      <CardHeader className="border-b border-slate-100 pb-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="flex items-center gap-2 text-teal-700">
                            <Shield className="w-5 h-5" />
                            <div>
                              <CardTitle className="text-base font-bold text-slate-900">
                                Limites do Plano
                              </CardTitle>
                              <CardDescription className="text-xs text-slate-500 mt-0.5">
                                Acompanhamento de capacidade e uso atual dos recursos contratados
                              </CardDescription>
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className="bg-teal-50 text-teal-700 border-teal-200 font-semibold text-xs"
                          >
                            Plano {assinatura.planos?.nome || 'Atual'}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                          {[
                            {
                              label: 'Usuários Ativos',
                              current: limitesUso.usuarios,
                              limit: assinatura.planos?.limite_usuarios,
                              desc: 'Usuários com login habilitado',
                            },
                            {
                              label: 'Vendedores Ativos',
                              current: limitesUso.vendedores,
                              limit: assinatura.planos?.limite_vendedores,
                              desc: 'Equipe comercial cadastrada',
                            },
                            {
                              label: 'Produtos Cadastrados',
                              current: limitesUso.produtos,
                              limit: assinatura.planos?.limite_produtos,
                              desc: 'Itens ativos no catálogo',
                            },
                            {
                              label: 'Clientes Cadastrados',
                              current: limitesUso.clientes,
                              limit: assinatura.planos?.limite_clientes,
                              desc: 'Carteira de clientes ativos',
                            },
                            {
                              label: 'Vendas no Mês',
                              current: limitesUso.vendasMes,
                              limit: assinatura.planos?.limite_vendas_mes,
                              desc: 'Vendas finalizadas no mês',
                            },
                          ].map((limItem, lIdx) => {
                            const isUnlimited =
                              limItem.limit === null || limItem.limit === undefined
                            const percent = isUnlimited
                              ? 100
                              : limItem.limit > 0
                                ? Math.min(Math.round((limItem.current / limItem.limit) * 100), 100)
                                : 0
                            const isReached =
                              !isUnlimited &&
                              limItem.limit !== null &&
                              limItem.current >= limItem.limit
                            const isWarning =
                              !isUnlimited && limItem.limit !== null && percent > 70 && !isReached

                            const badgeStatus = isReached
                              ? 'bg-rose-100 text-rose-800 border-rose-200'
                              : isWarning
                                ? 'bg-amber-100 text-amber-800 border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'

                            const barColor = isUnlimited
                              ? 'bg-emerald-500'
                              : isReached
                                ? 'bg-rose-500'
                                : isWarning
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'

                            const cardBg = isReached
                              ? 'bg-rose-50/20 border-rose-200'
                              : isWarning
                                ? 'bg-amber-50/20 border-amber-200'
                                : 'bg-slate-50/60 border-slate-200'

                            return (
                              <div
                                key={lIdx}
                                className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 transition-colors ${cardBg}`}
                              >
                                <div>
                                  <div className="flex items-start justify-between gap-1.5 mb-1.5">
                                    <span className="text-xs font-bold text-slate-900 leading-tight">
                                      {limItem.label}
                                    </span>
                                    {isReached ? (
                                      <Badge
                                        variant="outline"
                                        className={`text-[9px] px-1.5 py-0 font-bold ${badgeStatus}`}
                                      >
                                        Limite atingido
                                      </Badge>
                                    ) : isWarning ? (
                                      <Badge
                                        variant="outline"
                                        className={`text-[9px] px-1.5 py-0 font-semibold ${badgeStatus}`}
                                      >
                                        Atenção ({percent}%)
                                      </Badge>
                                    ) : null}
                                  </div>
                                  <p className="text-[11px] text-slate-500">{limItem.desc}</p>
                                </div>

                                <div>
                                  <div className="flex items-baseline justify-between text-xs mb-1.5">
                                    <span
                                      className={`text-xl font-extrabold ${
                                        isReached
                                          ? 'text-rose-700'
                                          : isWarning
                                            ? 'text-amber-700'
                                            : 'text-slate-900'
                                      }`}
                                    >
                                      {limItem.current}
                                    </span>
                                    <span className="text-slate-500 text-xs font-medium">
                                      {isUnlimited ? '/ Ilimitado' : `/ ${limItem.limit}`}
                                    </span>
                                  </div>

                                  <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden">
                                    <div
                                      className={`h-2 rounded-full transition-all duration-500 ${barColor}`}
                                      style={{ width: `${percent}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Card de Recursos Inclusos do Plano */}
                    <Card className="border border-slate-200 bg-white shadow-xs">
                      <CardHeader className="border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2 text-teal-700">
                          <Sparkles className="w-5 h-5" />
                          <CardTitle className="text-base font-bold text-slate-900">
                            Recursos do Plano
                          </CardTitle>
                        </div>
                        <CardDescription className="text-xs text-slate-500">
                          Benefícios disponíveis no plano {assinatura.planos?.nome || ''}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-4 space-y-3">
                        {(() => {
                          const recursos = Array.isArray(assinatura.planos?.recursos)
                            ? (assinatura.planos.recursos as string[])
                            : []

                          if (recursos.length === 0) {
                            return (
                              <p className="text-xs text-slate-400 italic">
                                Nenhum recurso detalhado para este plano.
                              </p>
                            )
                          }

                          return (
                            <ul className="space-y-2.5">
                              {recursos.map((rec, idx) => (
                                <li
                                  key={idx}
                                  className="flex items-start gap-2.5 text-xs text-slate-700"
                                >
                                  <div className="h-4 w-4 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center shrink-0 mt-0.5">
                                    <Check className="w-3 h-3" />
                                  </div>
                                  <span className="leading-snug">{rec}</span>
                                </li>
                              ))}
                            </ul>
                          )
                        })()}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </TabsContent>
          )}

          {/* =========================================================================
              ABA 4: SEGURANÇA
              ========================================================================= */}
          <TabsContent value="seguranca" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card Conta e Acesso */}
              <Card className="border border-slate-200 bg-white shadow-xs">
                <CardHeader className="border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 text-teal-700">
                    <UserCheck className="w-5 h-5" />
                    <CardTitle className="text-base font-bold text-slate-900">
                      Conta e Acesso
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs text-slate-500">
                    Dados da sua conta logada no sistema
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-3 text-xs">
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Nome:</span>
                    <span className="font-semibold text-slate-900">
                      {usuarioLogado?.nome || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">E-mail:</span>
                    <span className="font-mono text-slate-900">
                      {usuarioLogado?.email || user?.email || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100 items-center">
                    <span className="text-slate-500 font-medium">Perfil Atual:</span>
                    <div>
                      {(() => {
                        const b = formatPerfilBadge(usuarioLogado?.perfil)
                        return (
                          <Badge
                            variant="outline"
                            className={`font-semibold text-[10px] uppercase tracking-wider ${b.color}`}
                          >
                            {b.label}
                          </Badge>
                        )
                      })()}
                    </div>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-500 font-medium">Data de Criação:</span>
                    <span className="font-medium text-slate-700">
                      {formatDate(usuarioLogado?.created_at)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Card Sessão */}
              <Card className="border border-slate-200 bg-white shadow-xs">
                <CardHeader className="border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 text-teal-700">
                    <Lock className="w-5 h-5" />
                    <CardTitle className="text-base font-bold text-slate-900">
                      Sessão Atual
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs text-slate-500">
                    Informações de autenticação e histórico da sessão
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-3 text-xs">
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Status da Conexão:</span>
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                      Autenticado
                    </Badge>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Provedor Auth:</span>
                    <span className="font-semibold text-slate-800">
                      {user?.app_metadata?.provider || 'Email/Senha'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-500 font-medium">Último Acesso:</span>
                    <span className="font-mono text-slate-700">
                      {formatDateTime(user?.last_sign_in_at)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Card Permissões (Resumo de Papéis) */}
              <Card className="border border-slate-200 bg-white shadow-xs md:col-span-2">
                <CardHeader className="border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 text-teal-700">
                    <Shield className="w-5 h-5" />
                    <CardTitle className="text-base font-bold text-slate-900">
                      Matriz de Permissões por Perfil
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs text-slate-500">
                    Resumo dos níveis de acesso e responsabilidades configurados no EVO Gestão.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="py-3 px-4 w-40">Perfil</th>
                          <th className="py-3 px-4">Descrição de Acesso</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <tr>
                          <td className="py-3 px-4 font-semibold">
                            <Badge
                              variant="outline"
                              className="bg-purple-100 text-purple-700 border-purple-200"
                            >
                              Master
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-slate-700">
                            Acesso total ao sistema, gerenciamento de administradores e
                            configurações globais.
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-semibold">
                            <Badge
                              variant="outline"
                              className="bg-indigo-100 text-indigo-700 border-indigo-200"
                            >
                              Administrador
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-slate-700">
                            Gestão completa da empresa, exceto dados sensíveis do sistema e outros
                            usuários Master.
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-semibold">
                            <Badge
                              variant="outline"
                              className="bg-blue-100 text-blue-700 border-blue-200"
                            >
                              Gerente
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-slate-700">
                            Gestão operacional, financeiro, equipe de vendas e relatórios
                            executivos.
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-semibold">
                            <Badge
                              variant="outline"
                              className="bg-amber-100 text-amber-700 border-amber-200"
                            >
                              Operador
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-slate-700">
                            Acesso restrito a produtos (visualização) e movimentação de estoque.
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-semibold">
                            <Badge
                              variant="outline"
                              className="bg-emerald-100 text-emerald-700 border-emerald-200"
                            >
                              Vendedor
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-slate-700">
                            Emissão de vendas, pedidos e visualização da sua carteira de clientes e
                            comissões.
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* =========================================================================
            DIALOG 0: NOVO USUÁRIO
            ========================================================================= */}
        <Dialog
          open={dialogNovoUsuario}
          onOpenChange={(open) => {
            if (!open && !submittingNovoUsuario) {
              setDialogNovoUsuario(false)
              setNovoUsuarioNome('')
              setNovoUsuarioEmail('')
              setNovoUsuarioPerfil('vendedor')
              setNovoUsuarioSenha('')
            }
          }}
        >
          <DialogContent className="max-w-md w-full">
            <DialogHeader>
              <div className="flex items-center gap-2 text-teal-800">
                <Users className="w-5 h-5 text-teal-600" />
                <DialogTitle className="text-base font-bold text-slate-900">
                  Novo Usuário
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-slate-600 pt-1">
                Cadastre um novo usuário para acessar esta empresa.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Nome */}
              <div className="space-y-1.5">
                <Label htmlFor="novo-user-nome" className="text-xs font-semibold text-slate-700">
                  Nome <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="novo-user-nome"
                  placeholder="Nome completo do usuário"
                  value={novoUsuarioNome}
                  onChange={(e) => setNovoUsuarioNome(e.target.value)}
                  disabled={submittingNovoUsuario}
                  className="text-xs h-9 bg-white border-slate-200"
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="novo-user-email" className="text-xs font-semibold text-slate-700">
                  E-mail <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="novo-user-email"
                  type="email"
                  placeholder="email@empresa.com.br"
                  value={novoUsuarioEmail}
                  onChange={(e) => setNovoUsuarioEmail(e.target.value)}
                  disabled={submittingNovoUsuario}
                  className="text-xs h-9 bg-white border-slate-200"
                />
              </div>

              {/* Perfil */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Perfil <span className="text-rose-500">*</span>
                </Label>
                <Select
                  value={novoUsuarioPerfil}
                  onValueChange={setNovoUsuarioPerfil}
                  disabled={submittingNovoUsuario}
                >
                  <SelectTrigger className="text-xs h-9 bg-white border-slate-200">
                    <SelectValue placeholder="Selecione o perfil..." />
                  </SelectTrigger>
                  <SelectContent>
                    {isMaster && (
                      <SelectItem value="master" className="text-xs font-semibold text-purple-700">
                        Master (Acesso Irrestrito)
                      </SelectItem>
                    )}
                    <SelectItem value="admin" className="text-xs font-semibold text-indigo-700">
                      Administrador (Gestão Completa)
                    </SelectItem>
                    <SelectItem value="gerente" className="text-xs font-semibold text-blue-700">
                      Gerente (Operacional & Financeiro)
                    </SelectItem>
                    <SelectItem value="operador" className="text-xs font-semibold text-amber-700">
                      Operador (Estoque & Vendas)
                    </SelectItem>
                    <SelectItem value="vendedor" className="text-xs font-semibold text-emerald-700">
                      Vendedor (Vendas & Carteira)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Senha */}
              <div className="space-y-1.5">
                <Label htmlFor="novo-user-senha" className="text-xs font-semibold text-slate-700">
                  Senha Inicial <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="novo-user-senha"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={novoUsuarioSenha}
                  onChange={(e) => setNovoUsuarioSenha(e.target.value)}
                  disabled={submittingNovoUsuario}
                  className="text-xs h-9 bg-white border-slate-200"
                />
              </div>
            </div>

            <DialogFooter className="pt-2 flex gap-2">
              <Button
                variant="outline"
                type="button"
                disabled={submittingNovoUsuario}
                onClick={() => {
                  setDialogNovoUsuario(false)
                  setNovoUsuarioNome('')
                  setNovoUsuarioEmail('')
                  setNovoUsuarioPerfil('vendedor')
                  setNovoUsuarioSenha('')
                }}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={submittingNovoUsuario}
                onClick={handleCreateUsuario}
                className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center gap-1.5"
              >
                {submittingNovoUsuario ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Criar Usuário'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* =========================================================================
            DIALOG 1: TOGGLE ATIVO/INATIVO USUÁRIO
            ========================================================================= */}
        <Dialog
          open={!!dialogToggleUser}
          onOpenChange={(open) => {
            if (!open && !submittingToggle) setDialogToggleUser(null)
          }}
        >
          <DialogContent className="max-w-md w-full">
            <DialogHeader>
              <div className="flex items-center gap-2">
                {dialogToggleUser?.ativo ? (
                  <XCircle className="w-5 h-5 text-rose-600" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                )}
                <DialogTitle className="text-base font-bold text-slate-900">
                  {dialogToggleUser?.ativo
                    ? `Inativar usuário ${dialogToggleUser?.nome}?`
                    : `Ativar usuário ${dialogToggleUser?.nome}?`}
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-slate-600 pt-1 leading-relaxed">
                {dialogToggleUser?.ativo
                  ? `Inativar usuário "${dialogToggleUser?.nome}"? O usuário perderá o acesso ao sistema imediatamente.`
                  : `Ativar usuário "${dialogToggleUser?.nome}"? O usuário poderá voltar a acessar o sistema.`}
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="pt-3 flex gap-2">
              <Button
                variant="outline"
                type="button"
                disabled={submittingToggle}
                onClick={() => setDialogToggleUser(null)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={submittingToggle}
                onClick={handleConfirmToggleAtivo}
                className={
                  dialogToggleUser?.ativo
                    ? 'bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold'
                    : 'bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold'
                }
              >
                {submittingToggle ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    Processando...
                  </>
                ) : dialogToggleUser?.ativo ? (
                  'Inativar Usuário'
                ) : (
                  'Ativar Usuário'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* =========================================================================
            DIALOG 2: ALTERAR PERFIL USUÁRIO
            ========================================================================= */}
        <Dialog
          open={!!dialogPerfilUser}
          onOpenChange={(open) => {
            if (!open && !submittingPerfil) setDialogPerfilUser(null)
          }}
        >
          <DialogContent className="max-w-md w-full">
            <DialogHeader>
              <div className="flex items-center gap-2 text-teal-800">
                <Shield className="w-5 h-5 text-teal-600" />
                <DialogTitle className="text-base font-bold text-slate-900">
                  Alterar Perfil de Acesso
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-slate-600 pt-1">
                Selecione o novo nível de permissão para{' '}
                <span className="font-semibold text-slate-900">{dialogPerfilUser?.nome}</span> (
                {dialogPerfilUser?.email}).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Novo Perfil</Label>
                <Select
                  value={novoPerfilSelecionado}
                  onValueChange={setNovoPerfilSelecionado}
                  disabled={submittingPerfil}
                >
                  <SelectTrigger className="text-xs h-9 bg-white border-slate-200">
                    <SelectValue placeholder="Selecione o perfil..." />
                  </SelectTrigger>
                  <SelectContent>
                    {isMaster && (
                      <SelectItem value="master" className="text-xs font-semibold text-purple-700">
                        Master (Acesso Irrestrito)
                      </SelectItem>
                    )}
                    <SelectItem value="admin" className="text-xs font-semibold text-indigo-700">
                      Administrador (Gestão Completa)
                    </SelectItem>
                    <SelectItem value="gerente" className="text-xs font-semibold text-blue-700">
                      Gerente (Operacional & Financeiro)
                    </SelectItem>
                    <SelectItem value="operador" className="text-xs font-semibold text-amber-700">
                      Operador (Estoque & Vendas)
                    </SelectItem>
                    <SelectItem value="vendedor" className="text-xs font-semibold text-emerald-700">
                      Vendedor (Vendas & Carteira)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                <span className="font-semibold text-slate-700 block mb-1">Atenção:</span>
                Alterar o perfil modificará imediatamente as permissões e telas que o usuário poderá
                acessar no EVO Gestão.
              </div>
            </div>

            <DialogFooter className="pt-2 flex gap-2">
              <Button
                variant="outline"
                type="button"
                disabled={submittingPerfil}
                onClick={() => setDialogPerfilUser(null)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={submittingPerfil || !novoPerfilSelecionado}
                onClick={handleConfirmUpdatePerfil}
                className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center gap-1.5"
              >
                {submittingPerfil ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Novo Perfil'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
