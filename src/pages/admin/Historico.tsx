import { useState, useEffect, useMemo } from 'react'
import {
  Clock,
  Filter,
  RefreshCw,
  Search,
  Building2,
  Calendar,
  User,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Lock,
  Unlock,
  CheckCircle,
  XCircle,
  Sparkles,
} from 'lucide-react'
import { AdminService, AdminHistoricoItem } from '@/services/admin'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

export default function AdminHistoricoPage() {
  const [logs, setLogs] = useState<AdminHistoricoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tipoFilter, setTipoFilter] = useState('todos')

  const loadHistorico = async () => {
    try {
      setLoading(true)
      const { data, error } = await AdminService.listarHistorico()
      if (error) throw error
      setLogs(data)
    } catch (err: any) {
      toast.error('Erro ao carregar histórico: ' + (err?.message || 'Falha na requisição.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHistorico()
  }, [])

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      const q = search.toLowerCase().trim()
      const matchesSearch =
        !q ||
        (l.empresa_nome && l.empresa_nome.toLowerCase().includes(q)) ||
        (l.empresa_nome_fantasia && l.empresa_nome_fantasia.toLowerCase().includes(q)) ||
        (l.usuario_responsavel_nome && l.usuario_responsavel_nome.toLowerCase().includes(q)) ||
        (l.plano_novo_nome && l.plano_novo_nome.toLowerCase().includes(q))

      const matchesTipo = tipoFilter === 'todos' || l.tipo === tipoFilter

      return matchesSearch && matchesTipo
    })
  }, [logs, search, tipoFilter])

  const formatCurrency = (val: number | null) => {
    if (val === null || val === undefined) return '-'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val)
  }

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'upgrade':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs font-semibold gap-1">
            <TrendingUp className="w-3 h-3" />
            Upgrade
          </Badge>
        )
      case 'downgrade':
        return (
          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs font-semibold gap-1">
            <TrendingDown className="w-3 h-3" />
            Downgrade
          </Badge>
        )
      case 'cancelamento':
        return (
          <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-xs font-semibold gap-1">
            <XCircle className="w-3 h-3" />
            Cancelamento
          </Badge>
        )
      case 'reativacao':
        return (
          <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40 text-xs font-semibold gap-1">
            <CheckCircle className="w-3 h-3" />
            Reativação
          </Badge>
        )
      case 'bloqueio':
        return (
          <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-xs font-semibold gap-1">
            <Lock className="w-3 h-3" />
            Bloqueio
          </Badge>
        )
      case 'desbloqueio':
        return (
          <Badge className="bg-slate-700 text-slate-200 border-slate-600 text-xs font-semibold gap-1">
            <Unlock className="w-3 h-3" />
            Desbloqueio
          </Badge>
        )
      case 'criacao':
        return (
          <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/40 text-xs font-semibold gap-1">
            <Sparkles className="w-3 h-3" />
            Criação
          </Badge>
        )
      case 'trial_inicio':
        return (
          <Badge className="bg-teal-500/20 text-teal-300 border-teal-500/40 text-xs font-semibold gap-1">
            <Clock className="w-3 h-3" />
            Início de Trial
          </Badge>
        )
      default:
        return (
          <Badge className="bg-slate-800 text-slate-300 border-slate-700 text-xs font-semibold">
            {tipo}
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black tracking-tight text-white">
              Histórico de Assinaturas
            </h2>
            <Badge className="bg-sky-500/20 text-sky-400 border-sky-500/40 text-xs font-semibold">
              {logs.length} Registros
            </Badge>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Auditoria completa de criação, upgrades, downgrades, cancelamentos e bloqueios na
            plataforma.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadHistorico}
          disabled={loading}
          className="bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-200"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin text-sky-400' : ''}`} />
          Atualizar Log
        </Button>
      </div>

      {/* Busca e Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar por empresa, responsável ou plano..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-slate-900/90 border-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-sky-500"
          />
        </div>

        <div className="w-full sm:w-60">
          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger className="bg-slate-900/90 border-slate-800 text-slate-200">
              <Filter className="w-4 h-4 mr-2 text-slate-400" />
              <SelectValue placeholder="Filtrar por evento" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
              <SelectItem value="todos">Todos os Eventos</SelectItem>
              <SelectItem value="upgrade">Upgrade</SelectItem>
              <SelectItem value="downgrade">Downgrade</SelectItem>
              <SelectItem value="trial_inicio">Início de Trial</SelectItem>
              <SelectItem value="criacao">Criação</SelectItem>
              <SelectItem value="reativacao">Reativação</SelectItem>
              <SelectItem value="cancelamento">Cancelamento</SelectItem>
              <SelectItem value="bloqueio">Bloqueio</SelectItem>
              <SelectItem value="desbloqueio">Desbloqueio</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabela de Histórico */}
      <Card className="bg-slate-900/90 border-slate-800 shadow-sm overflow-hidden text-slate-100">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/80 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Data / Hora</th>
                  <th className="py-3.5 px-4 font-semibold">Empresa</th>
                  <th className="py-3.5 px-4 font-semibold">Tipo de Evento</th>
                  <th className="py-3.5 px-4 font-semibold">Mudança de Plano</th>
                  <th className="py-3.5 px-4 font-semibold">Variação de Valor</th>
                  <th className="py-3.5 px-4 font-semibold">Responsável</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sky-400 mb-2" />
                      Carregando histórico de auditoria...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      Nenhum registro de log encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    return (
                      <tr key={log.id} className="hover:bg-slate-800/50 transition-colors">
                        {/* Data / Hora */}
                        <td className="py-3.5 px-4 text-xs font-mono text-slate-300">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{formatDateTime(log.created_at)}</span>
                          </div>
                        </td>

                        {/* Empresa */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-md bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0">
                              <Building2 className="w-3.5 h-3.5" />
                            </div>
                            <span className="font-semibold text-white">
                              {log.empresa_nome_fantasia || log.empresa_nome || 'Empresa'}
                            </span>
                          </div>
                        </td>

                        {/* Tipo */}
                        <td className="py-3.5 px-4">{getTipoBadge(log.tipo)}</td>

                        {/* Transição de Plano */}
                        <td className="py-3.5 px-4">
                          {log.plano_anterior_nome &&
                          log.plano_anterior_nome !== log.plano_novo_nome ? (
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="text-slate-400 line-through">
                                {log.plano_anterior_nome}
                              </span>
                              <ArrowRight className="w-3 h-3 text-sky-400" />
                              <strong className="text-white font-semibold">
                                {log.plano_novo_nome}
                              </strong>
                            </div>
                          ) : (
                            <span className="text-xs font-semibold text-slate-200">
                              {log.plano_novo_nome || log.plano_anterior_nome || '—'}
                            </span>
                          )}
                        </td>

                        {/* Variação de Valor */}
                        <td className="py-3.5 px-4 font-mono text-xs">
                          {log.valor_anterior !== null && log.valor_anterior !== log.valor_novo ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-400 line-through">
                                {formatCurrency(log.valor_anterior)}
                              </span>
                              <ArrowRight className="w-3 h-3 text-sky-400" />
                              <strong className="text-white">
                                {formatCurrency(log.valor_novo)}
                              </strong>
                            </div>
                          ) : (
                            <span className="text-slate-200">
                              {formatCurrency(log.valor_novo ?? log.valor_anterior)}
                            </span>
                          )}
                        </td>

                        {/* Responsável */}
                        <td className="py-3.5 px-4 text-xs text-slate-300">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>{log.usuario_responsavel_nome || 'Sistema / Plataforma'}</span>
                          </div>
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
    </div>
  )
}
