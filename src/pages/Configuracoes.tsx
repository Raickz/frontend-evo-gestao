import React, { useState, useEffect, useCallback } from 'react'
import {
  PageHeader,
  TableSkeleton,
  ErrorState,
  EmptyState,
  AnimatedNumber,
  GlassCard,
  GlassCardHeader,
  GlassCardContent,
  GlassPanel,
  GlassTable,
  GlassTableHeader,
  GlassTableRow,
  GlassTableCell,
  GlassTableHead,
  GlassButton,
  GlassBadge,
  GlassPagination,
  glassInputClass,
  glassSelectTriggerClass,
  glassSelectContentClass,
} from '@/components/common/CommonUI'
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
  AlertTriangle,
  QrCode,
  ArrowRight,
  Receipt,
} from 'lucide-react'
const PAGE_SIZE = 20

export default function ConfiguracoesPage() {
  const { empresaId, empresa, refreshEmpresa } = useEmpresa()
  const { user, usuario: usuarioLogado } = useAuth()

  const perfilLogado = (usuarioLogado?.perfil || '').toLowerCase()
  const isMasterOrAdmin = perfilLogado === 'master' || perfilLogado === 'admin'
  const isMaster = perfilLogado === 'master'

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
            className={`bg-slate-100/80 dark:bg-[#0A1328]/80 p-1 border border-slate-200/80 dark:border-[#1A294A] rounded-2xl grid ${
              isMasterOrAdmin ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4'
            } w-full sm:w-auto h-auto gap-1`}
          >
            <TabsTrigger
              value="empresa"
              className="flex items-center gap-2 text-xs font-semibold py-2 rounded-xl data-[state=active]:bg-[#0066FF] data-[state=active]:text-white data-[state=active]:shadow-xs"
            >
              <Building2 className="w-4 h-4" />
              <span>Empresa</span>
            </TabsTrigger>

            <TabsTrigger
              value="aparencia"
              className="flex items-center gap-2 text-xs font-semibold py-2 rounded-xl data-[state=active]:bg-[#0066FF] data-[state=active]:text-white data-[state=active]:shadow-xs"
            >
              <Palette className="w-4 h-4" />
              <span>Aparência</span>
            </TabsTrigger>

            <TabsTrigger
              value="usuarios"
              className="flex items-center gap-2 text-xs font-semibold py-2 rounded-xl data-[state=active]:bg-[#0066FF] data-[state=active]:text-white data-[state=active]:shadow-xs"
            >
              <Users className="w-4 h-4" />
              <span>Usuários</span>
            </TabsTrigger>

            <TabsTrigger
              value="seguranca"
              className="flex items-center gap-2 text-xs font-semibold py-2 rounded-xl data-[state=active]:bg-[#0066FF] data-[state=active]:text-white data-[state=active]:shadow-xs"
            >
              <Shield className="w-4 h-4" />
              <span>Segurança</span>
            </TabsTrigger>
          </TabsList>
          {/* =========================================================================
              ABA 1: DADOS DA EMPRESA
              ========================================================================= */}
          <TabsContent value="empresa" className="space-y-6">
            <Card className="glass-card rounded-2xl border border-slate-200/80 dark:border-[#1A294A] bg-white/70 dark:bg-[#0A1328]/60">
              <CardHeader className="border-b border-slate-100 dark:border-[#1A294A] pb-4">
                <div className="flex items-center gap-2 text-[#0066FF] dark:text-[#3B82F6]">
                  <Building2 className="w-5 h-5" />
                  <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                    Dados Cadastrais da Empresa
                  </CardTitle>
                </div>
                <CardDescription className="text-xs text-slate-500 dark:text-[#C0C6CF]">
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
                        className="text-xs font-semibold text-slate-700 dark:text-slate-300"
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
                        className={glassInputClass}
                      />
                    </div>

                    {/* Nome Fantasia */}
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="empresa-fantasia"
                        className="text-xs font-semibold text-slate-700 dark:text-slate-300"
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
                        className={glassInputClass}
                      />
                    </div>

                    {/* CNPJ */}
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="empresa-cnpj"
                        className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                      >
                        CNPJ
                      </Label>
                      <Input
                        id="empresa-cnpj"
                        value={empresaForm.cnpj}
                        onChange={(e) => setEmpresaForm({ ...empresaForm, cnpj: e.target.value })}
                        placeholder="00.000.000/0000-00"
                        disabled={!isMasterOrAdmin || savingEmpresa}
                        className={`${glassInputClass} font-mono`}
                      />
                    </div>

                    {/* Email de Contato */}
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="empresa-email"
                        className="text-xs font-semibold text-slate-700 dark:text-slate-300"
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
                        className={glassInputClass}
                      />
                    </div>

                    {/* Telefone */}
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="empresa-telefone"
                        className="text-xs font-semibold text-slate-700 dark:text-slate-300"
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
                        className={glassInputClass}
                      />
                    </div>
                  </div>

                  {/* Informações adicionais do sistema (somente leitura) */}
                  <div className="p-3 bg-slate-50 dark:bg-[#0A1328]/80 rounded-xl border border-slate-200/80 dark:border-[#1A294A] text-xs flex flex-wrap items-center justify-between gap-3 text-slate-600 dark:text-[#C0C6CF]">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Status da Conta:
                      </span>
                      <GlassBadge variant="green">{empresa?.status || 'Ativo'}</GlassBadge>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-[#C0C6CF]/70">Cadastrada em: </span>
                      <span className="font-medium text-slate-700 dark:text-slate-200">
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
                        className="bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-semibold flex items-center gap-2 shadow-sm h-10 px-5 rounded-xl cursor-pointer"
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
                    <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 flex items-center gap-2">
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
              <Card className="glass-card rounded-2xl border border-slate-200/80 dark:border-[#1A294A] bg-white/70 dark:bg-[#0A1328]/60">
                <CardHeader className="border-b border-slate-100 dark:border-[#1A294A] pb-3">
                  <div className="flex items-center gap-2 text-[#0066FF] dark:text-[#3B82F6]">
                    <ImageIcon className="w-5 h-5" />
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                      Identidade Visual
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs text-slate-500 dark:text-[#C0C6CF]">
                    Logo e identidade da empresa exibidas na barra superior e relatórios.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-5 space-y-5">
                  {/* Preview da Logo */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                        Preview da Logo
                      </Label>
                      {selectedLogoFile && (
                        <GlassBadge variant="blue">Novo arquivo selecionado</GlassBadge>
                      )}
                    </div>
                    <div className="w-full h-40 rounded-xl border border-dashed border-slate-200 dark:border-[#1A294A] bg-slate-50 dark:bg-[#0A1328]/80 flex flex-col items-center justify-center p-4 overflow-hidden relative group">
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
                        <div className="flex flex-col items-center gap-2 text-slate-400 dark:text-slate-500">
                          <Building2 className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                          <span className="text-xs font-medium">Nenhuma logo cadastrada</span>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500">
                            JPG, PNG ou WebP até 5 MB
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Upload direto de arquivo */}
                  <div className="space-y-3 pt-1 border-t border-slate-100 dark:border-[#1A294A]">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Upload de Logo (Supabase Storage)
                      </Label>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">
                        Máx. 5 MB
                      </span>
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
                          className="text-xs h-10 rounded-xl cursor-pointer border-slate-200 dark:border-[#1A294A] hover:bg-slate-50 dark:hover:bg-[#1A294A]"
                        >
                          <span>
                            <Upload className="w-3.5 h-3.5 mr-1.5 text-slate-600 dark:text-slate-400" />
                            {selectedLogoFile ? 'Trocar Arquivo' : 'Selecionar Arquivo'}
                          </span>
                        </Button>
                      </label>

                      {selectedLogoFile && (
                        <Button
                          type="button"
                          onClick={handleUploadLogo}
                          disabled={!isMasterOrAdmin || uploadingLogo || removingLogo}
                          className="bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs h-10 px-4 rounded-xl font-medium shadow-sm cursor-pointer"
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
                          className="text-xs h-10 rounded-xl border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950 cursor-pointer"
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
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        Selecionado:{' '}
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          {selectedLogoFile.name}
                        </span>{' '}
                        ({(selectedLogoFile.size / 1024).toFixed(1)} KB)
                      </p>
                    )}
                  </div>

                  {/* Input de URL manual */}
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-[#1A294A]">
                    <Label
                      htmlFor="logo-url-input"
                      className="text-xs font-semibold text-slate-700 dark:text-slate-300"
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
                        className={glassInputClass}
                      />
                      <Button
                        type="button"
                        onClick={handleSalvarLogoUrl}
                        disabled={!isMasterOrAdmin || savingLogo || uploadingLogo || removingLogo}
                        className="bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs h-10 rounded-xl px-4 shrink-0 font-medium cursor-pointer shadow-sm"
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
              <Card className="glass-card rounded-2xl border border-slate-200/80 dark:border-[#1A294A] bg-white/70 dark:bg-[#0A1328]/60">
                <CardHeader className="border-b border-slate-100 dark:border-[#1A294A] pb-3">
                  <div className="flex items-center gap-2 text-[#0066FF] dark:text-[#3B82F6]">
                    <Palette className="w-5 h-5" />
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                      Cores e Tema
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs text-slate-500 dark:text-[#C0C6CF]">
                    Personalização do esquema de cores e layout do painel.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="p-8 rounded-xl border border-dashed border-slate-200 dark:border-[#1A294A] bg-slate-50 dark:bg-[#0A1328]/80 text-center space-y-2">
                    <Palette className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Personalização do Design System EVO
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm mx-auto leading-relaxed">
                      O EVO Gestão conta com alternador Dark / Light integrado na barra superior,
                      paleta corporativa Dark Glass (#0066FF / #0A1328) e máxima fidelidade visual.
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
            <Card className="glass-card rounded-2xl border border-slate-200/80 dark:border-[#1A294A] bg-white/70 dark:bg-[#0A1328]/60">
              <CardHeader className="border-b border-slate-100 dark:border-[#1A294A] pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2 text-[#0066FF] dark:text-[#3B82F6]">
                    <Users className="w-5 h-5" />
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                          Usuários da Empresa
                        </CardTitle>
                        <GlassBadge variant="blue">
                          {totalUsuarios} {totalUsuarios === 1 ? 'usuário' : 'usuários'}
                        </GlassBadge>
                      </div>
                      <CardDescription className="text-xs text-slate-500 dark:text-[#C0C6CF] mt-0.5">
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
                        className="bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs h-10 px-4 rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
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
                <div className="p-3 bg-slate-50/70 dark:bg-[#0A1328]/70 rounded-xl border border-slate-200/80 dark:border-[#1A294A] space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3 items-center">
                    {/* Input de Busca */}
                    <div className="sm:col-span-2 relative">
                      <Search className="w-4 h-4 text-[#0066FF] dark:text-[#3B82F6] absolute left-3 top-1/2 -translate-y-1/2" />
                      <Input
                        placeholder="Buscar por nome ou e-mail..."
                        value={searchUsuario}
                        onChange={(e) => setSearchUsuario(e.target.value)}
                        className={`pl-9 ${glassInputClass}`}
                      />
                      {searchUsuario && (
                        <button
                          type="button"
                          onClick={() => setSearchUsuario('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
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
                        <SelectTrigger className={glassSelectTriggerClass}>
                          <SelectValue placeholder="Perfil" />
                        </SelectTrigger>
                        <SelectContent className={glassSelectContentClass}>
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
                        <SelectTrigger className={glassSelectTriggerClass}>
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent className={glassSelectContentClass}>
                          <SelectItem value="todos" className="text-xs">
                            Todos os status
                          </SelectItem>
                          <SelectItem
                            value="ativo"
                            className="text-xs text-emerald-600 dark:text-emerald-400 font-medium"
                          >
                            Ativos
                          </SelectItem>
                          <SelectItem
                            value="inativo"
                            className="text-xs text-rose-600 dark:text-rose-400 font-medium"
                          >
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
                        className="text-xs text-slate-600 dark:text-[#C0C6CF] hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 h-7 cursor-pointer"
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
                  <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-[#1A294A] overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-600 dark:text-[#C0C6CF]">
                        <thead className="bg-slate-50/80 dark:bg-[#0A1328]/80 border-b border-slate-200/80 dark:border-[#1A294A] text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          <tr>
                            <th className="py-3.5 px-4">Nome</th>
                            <th className="py-3.5 px-4">E-mail</th>
                            <th className="py-3.5 px-4">Telefone</th>
                            <th className="py-3.5 px-4">Perfil</th>
                            <th className="py-3.5 px-4 text-center">Status</th>
                            <th className="py-3.5 px-4">Criado em</th>
                            <th className="py-3.5 px-4 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-[#1A294A]/60">
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
                              <tr
                                key={usr.id}
                                className="hover:bg-slate-50/70 dark:hover:bg-white/[0.03] transition-colors"
                              >
                                <td className="py-3 px-4">
                                  <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                                    {usr.nome}
                                    {isSelf && (
                                      <GlassBadge variant="blue" className="text-[9px] py-0">
                                        Você
                                      </GlassBadge>
                                    )}
                                  </div>
                                </td>

                                <td className="py-3 px-4 font-mono text-slate-600 dark:text-[#C0C6CF]">
                                  {usr.email}
                                </td>

                                <td className="py-3 px-4 text-slate-600 dark:text-[#C0C6CF]">
                                  {usr.telefone || '-'}
                                </td>

                                <td className="py-3 px-4">
                                  <Badge
                                    variant="outline"
                                    className={`font-semibold text-[10px] uppercase tracking-wider ${badgeInfo.color}`}
                                  >
                                    {badgeInfo.label}
                                  </Badge>
                                </td>

                                <td className="py-3 px-4 text-center">
                                  <GlassBadge variant={usr.ativo ? 'green' : 'red'}>
                                    {usr.ativo ? 'Ativo' : 'Inativo'}
                                  </GlassBadge>
                                </td>

                                <td className="py-3 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
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
                                        className="h-7 text-[11px] px-2 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#1A294A] hover:bg-slate-50 dark:hover:bg-[#1A294A] cursor-pointer"
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
                                        className={`h-7 text-[11px] px-2 flex items-center gap-1 cursor-pointer ${
                                          usr.ativo
                                            ? 'text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950'
                                            : 'text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50 hover:bg-emerald-50 dark:hover:bg-emerald-950'
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
                    <GlassPagination
                      currentPage={page}
                      totalPages={totalPaginasUsuarios}
                      totalItems={totalUsuarios}
                      pageSize={PAGE_SIZE}
                      onPageChange={setPage}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          {/* =========================================================================
              ABA 4: SEGURANÇA
              ========================================================================= */}
          <TabsContent value="seguranca" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card Conta e Acesso */}
              <Card className="glass-card rounded-2xl border border-slate-200/80 dark:border-[#1A294A] bg-white/70 dark:bg-[#0A1328]/60">
                <CardHeader className="border-b border-slate-100 dark:border-[#1A294A] pb-3">
                  <div className="flex items-center gap-2 text-[#0066FF] dark:text-[#3B82F6]">
                    <Key className="w-5 h-5" />
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                      Conta e Acesso
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs text-slate-500 dark:text-[#C0C6CF]">
                    Informações do usuário atualmente conectado ao sistema
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-3 text-xs">
                  <div className="flex justify-between py-2 border-b border-slate-100 dark:border-[#1A294A]/60">
                    <span className="text-slate-500 dark:text-[#C0C6CF]/70 font-medium">
                      Nome do Usuário:
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {usuarioLogado?.nome || 'Usuário'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100 dark:border-[#1A294A]/60">
                    <span className="text-slate-500 dark:text-[#C0C6CF]/70 font-medium">
                      E-mail:
                    </span>
                    <span className="font-mono text-slate-900 dark:text-white">
                      {usuarioLogado?.email || user?.email || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100 dark:border-[#1A294A]/60 items-center">
                    <span className="text-slate-500 dark:text-[#C0C6CF]/70 font-medium">
                      Perfil Atual:
                    </span>
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
                    <span className="text-slate-500 dark:text-[#C0C6CF]/70 font-medium">
                      Data de Criação:
                    </span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {formatDate(usuarioLogado?.created_at)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Card Sessão */}
              <Card className="glass-card rounded-2xl border border-slate-200/80 dark:border-[#1A294A] bg-white/70 dark:bg-[#0A1328]/60">
                <CardHeader className="border-b border-slate-100 dark:border-[#1A294A] pb-3">
                  <div className="flex items-center gap-2 text-[#0066FF] dark:text-[#3B82F6]">
                    <Lock className="w-5 h-5" />
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                      Sessão Atual
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs text-slate-500 dark:text-[#C0C6CF]">
                    Informações de autenticação e histórico da sessão
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-3 text-xs">
                  <div className="flex justify-between py-2 border-b border-slate-100 dark:border-[#1A294A]/60">
                    <span className="text-slate-500 dark:text-[#C0C6CF]/70 font-medium">
                      Status da Conexão:
                    </span>
                    <GlassBadge variant="green">Autenticado</GlassBadge>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100 dark:border-[#1A294A]/60">
                    <span className="text-slate-500 dark:text-[#C0C6CF]/70 font-medium">
                      Provedor Auth:
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {user?.app_metadata?.provider || 'Email/Senha'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-500 dark:text-[#C0C6CF]/70 font-medium">
                      Último Acesso:
                    </span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      {formatDateTime(user?.last_sign_in_at)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Card Permissões (Resumo de Papéis) */}
              <Card className="glass-card rounded-2xl border border-slate-200/80 dark:border-[#1A294A] bg-white/70 dark:bg-[#0A1328]/60 md:col-span-2">
                <CardHeader className="border-b border-slate-100 dark:border-[#1A294A] pb-3">
                  <div className="flex items-center gap-2 text-[#0066FF] dark:text-[#3B82F6]">
                    <Shield className="w-5 h-5" />
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                      Matriz de Permissões por Perfil
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs text-slate-500 dark:text-[#C0C6CF]">
                    Resumo dos níveis de acesso e responsabilidades configurados no EVO Gestão.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-600 dark:text-[#C0C6CF]">
                      <thead className="bg-slate-50/80 dark:bg-[#0A1328]/80 border-b border-slate-200/80 dark:border-[#1A294A] text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        <tr>
                          <th className="py-3.5 px-4 w-40">Perfil</th>
                          <th className="py-3.5 px-4">Descrição de Acesso</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-[#1A294A]/60">
                        <tr>
                          <td className="py-3 px-4 font-semibold">
                            <Badge
                              variant="outline"
                              className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                            >
                              Master
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                            Acesso total ao sistema, gerenciamento de administradores e
                            configurações globais.
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-semibold">
                            <Badge
                              variant="outline"
                              className="bg-[#0066FF]/10 text-[#0066FF] dark:text-[#3B82F6] border-[#0066FF]/20"
                            >
                              Administrador
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                            Gestão completa da empresa, exceto dados sensíveis do sistema e outros
                            usuários Master.
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-semibold">
                            <Badge
                              variant="outline"
                              className="bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20"
                            >
                              Gerente
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                            Gestão operacional, financeiro, equipe de vendas e relatórios
                            executivos.
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-semibold">
                            <Badge
                              variant="outline"
                              className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                            >
                              Operador
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                            Acesso restrito a produtos (visualização) e movimentação de estoque.
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-semibold">
                            <Badge
                              variant="outline"
                              className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            >
                              Vendedor
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
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
          </TabsContent>{' '}
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
          <DialogContent className="max-w-md w-full border border-slate-200/80 dark:border-[#1A294A] bg-white dark:bg-[#0A1328] shadow-2xl rounded-2xl">
            <DialogHeader className="border-b border-slate-100 dark:border-[#1A294A] pb-3">
              <div className="flex items-center gap-2 text-[#0066FF] dark:text-[#3B82F6]">
                <Users className="w-5 h-5" />
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
                  Novo Usuário
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-slate-500 dark:text-[#C0C6CF] pt-1">
                Cadastre um novo usuário para acessar esta empresa.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Nome */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="novo-user-nome"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Nome <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="novo-user-nome"
                  placeholder="Nome completo do usuário"
                  value={novoUsuarioNome}
                  onChange={(e) => setNovoUsuarioNome(e.target.value)}
                  disabled={submittingNovoUsuario}
                  className={glassInputClass}
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="novo-user-email"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  E-mail <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="novo-user-email"
                  type="email"
                  placeholder="email@empresa.com.br"
                  value={novoUsuarioEmail}
                  onChange={(e) => setNovoUsuarioEmail(e.target.value)}
                  disabled={submittingNovoUsuario}
                  className={glassInputClass}
                />
              </div>

              {/* Perfil */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Perfil <span className="text-rose-500">*</span>
                </Label>
                <Select
                  value={novoUsuarioPerfil}
                  onValueChange={setNovoUsuarioPerfil}
                  disabled={submittingNovoUsuario}
                >
                  <SelectTrigger className={glassSelectTriggerClass}>
                    <SelectValue placeholder="Selecione o perfil..." />
                  </SelectTrigger>
                  <SelectContent className={glassSelectContentClass}>
                    {isMaster && (
                      <SelectItem
                        value="master"
                        className="text-xs font-semibold text-purple-600 dark:text-purple-400"
                      >
                        Master (Acesso Irrestrito)
                      </SelectItem>
                    )}
                    <SelectItem
                      value="admin"
                      className="text-xs font-semibold text-[#0066FF] dark:text-[#3B82F6]"
                    >
                      Administrador (Gestão Completa)
                    </SelectItem>
                    <SelectItem
                      value="gerente"
                      className="text-xs font-semibold text-sky-600 dark:text-sky-400"
                    >
                      Gerente (Operacional & Financeiro)
                    </SelectItem>
                    <SelectItem
                      value="operador"
                      className="text-xs font-semibold text-amber-600 dark:text-amber-400"
                    >
                      Operador (Estoque & Vendas)
                    </SelectItem>
                    <SelectItem
                      value="vendedor"
                      className="text-xs font-semibold text-emerald-600 dark:text-emerald-400"
                    >
                      Vendedor (Vendas & Carteira)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Senha */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="novo-user-senha"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Senha Inicial <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="novo-user-senha"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={novoUsuarioSenha}
                  onChange={(e) => setNovoUsuarioSenha(e.target.value)}
                  disabled={submittingNovoUsuario}
                  className={glassInputClass}
                />
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-slate-100 dark:border-[#1A294A] flex gap-2">
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
                className="text-xs rounded-xl border-slate-200 dark:border-[#1A294A] cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={submittingNovoUsuario}
                onClick={handleCreateUsuario}
                className="bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm"
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
          <DialogContent className="max-w-md w-full border border-slate-200/80 dark:border-[#1A294A] bg-white dark:bg-[#0A1328] shadow-2xl rounded-2xl">
            <DialogHeader className="border-b border-slate-100 dark:border-[#1A294A] pb-3">
              <div className="flex items-center gap-2">
                {dialogToggleUser?.ativo ? (
                  <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                )}
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
                  {dialogToggleUser?.ativo
                    ? `Inativar usuário ${dialogToggleUser?.nome}?`
                    : `Ativar usuário ${dialogToggleUser?.nome}?`}
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-slate-500 dark:text-[#C0C6CF] pt-1 leading-relaxed">
                {dialogToggleUser?.ativo
                  ? `Inativar usuário "${dialogToggleUser?.nome}"? O usuário perderá o acesso ao sistema imediatamente.`
                  : `Ativar usuário "${dialogToggleUser?.nome}"? O usuário poderá voltar a acessar o sistema.`}
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="pt-3 border-t border-slate-100 dark:border-[#1A294A] flex gap-2">
              <Button
                variant="outline"
                type="button"
                disabled={submittingToggle}
                onClick={() => setDialogToggleUser(null)}
                className="text-xs rounded-xl border-slate-200 dark:border-[#1A294A] cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={submittingToggle}
                onClick={handleConfirmToggleAtivo}
                className={`text-white text-xs font-bold rounded-xl cursor-pointer shadow-sm ${
                  dialogToggleUser?.ativo
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
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
          <DialogContent className="max-w-md w-full border border-slate-200/80 dark:border-[#1A294A] bg-white dark:bg-[#0A1328] shadow-2xl rounded-2xl">
            <DialogHeader className="border-b border-slate-100 dark:border-[#1A294A] pb-3">
              <div className="flex items-center gap-2 text-[#0066FF] dark:text-[#3B82F6]">
                <Shield className="w-5 h-5" />
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
                  Alterar Perfil de Acesso
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-slate-500 dark:text-[#C0C6CF] pt-1">
                Selecione o novo nível de permissão para{' '}
                <span className="font-semibold text-slate-900 dark:text-white">
                  {dialogPerfilUser?.nome}
                </span>{' '}
                ({dialogPerfilUser?.email}).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Novo Perfil
                </Label>
                <Select
                  value={novoPerfilSelecionado}
                  onValueChange={setNovoPerfilSelecionado}
                  disabled={submittingPerfil}
                >
                  <SelectTrigger className={glassSelectTriggerClass}>
                    <SelectValue placeholder="Selecione o perfil..." />
                  </SelectTrigger>
                  <SelectContent className={glassSelectContentClass}>
                    {isMaster && (
                      <SelectItem
                        value="master"
                        className="text-xs font-semibold text-purple-600 dark:text-purple-400"
                      >
                        Master (Acesso Irrestrito)
                      </SelectItem>
                    )}
                    <SelectItem
                      value="admin"
                      className="text-xs font-semibold text-[#0066FF] dark:text-[#3B82F6]"
                    >
                      Administrador (Gestão Completa)
                    </SelectItem>
                    <SelectItem
                      value="gerente"
                      className="text-xs font-semibold text-sky-600 dark:text-sky-400"
                    >
                      Gerente (Operacional & Financeiro)
                    </SelectItem>
                    <SelectItem
                      value="operador"
                      className="text-xs font-semibold text-amber-600 dark:text-amber-400"
                    >
                      Operador (Estoque & Vendas)
                    </SelectItem>
                    <SelectItem
                      value="vendedor"
                      className="text-xs font-semibold text-emerald-600 dark:text-emerald-400"
                    >
                      Vendedor (Vendas & Carteira)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-[#0A1328]/80 border border-slate-200/80 dark:border-[#1A294A] rounded-xl text-xs text-slate-600 dark:text-[#C0C6CF]">
                <span className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                  Atenção:
                </span>
                Alterar o perfil modificará imediatamente as permissões e telas que o usuário poderá
                acessar no EVO Gestão.
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-slate-100 dark:border-[#1A294A] flex gap-2">
              <Button
                variant="outline"
                type="button"
                disabled={submittingPerfil}
                onClick={() => setDialogPerfilUser(null)}
                className="text-xs rounded-xl border-slate-200 dark:border-[#1A294A] cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={submittingPerfil || !novoPerfilSelecionado}
                onClick={handleConfirmUpdatePerfil}
                className="bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm"
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
