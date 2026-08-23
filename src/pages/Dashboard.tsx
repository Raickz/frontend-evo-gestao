import { useState, useEffect } from 'react'
import { PageHeader, MetricCard } from '@/components/common/CommonUI'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useEmpresa } from '@/hooks/use-empresa'
import { useAuth } from '@/hooks/use-auth'
import {
  DollarSign,
  TrendingUp,
  Package,
  Users,
  AlertTriangle,
  ArrowUpRight,
  ShoppingCart,
  CheckCircle2,
  Clock,
  Boxes,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { canAccessPage } from '@/lib/permissions'
import { VendasService } from '@/services/vendas'
import { ClientesService } from '@/services/clientes'
import { ProdutosService } from '@/services/produtos'
import { FinanceiroService } from '@/services/financeiro'

export default function DashboardPage() {
  const { empresaId, empresa } = useEmpresa()
  const { usuario } = useAuth()

  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalVendas: 0,
    qtdVendas: 0,
    totalClientes: 0,
    totalProdutos: 0,
    contasReceberPendente: 0,
    contasPagarPendente: 0,
  })

  useEffect(() => {
    async function loadDashboardData() {
      if (!empresaId) return
      setLoading(true)
      try {
        const [vendasRes, clientesRes, produtosRes, receberRes, pagarRes] = await Promise.all([
          VendasService.list(empresaId),
          ClientesService.list(empresaId),
          ProdutosService.list(empresaId),
          FinanceiroService.listContasReceber(empresaId),
          FinanceiroService.listContasPagar(empresaId),
        ])

        const totalV = (vendasRes.data || []).reduce((acc, curr) => acc + (curr.total || 0), 0)
        const totalRec = (receberRes.data || [])
          .filter((c) => c.status === 'pendente')
          .reduce((acc, curr) => acc + (curr.valor || 0) - (curr.valor_pago || 0), 0)
        const totalPag = (pagarRes.data || [])
          .filter((c) => c.status === 'pendente')
          .reduce((acc, curr) => acc + (curr.valor || 0) - (curr.valor_pago || 0), 0)

        setStats({
          totalVendas: totalV,
          qtdVendas: (vendasRes.data || []).length,
          totalClientes: (clientesRes.data || []).length,
          totalProdutos: (produtosRes.data || []).length,
          contasReceberPendente: totalRec,
          contasPagarPendente: totalPag,
        })
      } catch (e) {
        console.error('Erro ao carregar dados do dashboard:', e)
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [empresaId])

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visão Geral"
        description={`Bem-vindo de volta, ${usuario?.nome || 'Usuário'}. Aqui está o resumo comercial da ${
          empresa?.nome_fantasia || empresa?.nome || 'sua distribuidora'
        }.`}
        actions={
          canAccessPage(usuario?.perfil, 'vendas') ? (
            <div className="flex items-center gap-2">
              <Link to="/app/vendas">
                <Button className="bg-teal-700 hover:bg-teal-800 text-white flex items-center gap-1.5 shadow-sm">
                  <ShoppingCart className="w-4 h-4" />
                  Nova Venda
                </Button>
              </Link>
            </div>
          ) : undefined
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Faturamento Total"
          value={loading ? 'Carregando...' : formatCurrency(stats.totalVendas)}
          subtitle={`${stats.qtdVendas} vendas registradas`}
          icon={DollarSign}
          trend="+12% vs mês anterior"
        />
        <MetricCard
          title="Contas a Receber"
          value={loading ? 'Carregando...' : formatCurrency(stats.contasReceberPendente)}
          subtitle="Em aberto / pendente"
          icon={TrendingUp}
        />
        <MetricCard
          title="Contas a Pagar"
          value={loading ? 'Carregando...' : formatCurrency(stats.contasPagarPendente)}
          subtitle="Compromissos pendentes"
          icon={AlertTriangle}
        />
        <MetricCard
          title="Base de Clientes"
          value={loading ? 'Carregando...' : `${stats.totalClientes} cadastrados`}
          subtitle={`${stats.totalProdutos} produtos ativos`}
          icon={Users}
        />
      </div>

      {/* Quick Action Shortcuts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border border-slate-200 bg-white shadow-xs md:col-span-2">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Módulos de Gestão Rápida
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Acesse diretamente as operações principais da sua distribuidora
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-teal-700 border-teal-200 bg-teal-50">
                Operacional
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {canAccessPage(usuario?.perfil, 'clientes') && (
              <Link
                to="/app/clientes"
                className="p-3.5 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/30 transition-all flex items-start gap-3 group"
              >
                <div className="p-2.5 rounded-lg bg-teal-100 text-teal-700 group-hover:bg-teal-700 group-hover:text-white transition-colors">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 group-hover:text-teal-900">
                    Clientes & Limites
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Gerencie limites de crédito e vendedores vinculados.
                  </p>
                </div>
              </Link>
            )}

            {canAccessPage(usuario?.perfil, 'produtos') && (
              <Link
                to="/app/produtos"
                className="p-3.5 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/30 transition-all flex items-start gap-3 group"
              >
                <div className="p-2.5 rounded-lg bg-teal-100 text-teal-700 group-hover:bg-teal-700 group-hover:text-white transition-colors">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 group-hover:text-teal-900">
                    Catálogo de Produtos
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tabela de preços, estoque mínimo e categorias.
                  </p>
                </div>
              </Link>
            )}

            {canAccessPage(usuario?.perfil, 'estoque') && (
              <Link
                to="/app/estoque"
                className="p-3.5 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/30 transition-all flex items-start gap-3 group"
              >
                <div className="p-2.5 rounded-lg bg-amber-100 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 group-hover:text-amber-900">
                    Controle de Estoque
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Entradas, saídas e rastreamento de saldo por produto.
                  </p>
                </div>
              </Link>
            )}

            {canAccessPage(usuario?.perfil, 'financeiro') && (
              <Link
                to="/app/financeiro"
                className="p-3.5 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/30 transition-all flex items-start gap-3 group"
              >
                <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-900">
                    Contas a Receber / Pagar
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Fluxo de caixa, baixas e títulos a vencer.
                  </p>
                </div>
              </Link>
            )}
          </CardContent>
        </Card>

        {/* System Information Card */}
        <Card className="border border-slate-200 bg-white shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-base font-bold text-slate-900">Dados da Empresa</CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Escopo seguro e autenticado
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Razão Social:</span>
              <span className="font-semibold text-slate-800 text-right">
                {empresa?.nome || 'N/A'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
              <span className="text-slate-500">CNPJ:</span>
              <span className="font-mono text-slate-700">{empresa?.cnpj || 'Não informado'}</span>
            </div>
            <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Perfil de Acesso:</span>
              <span className="font-bold text-teal-700 uppercase">
                {usuario?.perfil || 'vendedor'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Status Empresa:</span>
              <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Ativa
              </span>
            </div>
            {canAccessPage(usuario?.perfil, 'configuracoes') && (
              <div className="pt-2">
                <Link to="/app/configuracoes">
                  <Button
                    variant="outline"
                    className="w-full text-xs text-slate-700 hover:bg-slate-50"
                  >
                    Ver Detalhes da Conta
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
