import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2,
  ShieldCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  CircleDollarSign,
  Users,
  Layers,
  ArrowUpRight,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { AdminService, AdminDashboardData } from '@/services/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data: dashData, error: dashErr } = await AdminService.getDashboard()
      if (dashErr) throw dashErr
      setData(dashData)
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar indicadores administrativos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val || 0)
  }

  return (
    <div className="space-y-6">
      {/* Header com Boas-Vindas e Ação de Recarregar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black tracking-tight text-white">
              Visão Geral da Plataforma
            </h2>
            <Badge className="bg-sky-500/20 text-sky-400 border-sky-500/40 text-xs font-semibold">
              Platform Admin
            </Badge>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Monitoramento global de empresas, licenças, métricas de MRR e assinaturas do EVO Gestão.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-200"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin text-sky-400' : ''}`} />
            Atualizar Dados
          </Button>
          <Button
            asChild
            size="sm"
            className="bg-sky-600 hover:bg-sky-500 text-white font-semibold shadow-md shadow-sky-950/40"
          >
            <Link to="/admin/empresas">
              Ver Empresas
              <ArrowUpRight className="w-4 h-4 ml-1.5" />
            </Link>
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-950/40 text-red-300 text-sm flex items-center justify-between">
          <span>{error}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            className="border-red-500/50 bg-red-900/40 text-red-200 hover:bg-red-900"
          >
            Tentar Novamente
          </Button>
        </div>
      )}

      {/* Cards Principais de Indicadores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total de Empresas */}
        <Card className="bg-slate-900/90 border-slate-800 shadow-sm text-slate-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Total de Empresas
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">
              <Building2 className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-white">
              {loading ? '-' : (data?.total_empresas ?? 0)}
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <span>{data?.empresas_ativas ?? 0} ativas na base</span>
            </p>
          </CardContent>
        </Card>

        {/* Empresas Ativas */}
        <Card className="bg-slate-900/90 border-slate-800 shadow-sm text-slate-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-emerald-400 uppercase tracking-wider">
              Empresas Ativas
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-emerald-400">
              {loading ? '-' : (data?.empresas_ativas ?? 0)}
            </div>
            <p className="text-xs text-slate-400 mt-1">Com status regular no sistema</p>
          </CardContent>
        </Card>

        {/* Empresas em Trial */}
        <Card className="bg-slate-900/90 border-slate-800 shadow-sm text-slate-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-amber-400 uppercase tracking-wider">
              Empresas em Trial
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-amber-400">
              {loading ? '-' : (data?.empresas_trial ?? 0)}
            </div>
            <p className="text-xs text-slate-400 mt-1">Período de teste em andamento</p>
          </CardContent>
        </Card>

        {/* Trials Próximos do Vencimento */}
        <Card
          className={`bg-slate-900/90 border-slate-800 shadow-sm text-slate-100 ${
            (data?.trials_proximos_vencimento ?? 0) > 0 ? 'border-orange-500/40' : ''
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-orange-400 uppercase tracking-wider">
              Trials a Vencer (7d)
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-orange-400">
              {loading ? '-' : (data?.trials_proximos_vencimento ?? 0)}
            </div>
            <p className="text-xs text-slate-400 mt-1">Oportunidades de conversão</p>
          </CardContent>
        </Card>

        {/* MRR Consolidado */}
        <Card className="bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950/60 border-sky-500/30 shadow-md text-slate-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-sky-400 uppercase tracking-wider">
              MRR Plataforma
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-sky-500/20 flex items-center justify-center text-sky-300">
              <CircleDollarSign className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-white">
              {loading ? '-' : formatCurrency(data?.mrr ?? 0)}
            </div>
            <p className="text-xs text-slate-400 mt-1">Receita recorrente mensal contratada</p>
          </CardContent>
        </Card>

        {/* Assinaturas Ativas */}
        <Card className="bg-slate-900/90 border-slate-800 shadow-sm text-slate-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-emerald-400 uppercase tracking-wider">
              Assinaturas Ativas
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-emerald-400">
              {loading ? '-' : (data?.assinaturas_ativas ?? 0)}
            </div>
            <p className="text-xs text-slate-400 mt-1">Planos pagos ativos</p>
          </CardContent>
        </Card>

        {/* Assinaturas Atrasadas / Canceladas */}
        <Card className="bg-slate-900/90 border-slate-800 shadow-sm text-slate-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-rose-400 uppercase tracking-wider">
              Atrasadas / Canceladas
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400">
              <XCircle className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-rose-400">
              {loading
                ? '-'
                : `${data?.assinaturas_atrasadas ?? 0} / ${data?.assinaturas_canceladas ?? 0}`}
            </div>
            <p className="text-xs text-slate-400 mt-1">Inadimplência ou cancelamento</p>
          </CardContent>
        </Card>

        {/* Total de Usuários Ativos */}
        <Card className="bg-slate-900/90 border-slate-800 shadow-sm text-slate-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-indigo-400 uppercase tracking-wider">
              Total de Usuários
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <Users className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-indigo-400">
              {loading ? '-' : (data?.total_usuarios ?? 0)}
            </div>
            <p className="text-xs text-slate-400 mt-1">Usuários ativos nas empresas</p>
          </CardContent>
        </Card>
      </div>

      {/* Seção de Distribuição por Plano */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-sky-400" />
            <h3 className="text-base font-bold text-white">Distribuição de Empresas por Plano</h3>
          </div>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-xs text-sky-400 hover:text-sky-300 hover:bg-slate-900"
          >
            <Link to="/admin/planos">Gerenciar Planos →</Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data?.distribuicao_por_plano?.map((p) => {
            const pct =
              data.total_empresas > 0 ? Math.round((p.quantidade / data.total_empresas) * 100) : 0

            return (
              <Card
                key={p.plano_id}
                className="bg-slate-900/90 border-slate-800 shadow-sm text-slate-100 overflow-hidden relative"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Plano
                      </span>
                      <h4 className="text-lg font-bold text-white mt-0.5">{p.plano_nome}</h4>
                      <span className="text-[11px] font-mono text-sky-400/90">slug: {p.slug}</span>
                    </div>
                    <Badge className="bg-sky-500/15 text-sky-300 border-sky-500/30 text-xs font-bold px-2 py-0.5">
                      {p.quantidade} {p.quantidade === 1 ? 'empresa' : 'empresas'}
                    </Badge>
                  </div>

                  {/* Barra de Progresso visual */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Participação da base</span>
                      <span className="font-semibold text-slate-200">{pct}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-sky-500 to-indigo-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}

          {(!data?.distribuicao_por_plano || data.distribuicao_por_plano.length === 0) && (
            <div className="col-span-3 p-8 rounded-xl border border-dashed border-slate-800 text-center text-slate-400 text-sm">
              Nenhum plano configurado no momento.
            </div>
          )}
        </div>
      </div>

      {/* Ações Rápidas de Gestão */}
      <Card className="bg-slate-900/60 border-slate-800/80 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Central de Governança</h4>
              <p className="text-xs text-slate-400">
                Acesse o gerenciamento de empresas, auditoria de planos ou o histórico de mudanças
                em assinaturas.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800 text-xs"
            >
              <Link to="/admin/historico">Histórico de Alterações</Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold"
            >
              <Link to="/admin/empresas">Gerenciar Empresas</Link>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
