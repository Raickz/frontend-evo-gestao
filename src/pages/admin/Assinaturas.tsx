import React, { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CreditCard,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Plus,
  DollarSign,
  Calendar,
  Layers,
  Building2,
  TrendingUp,
  MoreVertical,
  Edit,
  ArrowUpDown,
  FileText,
  AlertCircle,
} from 'lucide-react'
import {
  AdminService,
  AdminAssinaturaItem,
  AdminAssinaturasKPIs,
  AdminPlanoItem,
} from '@/services/admin'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AnimatedNumber } from '@/components/common/AnimatedNumber'
import { RegistrarPagamentoManualModal } from '@/components/admin/RegistrarPagamentoManualModal'
import { AcoesAssinaturaModal } from '@/components/admin/AcoesAssinaturaModal'
import { EditarEmpresaModal } from '@/components/admin/EditarEmpresaModal'
import { toast } from 'sonner'

export default function AdminAssinaturasPage() {
  const [searchParams] = useSearchParams()
  const initialFilter = searchParams.get('filtro') || 'todos'

  const [assinaturas, setAssinaturas] = useState<AdminAssinaturaItem[]>([])
  const [kpis, setKpis] = useState<AdminAssinaturasKPIs | null>(null)
  const [planos, setPlanos] = useState<AdminPlanoItem[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(initialFilter)
  const [planoFilter, setPlanoFilter] = useState('todos')
  const [formaPagtoFilter, setFormaPagtoFilter] = useState('todos')

  // Modais
  const [pagamentoModalOpen, setPagamentoModalOpen] = useState(false)
  const [selectedAssinatura, setSelectedAssinatura] = useState<AdminAssinaturaItem | null>(null)

  const [acaoTipo, setAcaoTipo] = useState<
    'suspender' | 'reativar' | 'cancelar' | 'estender_teste' | null
  >(null)
  const [acaoModalOpen, setAcaoModalOpen] = useState(false)

  const [editEmpresaModalOpen, setEditEmpresaModalOpen] = useState(false)
  const [empresaParaEditar, setEmpresaParaEditar] = useState<any | null>(null)

  const carregarDados = async () => {
    try {
      setLoading(true)
      const [assRes, kpiRes, planRes] = await Promise.all([
        AdminService.listarAssinaturas(),
        AdminService.getAssinaturasKPIs(),
        AdminService.listarPlanosAdmin(),
      ])

      if (assRes.error) throw assRes.error
      if (kpiRes.error) throw kpiRes.error
      if (planRes.error) throw planRes.error

      setAssinaturas(assRes.data)
      setKpis(kpiRes.data)
      setPlanos(planRes.data)
    } catch (err: any) {
      toast.error('Erro ao carregar dados de assinaturas: ' + (err?.message || ''))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  // Sincronizar query param filtro se mudar
  useEffect(() => {
    const f = searchParams.get('filtro')
    if (f) setStatusFilter(f)
  }, [searchParams])

  // Filtragem da tabela
  const filteredAssinaturas = useMemo(() => {
    return assinaturas.filter((item) => {
      const q = search.toLowerCase().trim()
      const matchesSearch =
        !q ||
        item.empresa_nome.toLowerCase().includes(q) ||
        (item.empresa_nome_fantasia && item.empresa_nome_fantasia.toLowerCase().includes(q)) ||
        (item.empresa_cnpj && item.empresa_cnpj.includes(q)) ||
        (item.empresa_email && item.empresa_email.toLowerCase().includes(q))

      const status = (item.status || '').toLowerCase()
      let matchesStatus = true
      if (statusFilter === 'ativas') matchesStatus = status === 'ativa'
      else if (statusFilter === 'trial') matchesStatus = status === 'trial'
      else if (statusFilter === 'vencendo') {
        if (!item.vencimento) matchesStatus = false
        else {
          const diffDays = Math.ceil(
            (new Date(item.vencimento).getTime() - new Date().getTime()) / (1000 * 3600 * 24),
          )
          matchesStatus =
            diffDays >= 0 && diffDays <= 7 && (status === 'ativa' || status === 'trial')
        }
      } else if (statusFilter === 'atrasada') {
        matchesStatus =
          status === 'atrasada' ||
          (status === 'ativa' && !!item.vencimento && new Date(item.vencimento) < new Date())
      } else if (statusFilter === 'suspensa') {
        matchesStatus = status === 'suspensa' || status === 'bloqueada'
      } else if (statusFilter === 'cancelada') {
        matchesStatus = status === 'cancelada'
      }

      const matchesPlano = planoFilter === 'todos' || item.plano_slug === planoFilter

      const forma = (item.metodo_pagamento || '').toLowerCase()
      const matchesForma = formaPagtoFilter === 'todos' || forma === formaPagtoFilter

      return matchesSearch && matchesStatus && matchesPlano && matchesForma
    })
  }, [assinaturas, search, statusFilter, planoFilter, formaPagtoFilter])

  const formatCurrency = (val: number | null | undefined) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val || 0)
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-'
    const [year, month, day] = dateStr.split('T')[0].split('-')
    return `${day}/${month}/${year}`
  }

  const getStatusBadge = (status: string | null, vencimento: string | null) => {
    const s = (status || '').toLowerCase()

    // Verificar se está vencendo em breve
    let isVencendo = false
    let isAtrasado = false
    if (vencimento && (s === 'ativa' || s === 'trial')) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const vDate = new Date(vencimento)
      vDate.setHours(0, 0, 0, 0)
      const diffDays = Math.ceil((vDate.getTime() - today.getTime()) / (1000 * 3600 * 24))
      if (diffDays < 0) isAtrasado = true
      else if (diffDays <= 7) isVencendo = true
    }

    if (isAtrasado || s === 'atrasada') {
      return (
        <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-xs font-semibold gap-1">
          <AlertTriangle className="w-3 h-3" />
          Em Atraso
        </Badge>
      )
    }

    if (isVencendo) {
      return (
        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs font-semibold gap-1">
          <Clock className="w-3 h-3" />
          Vencendo
        </Badge>
      )
    }

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
            Em Teste
          </Badge>
        )
      case 'suspensa':
      case 'bloqueada':
        return (
          <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/40 text-xs font-semibold gap-1">
            <ShieldAlert className="w-3 h-3" />
            Suspensa
          </Badge>
        )
      case 'cancelada':
        return (
          <Badge className="bg-slate-700 text-slate-300 border-slate-600 text-xs font-semibold gap-1">
            <XCircle className="w-3 h-3" />
            Cancelada
          </Badge>
        )
      default:
        return (
          <Badge className="bg-slate-800 text-slate-400 border-slate-700 text-xs font-semibold">
            {s || 'Sem Assinatura'}
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
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <CreditCard className="w-7 h-7 text-sky-400" />
              Controle Central de Assinaturas
            </h1>
            <Badge className="bg-sky-500/20 text-sky-400 border-sky-500/40 text-xs font-semibold">
              {assinaturas.length} Contratos
            </Badge>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Gestão financeira de planos, pagamentos manuais, controle de vigência, vencimentos e
            MRR.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={carregarDados}
          disabled={loading}
          className="bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-200"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin text-sky-400' : ''}`} />
          Atualizar Dados
        </Button>
      </div>

      {/* KPI Cards com AnimatedNumber */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* Total */}
        <div
          onClick={() => setStatusFilter('todos')}
          className={`p-3 rounded-xl border cursor-pointer transition-all ${
            statusFilter === 'todos'
              ? 'bg-sky-950/60 border-sky-500'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <p className="text-[11px] font-semibold text-slate-400 truncate">Total Assinaturas</p>
          <p className="text-xl font-black text-white mt-1">
            <AnimatedNumber value={kpis?.total_assinaturas || 0} />
          </p>
        </div>

        {/* Ativas */}
        <div
          onClick={() => setStatusFilter('ativas')}
          className={`p-3 rounded-xl border cursor-pointer transition-all ${
            statusFilter === 'ativas'
              ? 'bg-emerald-950/60 border-emerald-500'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <p className="text-[11px] font-semibold text-emerald-400 truncate">Ativas</p>
          <p className="text-xl font-black text-emerald-400 mt-1">
            <AnimatedNumber value={kpis?.ativas || 0} />
          </p>
        </div>

        {/* Em Teste */}
        <div
          onClick={() => setStatusFilter('trial')}
          className={`p-3 rounded-xl border cursor-pointer transition-all ${
            statusFilter === 'trial'
              ? 'bg-sky-950/60 border-sky-500'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <p className="text-[11px] font-semibold text-sky-400 truncate">Em Teste</p>
          <p className="text-xl font-black text-sky-400 mt-1">
            <AnimatedNumber value={kpis?.em_teste || 0} />
          </p>
        </div>

        {/* Vencendo */}
        <div
          onClick={() => setStatusFilter('vencendo')}
          className={`p-3 rounded-xl border cursor-pointer transition-all ${
            statusFilter === 'vencendo'
              ? 'bg-amber-950/60 border-amber-500'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <p className="text-[11px] font-semibold text-amber-400 truncate">Vencendo (7d)</p>
          <p className="text-xl font-black text-amber-400 mt-1">
            <AnimatedNumber value={kpis?.vencendo_breve || 0} />
          </p>
        </div>

        {/* Em Atraso */}
        <div
          onClick={() => setStatusFilter('atrasada')}
          className={`p-3 rounded-xl border cursor-pointer transition-all ${
            statusFilter === 'atrasada'
              ? 'bg-rose-950/60 border-rose-500'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <p className="text-[11px] font-semibold text-rose-400 truncate">Em Atraso</p>
          <p className="text-xl font-black text-rose-400 mt-1">
            <AnimatedNumber value={kpis?.em_atraso || 0} />
          </p>
        </div>

        {/* Suspensas */}
        <div
          onClick={() => setStatusFilter('suspensa')}
          className={`p-3 rounded-xl border cursor-pointer transition-all ${
            statusFilter === 'suspensa'
              ? 'bg-indigo-950/60 border-indigo-500'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <p className="text-[11px] font-semibold text-indigo-400 truncate">Suspensas</p>
          <p className="text-xl font-black text-indigo-400 mt-1">
            <AnimatedNumber value={kpis?.suspensas || 0} />
          </p>
        </div>

        {/* Canceladas */}
        <div
          onClick={() => setStatusFilter('cancelada')}
          className={`p-3 rounded-xl border cursor-pointer transition-all ${
            statusFilter === 'cancelada'
              ? 'bg-slate-800 border-slate-600'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <p className="text-[11px] font-semibold text-slate-400 truncate">Canceladas</p>
          <p className="text-xl font-black text-slate-300 mt-1">
            <AnimatedNumber value={kpis?.canceladas || 0} />
          </p>
        </div>

        {/* MRR Atual */}
        <div className="p-3 rounded-xl border bg-slate-900/95 border-emerald-500/40 shadow-sm">
          <p className="text-[11px] font-semibold text-emerald-400 truncate flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> MRR Atual
          </p>
          <p className="text-xl font-black text-emerald-400 mt-1 font-mono">
            <AnimatedNumber value={Number(kpis?.mrr_atual || 0)} prefix="R$ " decimals={2} />
          </p>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="relative sm:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar por Empresa, CNPJ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-slate-900/90 border-slate-800 text-slate-100 placeholder:text-slate-400"
          />
        </div>

        <div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="bg-slate-900/90 border-slate-800 text-slate-200">
              <Filter className="w-4 h-4 mr-2 text-slate-400" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
              <SelectItem value="todos">Todos os Status</SelectItem>
              <SelectItem value="ativas">Ativas</SelectItem>
              <SelectItem value="trial">Em Teste (Trial)</SelectItem>
              <SelectItem value="vencendo">Vencendo em Breve (7 dias)</SelectItem>
              <SelectItem value="atrasada">Em Atraso / Vencidas</SelectItem>
              <SelectItem value="suspensa">Suspensas / Bloqueadas</SelectItem>
              <SelectItem value="cancelada">Canceladas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Select value={planoFilter} onValueChange={setPlanoFilter}>
            <SelectTrigger className="bg-slate-900/90 border-slate-800 text-slate-200">
              <Layers className="w-4 h-4 mr-2 text-slate-400" />
              <SelectValue placeholder="Plano" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
              <SelectItem value="todos">Todos os Planos</SelectItem>
              {planos.map((p) => (
                <SelectItem key={p.id} value={p.slug}>
                  {p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Select value={formaPagtoFilter} onValueChange={setFormaPagtoFilter}>
            <SelectTrigger className="bg-slate-900/90 border-slate-800 text-slate-200">
              <CreditCard className="w-4 h-4 mr-2 text-slate-400" />
              <SelectValue placeholder="Forma de Pagto" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
              <SelectItem value="todos">Todas as Formas</SelectItem>
              <SelectItem value="pix">PIX</SelectItem>
              <SelectItem value="boleto">Boleto</SelectItem>
              <SelectItem value="cartao">Cartão de Crédito</SelectItem>
              <SelectItem value="transferencia">Transferência</SelectItem>
              <SelectItem value="dinheiro">Dinheiro</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabela de Assinaturas */}
      <Card className="bg-slate-900/90 border-slate-800 shadow-sm overflow-hidden text-slate-100">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/80 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Empresa</th>
                  <th className="py-3.5 px-4 font-semibold">Plano</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-4 font-semibold">Valor Mensal</th>
                  <th className="py-3.5 px-4 font-semibold">Início / Contrato</th>
                  <th className="py-3.5 px-4 font-semibold">Próximo Vencimento</th>
                  <th className="py-3.5 px-4 font-semibold">Forma / Origem</th>
                  <th className="py-3.5 px-4 font-semibold">Último Pagamento</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sky-400 mb-2" />
                      Carregando central de assinaturas...
                    </td>
                  </tr>
                ) : filteredAssinaturas.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      Nenhuma assinatura encontrada para os filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  filteredAssinaturas.map((ass) => {
                    const isManual = ass.gateway === 'manual'
                    return (
                      <tr key={ass.id} className="hover:bg-slate-800/50 transition-colors">
                        {/* Empresa */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-xs shrink-0">
                              <Building2 className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-white leading-tight truncate">
                                {ass.empresa_nome_fantasia || ass.empresa_nome}
                              </p>
                              <p className="text-[11px] text-slate-400 truncate">
                                {ass.empresa_cnpj ? `CNPJ: ${ass.empresa_cnpj}` : ass.empresa_nome}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Plano */}
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-slate-200">{ass.plano_nome}</span>
                          <span className="block text-[11px] text-slate-400 capitalize">
                            {ass.periodicidade || 'mensal'}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          {getStatusBadge(ass.status, ass.vencimento)}
                        </td>

                        {/* Valor Mensal */}
                        <td className="py-3.5 px-4 font-mono font-medium text-emerald-400">
                          {formatCurrency(ass.valor)}
                        </td>

                        {/* Início */}
                        <td className="py-3.5 px-4 text-xs text-slate-300">
                          {formatDate(ass.inicio || ass.data_contratacao)}
                        </td>

                        {/* Próximo Vencimento */}
                        <td className="py-3.5 px-4 text-xs">
                          {ass.status === 'trial' ? (
                            <span className="text-amber-300 font-semibold flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {formatDate(ass.fim_periodo_teste || ass.vencimento)} (Trial)
                            </span>
                          ) : (
                            <span className="text-slate-200 font-mono">
                              {formatDate(ass.vencimento)}
                            </span>
                          )}
                        </td>

                        {/* Forma / Gateway */}
                        <td className="py-3.5 px-4 text-xs">
                          <span className="capitalize text-slate-200 block">
                            {ass.metodo_pagamento || 'PIX'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {isManual ? 'Origem Manual' : 'Mercado Pago'}
                          </span>
                        </td>

                        {/* Último Pagamento */}
                        <td className="py-3.5 px-4 text-xs">
                          {ass.ultimo_pagamento ? (
                            <div>
                              <span className="font-mono font-bold text-emerald-400 block">
                                {formatCurrency(ass.ultimo_pagamento.valor)}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {formatDate(ass.ultimo_pagamento.data)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-500">Nenhum</span>
                          )}
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
                              className="w-52 bg-slate-900 border-slate-800 text-slate-200"
                            >
                              <DropdownMenuLabel className="text-xs text-slate-400">
                                Gestão da Assinatura
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator className="bg-slate-800" />

                              {/* Registrar Pagamento */}
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedAssinatura(ass)
                                  setPagamentoModalOpen(true)
                                }}
                                className="cursor-pointer hover:bg-slate-800 text-emerald-400 font-medium"
                              >
                                <DollarSign className="w-4 h-4 mr-2" />+ Registrar Pagamento
                              </DropdownMenuItem>

                              {/* Editar / Condições */}
                              <DropdownMenuItem
                                onClick={() => {
                                  setEmpresaParaEditar({
                                    id: ass.empresa_id,
                                    nome: ass.empresa_nome,
                                    nome_fantasia: ass.empresa_nome_fantasia,
                                    cnpj: ass.empresa_cnpj,
                                    email: ass.empresa_email,
                                    telefone: ass.empresa_telefone,
                                    status: ass.empresa_status,
                                    plano_slug: ass.plano_slug,
                                    valor_assinatura: ass.valor,
                                    vencimento: ass.vencimento,
                                    fim_periodo_teste: ass.fim_periodo_teste,
                                  })
                                  setEditEmpresaModalOpen(true)
                                }}
                                className="cursor-pointer hover:bg-slate-800 text-sky-400 font-medium"
                              >
                                <Edit className="w-4 h-4 mr-2" />
                                Editar Plano / Valores
                              </DropdownMenuItem>

                              {ass.status === 'trial' && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedAssinatura(ass)
                                    setAcaoTipo('estender_teste')
                                    setAcaoModalOpen(true)
                                  }}
                                  className="cursor-pointer hover:bg-slate-800 text-amber-300"
                                >
                                  <Clock className="w-4 h-4 mr-2" />
                                  Estender Período de Teste
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuSeparator className="bg-slate-800" />

                              {ass.status !== 'suspensa' && ass.status !== 'bloqueada' ? (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedAssinatura(ass)
                                    setAcaoTipo('suspender')
                                    setAcaoModalOpen(true)
                                  }}
                                  className="cursor-pointer hover:bg-slate-800 text-rose-400"
                                >
                                  <ShieldAlert className="w-4 h-4 mr-2" />
                                  Suspender Assinatura
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedAssinatura(ass)
                                    setAcaoTipo('reativar')
                                    setAcaoModalOpen(true)
                                  }}
                                  className="cursor-pointer hover:bg-slate-800 text-emerald-400"
                                >
                                  <ShieldCheck className="w-4 h-4 mr-2" />
                                  Reativar Assinatura
                                </DropdownMenuItem>
                              )}

                              {ass.status !== 'cancelada' && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedAssinatura(ass)
                                    setAcaoTipo('cancelar')
                                    setAcaoModalOpen(true)
                                  }}
                                  className="cursor-pointer hover:bg-slate-800 text-slate-400"
                                >
                                  <XCircle className="w-4 h-4 mr-2" />
                                  Cancelar Assinatura
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

      {/* MODAL 1: REGISTRAR PAGAMENTO MANUAL */}
      <RegistrarPagamentoManualModal
        open={pagamentoModalOpen}
        onOpenChange={setPagamentoModalOpen}
        assinatura={selectedAssinatura}
        onSuccess={() => {
          carregarDados()
        }}
      />

      {/* MODAL 2: AÇÕES DE CONTROLE (SUSPENDER, REATIVAR, CANCELAR, ESTENDER TESTE) */}
      <AcoesAssinaturaModal
        open={acaoModalOpen}
        onOpenChange={setAcaoModalOpen}
        tipo={acaoTipo}
        assinatura={selectedAssinatura}
        onSuccess={() => {
          carregarDados()
        }}
      />

      {/* MODAL 3: EDITAR EMPRESA / PLANO */}
      <EditarEmpresaModal
        open={editEmpresaModalOpen}
        onOpenChange={setEditEmpresaModalOpen}
        empresa={empresaParaEditar}
        planos={planos}
        onSuccess={() => {
          carregarDados()
        }}
      />
    </div>
  )
}
