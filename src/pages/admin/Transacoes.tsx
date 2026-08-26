import { useState, useEffect, useCallback } from 'react'
import {
  Receipt,
  Search,
  Filter,
  ArrowUpDown,
  RefreshCw,
  Building2,
  Calendar,
  CreditCard,
  QrCode,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { PagamentosService, Transacao, HistoricoFinanceiroAdmin } from '@/services/pagamentos'
import { toast } from '@/hooks/use-toast'

export default function AdminTransacoesPage() {
  const [data, setData] = useState<HistoricoFinanceiroAdmin | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [metodoFilter, setMetodoFilter] = useState('todos')
  const [selectedTx, setSelectedTx] = useState<Transacao | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: res, error } = await PagamentosService.getHistoricoFinanceiroAdmin()
      if (error) throw error
      setData(res)
    } catch (err: any) {
      console.error('Erro ao carregar transações admin:', err)
      toast({
        title: 'Erro ao carregar transações',
        description: err.message || 'Falha ao buscar histórico financeiro.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateStr
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'aprovado':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[11px] font-semibold">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Aprovado
          </Badge>
        )
      case 'pendente':
        return (
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[11px] font-semibold">
            <Clock className="w-3 h-3 mr-1" /> Pendente
          </Badge>
        )
      case 'recusado':
        return (
          <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30 text-[11px] font-semibold">
            <AlertCircle className="w-3 h-3 mr-1" /> Recusado
          </Badge>
        )
      case 'reembolsado':
        return (
          <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[11px] font-semibold">
            Reembolsado
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-slate-400 text-[11px]">
            {status}
          </Badge>
        )
    }
  }

  const getMetodoIcon = (metodo?: string | null) => {
    if (!metodo) return <CreditCard className="w-3.5 h-3.5 text-slate-400" />
    const lower = metodo.toLowerCase()
    if (lower.includes('pix')) return <QrCode className="w-3.5 h-3.5 text-teal-400" />
    return <CreditCard className="w-3.5 h-3.5 text-blue-400" />
  }

  // Filtragem
  const transacoesList = data?.transacoes || []
  const filteredTransacoes = transacoesList.filter((tx) => {
    const matchesSearch =
      searchTerm === '' ||
      tx.empresa_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.empresa_nome_fantasia?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.plano_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.gateway_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.id.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === 'todos' || tx.status === statusFilter
    const matchesMetodo =
      metodoFilter === 'todos' ||
      (metodoFilter === 'pix' && tx.metodo_pagamento?.toLowerCase().includes('pix')) ||
      (metodoFilter === 'card' && !tx.metodo_pagamento?.toLowerCase().includes('pix'))

    return matchesSearch && matchesStatus && matchesMetodo
  })

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Receipt className="w-6 h-6 text-sky-400" />
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Transações & Cobranças
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Auditoria financeira em tempo real de pagamentos processados pelo Mercado Pago
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={loading}
          className="bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800 h-9 text-xs gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Atualizar</span>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Recebido */}
        <Card className="rounded-xl border-slate-800 bg-slate-900/90 text-white shadow-lg">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Total Recebido
              </p>
              <p className="text-2xl font-extrabold text-emerald-400 mt-1">
                {formatCurrency(data?.total_recebido || 0)}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Transações aprovadas</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Total Pendente */}
        <Card className="rounded-xl border-slate-800 bg-slate-900/90 text-white shadow-lg">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Total Pendente
              </p>
              <p className="text-2xl font-extrabold text-amber-400 mt-1">
                {formatCurrency(data?.total_pendente || 0)}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Aguardando confirmação</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Total Recusado */}
        <Card className="rounded-xl border-slate-800 bg-slate-900/90 text-white shadow-lg">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Total Recusado
              </p>
              <p className="text-2xl font-extrabold text-rose-400 mt-1">
                {formatCurrency(data?.total_recusado || 0)}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Falhas no checkout</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
              <AlertCircle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela & Filtros */}
      <Card className="rounded-2xl border-slate-800 bg-slate-900/90 text-white shadow-xl">
        <CardHeader className="pb-3 border-b border-slate-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-white">
                Extrato Geral de Pagamentos
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                {filteredTransacoes.length} transação(ões) encontrada(s)
              </CardDescription>
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
                <Input
                  type="text"
                  placeholder="Buscar empresa, plano ou ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 bg-slate-950/80 border-slate-800 text-white placeholder:text-slate-500 h-9 text-xs"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32 bg-slate-950/80 border-slate-800 text-slate-200 h-9 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                  <SelectItem value="todos">Todos Status</SelectItem>
                  <SelectItem value="aprovado">Aprovado</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="recusado">Recusado</SelectItem>
                </SelectContent>
              </Select>

              <Select value={metodoFilter} onValueChange={setMetodoFilter}>
                <SelectTrigger className="w-32 bg-slate-950/80 border-slate-800 text-slate-200 h-9 text-xs">
                  <SelectValue placeholder="Método" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                  <SelectItem value="todos">Todos Métodos</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="card">Cartão / Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-sky-400" />
              <span>Carregando extrato financeiro...</span>
            </div>
          ) : filteredTransacoes.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              <Receipt className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p>Nenhuma transação encontrada com os filtros selecionados.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800/80 bg-slate-950/50 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                    <th className="py-3 px-4">Empresa</th>
                    <th className="py-3 px-4">Plano</th>
                    <th className="py-3 px-4">Valor</th>
                    <th className="py-3 px-4">Método</th>
                    <th className="py-3 px-4">Gateway</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Data/Hora</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {filteredTransacoes.map((tx) => (
                    <tr
                      key={tx.id}
                      onClick={() => setSelectedTx(tx)}
                      className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-semibold text-white group-hover:text-sky-300 transition-colors truncate max-w-[180px]">
                            {tx.empresa_nome || 'Empresa'}
                          </p>
                          {tx.empresa_nome_fantasia && (
                            <p className="text-[11px] text-slate-500 truncate max-w-[180px]">
                              {tx.empresa_nome_fantasia}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-slate-800 border-slate-700 text-slate-300"
                        >
                          {tx.plano_nome || tx.plano_slug || 'Plano'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-bold text-white">{formatCurrency(tx.valor)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 capitalize text-slate-300">
                          {getMetodoIcon(tx.metodo_pagamento)}
                          <span>{tx.metodo_pagamento || 'MP'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-400 uppercase text-[10px] font-mono">
                        {tx.gateway}
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(tx.status)}</td>
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {formatDate(tx.created_at)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-sky-400 hover:text-sky-300 hover:bg-sky-950/40"
                        >
                          Detalhes
                          <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Detalhes da Transação */}
      <Dialog open={!!selectedTx} onOpenChange={(open) => !open && setSelectedTx(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Receipt className="w-5 h-5 text-sky-400" />
              Detalhes da Transação
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              ID interno: {selectedTx?.id}
            </DialogDescription>
          </DialogHeader>

          {selectedTx && (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400">Valor Cobrado</span>
                  <p className="text-xl font-extrabold text-white">
                    {formatCurrency(selectedTx.valor)}
                  </p>
                </div>
                <div>{getStatusBadge(selectedTx.status)}</div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-800">
                <div>
                  <span className="text-slate-400">Empresa:</span>
                  <p className="font-semibold text-white mt-0.5">
                    {selectedTx.empresa_nome || '-'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Plano:</span>
                  <p className="font-semibold text-white mt-0.5">
                    {selectedTx.plano_nome || selectedTx.plano_slug || '-'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Gateway:</span>
                  <p className="font-semibold text-white mt-0.5 uppercase">{selectedTx.gateway}</p>
                </div>
                <div>
                  <span className="text-slate-400">ID no Gateway:</span>
                  <p className="font-mono text-slate-300 mt-0.5 truncate">
                    {selectedTx.gateway_id || '-'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Método de Pagamento:</span>
                  <p className="font-semibold text-white mt-0.5 capitalize">
                    {selectedTx.metodo_pagamento || '-'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Data e Hora:</span>
                  <p className="font-semibold text-white mt-0.5">
                    {formatDate(selectedTx.created_at)}
                  </p>
                </div>
              </div>

              {selectedTx.external_reference && (
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-400">
                  <span className="text-slate-500">external_reference: </span>
                  {selectedTx.external_reference}
                </div>
              )}

              {selectedTx.metadata && Object.keys(selectedTx.metadata).length > 0 && (
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Metadados Gateway (JSON):
                  </span>
                  <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-300 overflow-x-auto max-h-36">
                    {JSON.stringify(selectedTx.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
