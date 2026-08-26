import { useState, useEffect, useMemo } from 'react'
import {
  Building2,
  Search,
  Filter,
  ShieldCheck,
  ShieldAlert,
  Edit3,
  Lock,
  Unlock,
  MoreVertical,
  Calendar,
  Users,
  CircleDollarSign,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Info,
} from 'lucide-react'
import { AdminService, AdminEmpresaItem, AdminPlanoItem } from '@/services/admin'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

export default function AdminEmpresasPage() {
  const [empresas, setEmpresas] = useState<AdminEmpresaItem[]>([])
  const [planos, setPlanos] = useState<AdminPlanoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')

  // Modais de Ação
  const [detalhesEmpresa, setDetalhesEmpresa] = useState<AdminEmpresaItem | null>(null)
  const [alterarPlanoEmpresa, setAlterarPlanoEmpresa] = useState<AdminEmpresaItem | null>(null)
  const [selectedNovoPlano, setSelectedNovoPlano] = useState<string>('')
  const [submittingPlano, setSubmittingPlano] = useState(false)

  const [bloquearTarget, setBloquearTarget] = useState<AdminEmpresaItem | null>(null)
  const [desbloquearTarget, setDesbloquearTarget] = useState<AdminEmpresaItem | null>(null)
  const [submittingStatus, setSubmittingStatus] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const [empRes, planRes] = await Promise.all([
        AdminService.listarEmpresas(),
        AdminService.listarPlanosAdmin(),
      ])

      if (empRes.error) throw empRes.error
      if (planRes.error) throw planRes.error

      setEmpresas(empRes.data)
      setPlanos(planRes.data)
    } catch (err: any) {
      toast.error('Erro ao carregar dados de empresas: ' + (err?.message || 'Falha na requisição.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Filtros
  const filteredEmpresas = useMemo(() => {
    return empresas.filter((item) => {
      const q = search.toLowerCase().trim()
      const matchesSearch =
        !q ||
        item.nome.toLowerCase().includes(q) ||
        (item.nome_fantasia && item.nome_fantasia.toLowerCase().includes(q)) ||
        (item.cnpj && item.cnpj.includes(q)) ||
        (item.email && item.email.toLowerCase().includes(q))

      const statusAssinatura = (item.status_assinatura || 'sem_assinatura').toLowerCase()
      const matchesStatus =
        statusFilter === 'todos' ||
        (statusFilter === 'ativa' && statusAssinatura === 'ativa') ||
        (statusFilter === 'trial' && statusAssinatura === 'trial') ||
        (statusFilter === 'atrasada' && statusAssinatura === 'atrasada') ||
        (statusFilter === 'cancelada' && statusAssinatura === 'cancelada') ||
        (statusFilter === 'bloqueada' && statusAssinatura === 'bloqueada')

      return matchesSearch && matchesStatus
    })
  }, [empresas, search, statusFilter])

  const formatCurrency = (val: number | null) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val || 0)
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    const [year, month, day] = dateStr.split('-')
    return `${day}/${month}/${year}`
  }

  const getStatusBadge = (status: string | null) => {
    const s = (status || '').toLowerCase()
    switch (s) {
      case 'ativa':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs font-semibold gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Ativa
          </Badge>
        )
      case 'trial':
        return (
          <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/40 text-xs font-semibold gap-1">
            <Clock className="w-3 h-3" />
            Trial
          </Badge>
        )
      case 'atrasada':
        return (
          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs font-semibold gap-1">
            <AlertTriangle className="w-3 h-3" />
            Atrasada
          </Badge>
        )
      case 'cancelada':
        return (
          <Badge className="bg-slate-700 text-slate-300 border-slate-600 text-xs font-semibold gap-1">
            <XCircle className="w-3 h-3" />
            Cancelada
          </Badge>
        )
      case 'bloqueada':
        return (
          <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-xs font-semibold gap-1">
            <ShieldAlert className="w-3 h-3" />
            Bloqueada
          </Badge>
        )
      default:
        return (
          <Badge className="bg-slate-800 text-slate-400 border-slate-700 text-xs font-semibold">
            Sem Assinatura
          </Badge>
        )
    }
  }

  const handleConfirmAlterarPlano = async () => {
    if (!alterarPlanoEmpresa || !selectedNovoPlano) {
      toast.error('Selecione um plano válido.')
      return
    }

    try {
      setSubmittingPlano(true)
      const { data: res, error } = await AdminService.alterarPlanoEmpresa(
        alterarPlanoEmpresa.id,
        selectedNovoPlano,
      )

      if (error) throw error

      toast.success(res?.message || 'Plano alterado com sucesso pelo administrador!')
      setAlterarPlanoEmpresa(null)
      loadData()
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao alterar plano da empresa.')
    } finally {
      setSubmittingPlano(false)
    }
  }

  const handleConfirmBloquear = async () => {
    if (!bloquearTarget) return

    try {
      setSubmittingStatus(true)
      const { data: res, error } = await AdminService.bloquearEmpresa(bloquearTarget.id)
      if (error) throw error

      toast.success(res?.message || 'Empresa bloqueada com sucesso.')
      setBloquearTarget(null)
      loadData()
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao bloquear empresa.')
    } finally {
      setSubmittingStatus(false)
    }
  }

  const handleConfirmDesbloquear = async () => {
    if (!desbloquearTarget) return

    try {
      setSubmittingStatus(true)
      const { data: res, error } = await AdminService.desbloquearEmpresa(desbloquearTarget.id)
      if (error) throw error

      toast.success(res?.message || 'Empresa desbloqueada com sucesso.')
      setDesbloquearTarget(null)
      loadData()
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao desbloquear empresa.')
    } finally {
      setSubmittingStatus(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black tracking-tight text-white">Empresas Cadastradas</h2>
            <Badge className="bg-sky-500/20 text-sky-400 border-sky-500/40 text-xs font-semibold">
              {empresas.length} Total
            </Badge>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Gestão completa de distribuidoras clientes, planos, controle de acesso e bloqueio
            administrativo.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={loading}
          className="bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-200"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin text-sky-400' : ''}`} />
          Atualizar Tabela
        </Button>
      </div>

      {/* Barra de Busca e Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar por Razão Social, Fantasia, CNPJ ou E-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-slate-900/90 border-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-sky-500"
          />
        </div>

        <div className="w-full sm:w-56">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="bg-slate-900/90 border-slate-800 text-slate-200">
              <Filter className="w-4 h-4 mr-2 text-slate-400" />
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
              <SelectItem value="todos">Todos os Status</SelectItem>
              <SelectItem value="ativa">Ativas</SelectItem>
              <SelectItem value="trial">Em Trial</SelectItem>
              <SelectItem value="atrasada">Atrasadas</SelectItem>
              <SelectItem value="cancelada">Canceladas</SelectItem>
              <SelectItem value="bloqueada">Bloqueadas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabela de Empresas */}
      <Card className="bg-slate-900/90 border-slate-800 shadow-sm overflow-hidden text-slate-100">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/80 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Empresa / CNPJ</th>
                  <th className="py-3.5 px-4 font-semibold">Plano Atual</th>
                  <th className="py-3.5 px-4 font-semibold">Status Assinatura</th>
                  <th className="py-3.5 px-4 font-semibold">Valor Mensal</th>
                  <th className="py-3.5 px-4 font-semibold">Vigência / Trial</th>
                  <th className="py-3.5 px-4 font-semibold text-center">Usuários</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sky-400 mb-2" />
                      Carregando empresas da plataforma...
                    </td>
                  </tr>
                ) : filteredEmpresas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      Nenhuma empresa encontrada com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredEmpresas.map((emp) => {
                    const isBloqueada = emp.status_assinatura === 'bloqueada'
                    const vigenciaDisplay =
                      emp.status_assinatura === 'trial'
                        ? `Fim Trial: ${formatDate(emp.fim_periodo_teste)}`
                        : emp.vencimento
                          ? `Vence: ${formatDate(emp.vencimento)}`
                          : `Início: ${formatDate(emp.inicio)}`

                    return (
                      <tr key={emp.id} className="hover:bg-slate-800/50 transition-colors group">
                        {/* Nome / CNPJ */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-xs shrink-0">
                              <Building2 className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-white leading-tight truncate">
                                {emp.nome_fantasia || emp.nome}
                              </p>
                              <p className="text-xs text-slate-400 truncate">
                                {emp.cnpj ? `CNPJ: ${emp.cnpj}` : emp.nome}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Plano */}
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-slate-200">
                            {emp.plano_nome || 'Nenhum'}
                          </span>
                          {emp.plano_slug && (
                            <span className="block text-[11px] font-mono text-slate-400">
                              {emp.plano_slug}
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">{getStatusBadge(emp.status_assinatura)}</td>

                        {/* Valor Mensal */}
                        <td className="py-3.5 px-4 font-mono font-medium text-slate-200">
                          {formatCurrency(emp.valor_assinatura)}
                        </td>

                        {/* Vigência / Trial */}
                        <td className="py-3.5 px-4 text-xs text-slate-300">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{vigenciaDisplay}</span>
                          </div>
                        </td>

                        {/* Usuários Ativos */}
                        <td className="py-3.5 px-4 text-center">
                          <Badge className="bg-slate-800 text-slate-300 border-slate-700 text-xs">
                            <Users className="w-3 h-3 mr-1 text-slate-400" />
                            {emp.total_usuarios}
                          </Badge>
                        </td>

                        {/* Ações */}
                        <td className="py-3.5 px-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-48 bg-slate-900 border-slate-800 text-slate-200"
                            >
                              <DropdownMenuLabel className="text-xs text-slate-400">
                                Ações Administrativas
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator className="bg-slate-800" />

                              <DropdownMenuItem
                                onClick={() => setDetalhesEmpresa(emp)}
                                className="cursor-pointer hover:bg-slate-800 focus:bg-slate-800 text-slate-200"
                              >
                                <Info className="w-4 h-4 mr-2 text-sky-400" />
                                Ver Detalhes
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() => {
                                  setAlterarPlanoEmpresa(emp)
                                  setSelectedNovoPlano(emp.plano_slug || '')
                                }}
                                className="cursor-pointer hover:bg-slate-800 focus:bg-slate-800 text-slate-200"
                              >
                                <Edit3 className="w-4 h-4 mr-2 text-indigo-400" />
                                Alterar Plano
                              </DropdownMenuItem>

                              <DropdownMenuSeparator className="bg-slate-800" />

                              {isBloqueada ? (
                                <DropdownMenuItem
                                  onClick={() => setDesbloquearTarget(emp)}
                                  className="cursor-pointer hover:bg-emerald-950/50 focus:bg-emerald-950/50 text-emerald-400 font-semibold"
                                >
                                  <Unlock className="w-4 h-4 mr-2 text-emerald-400" />
                                  Desbloquear Acesso
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => setBloquearTarget(emp)}
                                  className="cursor-pointer hover:bg-rose-950/50 focus:bg-rose-950/50 text-rose-400 font-semibold"
                                >
                                  <Lock className="w-4 h-4 mr-2 text-rose-400" />
                                  Bloquear Empresa
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* MODAL 1: DETALHES COMPLETOS DA EMPRESA */}
      <Dialog open={!!detalhesEmpresa} onOpenChange={() => setDetalhesEmpresa(null)}>
        <DialogContent className="max-w-lg bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <div className="h-10 w-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center mb-1">
              <Building2 className="w-5 h-5" />
            </div>
            <DialogTitle className="text-lg font-bold text-white">
              {detalhesEmpresa?.nome_fantasia || detalhesEmpresa?.nome}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              ID da Empresa: <span className="font-mono text-sky-400">{detalhesEmpresa?.id}</span>
            </DialogDescription>
          </DialogHeader>

          {detalhesEmpresa && (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Razão Social:</span>
                  <span className="font-semibold text-white">{detalhesEmpresa.nome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">CNPJ:</span>
                  <span className="font-mono text-slate-200">
                    {detalhesEmpresa.cnpj || 'Não informado'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">E-mail:</span>
                  <span className="text-slate-200">{detalhesEmpresa.email || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Telefone:</span>
                  <span className="text-slate-200">{detalhesEmpresa.telefone || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Data de Cadastro:</span>
                  <span className="text-slate-200">
                    {formatDate(detalhesEmpresa.created_at?.split('T')[0] || null)}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Plano Atual:</span>
                  <span className="font-bold text-sky-400">
                    {detalhesEmpresa.plano_nome || 'Sem plano'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Status da Assinatura:</span>
                  {getStatusBadge(detalhesEmpresa.status_assinatura)}
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Mensalidade:</span>
                  <span className="font-mono font-semibold text-white">
                    {formatCurrency(detalhesEmpresa.valor_assinatura)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Início da Assinatura:</span>
                  <span className="text-slate-200">{formatDate(detalhesEmpresa.inicio)}</span>
                </div>
                {detalhesEmpresa.fim_periodo_teste && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Fim do Período de Teste:</span>
                    <span className="font-semibold text-amber-300">
                      {formatDate(detalhesEmpresa.fim_periodo_teste)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">Próximo Vencimento:</span>
                  <span className="text-slate-200">{formatDate(detalhesEmpresa.vencimento)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total de Usuários Ativos:</span>
                  <span className="font-bold text-white">{detalhesEmpresa.total_usuarios}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDetalhesEmpresa(null)}
              className="bg-slate-800 border-slate-700 text-slate-200"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: ALTERAR PLANO ADMIN */}
      <Dialog open={!!alterarPlanoEmpresa} onOpenChange={() => setAlterarPlanoEmpresa(null)}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-1">
              <Edit3 className="w-5 h-5" />
            </div>
            <DialogTitle className="text-base font-bold text-white">
              Alterar Plano da Empresa
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Como administrador da plataforma, você pode forçar a migração de plano sem restrições
              de downgrade.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-400 block mb-0.5">Empresa Selecionada:</span>
              <span className="font-bold text-white text-sm">
                {alterarPlanoEmpresa?.nome_fantasia || alterarPlanoEmpresa?.nome}
              </span>
              <span className="block text-slate-400 mt-1">
                Plano atual:{' '}
                <strong className="text-sky-400">{alterarPlanoEmpresa?.plano_nome}</strong>
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold block">Selecione o Novo Plano:</label>
              <Select value={selectedNovoPlano} onValueChange={setSelectedNovoPlano}>
                <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                  <SelectValue placeholder="Escolha o plano" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                  {planos.map((p) => (
                    <SelectItem key={p.id} value={p.slug}>
                      {p.nome} — {formatCurrency(p.valor_mensal)}/mês
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAlterarPlanoEmpresa(null)}
              disabled={submittingPlano}
              className="bg-slate-800 border-slate-700 text-slate-200"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmAlterarPlano}
              disabled={submittingPlano || !selectedNovoPlano}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
            >
              {submittingPlano ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Confirmar Migração'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: BLOQUEAR EMPRESA */}
      <Dialog open={!!bloquearTarget} onOpenChange={() => setBloquearTarget(null)}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <div className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center mb-1">
              <Lock className="w-5 h-5" />
            </div>
            <DialogTitle className="text-base font-bold text-white">
              Bloquear Acesso da Empresa
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Tem certeza que deseja bloquear a empresa{' '}
              <strong className="text-white">
                {bloquearTarget?.nome_fantasia || bloquearTarget?.nome}
              </strong>
              ?
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 text-xs text-rose-300 p-3 rounded-lg bg-rose-950/40 border border-rose-500/30">
            Ao bloquear, todos os usuários desta empresa terão o acesso suspenso até novo
            desbloqueio. A ação será gravada no histórico de auditoria.
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBloquearTarget(null)}
              disabled={submittingStatus}
              className="bg-slate-800 border-slate-700 text-slate-200"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmBloquear}
              disabled={submittingStatus}
              className="bg-rose-600 hover:bg-rose-500 text-white font-semibold"
            >
              {submittingStatus ? 'Bloqueando...' : 'Confirmar Bloqueio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: DESBLOQUEAR EMPRESA */}
      <Dialog open={!!desbloquearTarget} onOpenChange={() => setDesbloquearTarget(null)}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-1">
              <Unlock className="w-5 h-5" />
            </div>
            <DialogTitle className="text-base font-bold text-white">
              Desbloquear Acesso da Empresa
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Deseja reativar o acesso da empresa{' '}
              <strong className="text-white">
                {desbloquearTarget?.nome_fantasia || desbloquearTarget?.nome}
              </strong>
              ?
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 text-xs text-emerald-300 p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30">
            A assinatura será restaurada para o status <strong className="text-white">ativa</strong>{' '}
            com novo ciclo de 30 dias.
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDesbloquearTarget(null)}
              disabled={submittingStatus}
              className="bg-slate-800 border-slate-700 text-slate-200"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmDesbloquear}
              disabled={submittingStatus}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
            >
              {submittingStatus ? 'Desbloqueando...' : 'Confirmar Desbloqueio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
