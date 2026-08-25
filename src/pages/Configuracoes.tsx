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
      console.error('Erro ao atualizar empresa:', err)
      toast.error(err.message || 'Falha ao atualizar dados da empresa.')
    } finally {
      setSavingEmpresa(false)
    }
  }

  // =========================================================================
  // ABA 2: APARÊNCIA (Logo URL manual)
  // =========================================================================
  const [logoUrlInput, setLogoUrlInput] = useState('')
  const [savingLogo, setSavingLogo] = useState(false)

  useEffect(() => {
    if (empresa?.logo_url) {
      setLogoUrlInput(empresa.logo_url)
    }
  }, [empresa?.logo_url])

  const handleSalvarLogoUrl = async () => {
    if (!empresaId) return
    if (!isMasterOrAdmin) {
      toast.error('Você não tem permissão para alterar a logo.')
      return
    }

    setSavingLogo(true)
    try {
      const { error } = await ConfiguracoesService.updateEmpresa(empresaId, {
        logo_url: logoUrlInput.trim() || undefined,
      })
      if (error) throw error
      toast.success('URL da logo atualizada com sucesso.')
      await refreshEmpresa()
    } catch (err: any) {
      console.error('Erro ao salvar URL da logo:', err)
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
      const filterOpts = {
        search: debouncedSearchUsuario,
        perfil: perfilFilter,
        status: statusFilter,
        page,
        pageSize: PAGE_SIZE,
      }

      const [listRes, countRes] = await Promise.all([
        ConfiguracoesService.listUsuariosEmpresa(empresaId, filterOpts),
        ConfiguracoesService.countUsuariosEmpresa(empresaId, {
          search: debouncedSearchUsuario,
          perfil: perfilFilter,
          status: statusFilter,
        }),
      ])

      if (listRes.error) throw listRes.error
      if (countRes.error) throw countRes.error

      setUsuarios((listRes.data as UsuarioType[]) || [])
      setTotalUsuarios(countRes.count || 0)
    } catch (err: any) {
      console.error('Erro ao carregar usuários:', err)
      setErrorUsuarios(err.message || 'Falha ao carregar lista de usuários.')
    } finally {
      setLoadingUsuarios(false)
    }
  }, [empresaId, debouncedSearchUsuario, perfilFilter, statusFilter, page])

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
    // Validações frontend
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
      // Limpar formulário
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
      console.error('Erro ao alterar status do usuário:', err)
      toast.error(err.message || 'Falha ao alterar status do usuário.')
    } finally {
      setSubmittingToggle(false)
    }
  }

  const handleOpenDialogPerfil = (targetUser: UsuarioType) => {
    // Regras de proteção:
    // 1. Não permitir alterar o próprio perfil
    if (targetUser.id === usuarioLogado?.id) {
      toast.error('Você não pode alterar o seu próprio perfil.')
      return
    }
    // 2. Não permitir que admin altere perfil de um master
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
      console.error('Erro ao alterar perfil:', err)
      toast.error(err.message || 'Falha ao alterar perfil do usuário.')
    } finally {
      setSubmittingPerfil(false)
    }
  }

  // Formatador de data
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
          <TabsList className="bg-slate-100 p-1 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 w-full sm:w-auto h-auto gap-1">
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
                    <Label className="text-xs font-semibold text-slate-700 block mb-2">
                      Preview da Logo
                    </Label>
                    <div className="w-full h-36 rounded-xl border border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center p-4">
                      {empresa?.logo_url ? (
                        <img
                          src={empresa.logo_url}
                          alt="Logo da Empresa"
                          className="max-h-28 max-w-full object-contain rounded"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            ;(e.currentTarget as HTMLElement).style.display = 'none'
                          }}
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-slate-400">
                          <Building2 className="w-8 h-8 text-slate-300" />
                          <span className="text-xs font-medium">Nenhuma logo cadastrada</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Input de URL manual */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="logo-url-input"
                      className="text-xs font-semibold text-slate-700"
                    >
                      URL da Logo (Link Externo)
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="logo-url-input"
                        type="url"
                        value={logoUrlInput}
                        onChange={(e) => setLogoUrlInput(e.target.value)}
                        placeholder="https://exemplo.com/logo.png"
                        disabled={!isMasterOrAdmin || savingLogo}
                        className="text-xs h-9 bg-white border-slate-200"
                      />
                      <Button
                        type="button"
                        onClick={handleSalvarLogoUrl}
                        disabled={!isMasterOrAdmin || savingLogo}
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

                  {/* Botão Alterar Logo (Disabled com Tooltip) */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500">Upload direto de arquivo:</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span tabIndex={0}>
                          <Button
                            type="button"
                            variant="outline"
                            disabled
                            className="text-xs h-8 cursor-not-allowed opacity-60"
                          >
                            Alterar Logo
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">
                          Funcionalidade disponível em breve. O upload de logo requer configuração
                          do Storage.
                        </p>
                      </TooltipContent>
                    </Tooltip>
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
                          <SelectItem value="master" className="text-xs">
                            Master
                          </SelectItem>
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
                            Operações de vendas, compras, cadastro de parceiros e movimentação de
                            estoque.
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
