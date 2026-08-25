import { useState, useEffect, useCallback } from 'react'
import {
  PageHeader,
  MetricCard,
  TableSkeleton,
  EmptyState,
  ErrorState,
} from '@/components/common/CommonUI'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useEmpresa } from '@/hooks/use-empresa'
import { useAuth } from '@/hooks/use-auth'
import {
  DollarSign,
  ShoppingCart,
  Package,
  Users,
  AlertTriangle,
  CheckCircle2,
  Boxes,
  ArrowRight,
  RefreshCw,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { canAccessPage } from '@/lib/permissions'
import { supabase } from '@/lib/supabase/client'
import { VendasService } from '@/services/vendas'
import { ClientesService } from '@/services/clientes'
import { ProdutosService } from '@/services/produtos'
import { EstoqueService } from '@/services/estoque'

interface VendaRecente {
  id: string
  numero: number | null
  total: number
  forma_pagamento: string | null
  status: string
  created_at: string
  clientes?: {
    nome: string
  } | null
}

interface ItemEstoqueBaixo {
  quantidade: number
  produtos: {
    nome: string
    estoque_minimo: number
    unidade: string
  }
}

interface DashboardData {
  faturamentoMes: number
  vendasMesCount: number
  clientesAtivosCount: number
  produtosAtivosCount: number
  estoqueBaixoCount: number
  vendasRecentes: VendaRecente[]
  estoqueBaixoItens: ItemEstoqueBaixo[]
}

export default function DashboardPage() {
  const { empresaId, empresa } = useEmpresa()
  const { usuario } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<DashboardData>({
    faturamentoMes: 0,
    vendasMesCount: 0,
    clientesAtivosCount: 0,
    produtosAtivosCount: 0,
    estoqueBaixoCount: 0,
    vendasRecentes: [],
    estoqueBaixoItens: [],
  })

  const loadDashboardData = useCallback(async () => {
    if (!empresaId) return
    setLoading(true)
    setError(null)

    try {
      let resolvedVendedorId: string | null = null
      if (usuario?.perfil === 'vendedor') {
        const { data: vendedorData } = await supabase
          .from('vendedores')
          .select('id')
          .eq('empresa_id', empresaId)
          .eq('usuario_id', usuario.id)
          .maybeSingle()

        resolvedVendedorId = vendedorData?.id || '00000000-0000-0000-0000-000000000000'
      }

      const [
        faturamentoRes,
        vendasCountRes,
        clientesCountRes,
        produtosCountRes,
        estoqueBaixoRes,
        vendasRecentesRes,
      ] = await Promise.all([
        VendasService.getFaturamentoMensal(empresaId, resolvedVendedorId),
        VendasService.getCountMensal(empresaId, resolvedVendedorId),
        ClientesService.countAtivos(empresaId),
        ProdutosService.countAtivos(empresaId),
        EstoqueService.listEstoqueBaixo(empresaId),
        VendasService.getRecentes(empresaId, resolvedVendedorId),
      ])

      // Verifica se houve erro em alguma das chamadas
      if (faturamentoRes.error) throw faturamentoRes.error
      if (vendasCountRes.error) throw vendasCountRes.error
      if (clientesCountRes.error) throw clientesCountRes.error
      if (produtosCountRes.error) throw produtosCountRes.error
      if (estoqueBaixoRes.error) throw estoqueBaixoRes.error
      if (vendasRecentesRes.error) throw vendasRecentesRes.error

      const totalFaturado = (faturamentoRes.data || []).reduce(
        (acc: number, curr: { total: number }) => acc + (curr.total || 0),
        0,
      )

      const estoqueBaixoList = (estoqueBaixoRes.data || []) as unknown as ItemEstoqueBaixo[]
      const vendasRecentesList = (vendasRecentesRes.data || []) as unknown as VendaRecente[]

      setData({
        faturamentoMes: totalFaturado,
        vendasMesCount: vendasCountRes.count ?? 0,
        clientesAtivosCount: clientesCountRes.count ?? 0,
        produtosAtivosCount: produtosCountRes.count ?? 0,
        estoqueBaixoCount: estoqueBaixoList.length,
        vendasRecentes: vendasRecentesList,
        estoqueBaixoItens: estoqueBaixoList,
      })
    } catch (err: any) {
      console.error('Erro ao carregar dados do dashboard:', err)
      setError(
        err?.message || 'Falha ao buscar dados do Supabase. Verifique sua conexão e permissões.',
      )
    } finally {
      setLoading(false)
    }
  }, [empresaId, usuario?.perfil, usuario?.id])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  }

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(d)
    } catch {
      return dateStr
    }
  }

  const formatFormaPagamento = (fp?: string | null) => {
    if (!fp) return '—'
    const mapa: Record<string, string> = {
      dinheiro: 'Dinheiro',
      pix: 'PIX',
      cartao_credito: 'Cartão de Crédito',
      cartao_debito: 'Cartão de Débito',
      boleto: 'Boleto',
      a_prazo: 'A Prazo',
      prazo: 'A Prazo',
    }
    return mapa[fp.toLowerCase()] || fp.toUpperCase()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visão Geral"
        description={`Bem-vindo de volta, ${usuario?.nome || 'Usuário'}. Aqui está o resumo comercial da ${
          empresa?.nome_fantasia || empresa?.nome || 'sua distribuidora'
        }.`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadDashboardData()}
              disabled={loading}
              className="text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            {canAccessPage(usuario?.perfil, 'vendas') && (
              <Link to="/app/vendas">
                <Button className="bg-teal-700 hover:bg-teal-800 text-white flex items-center gap-1.5 shadow-sm">
                  <ShoppingCart className="w-4 h-4" />
                  Nova Venda
                </Button>
              </Link>
            )}
          </div>
        }
      />

      {error ? (
        <ErrorState
          title="Erro ao carregar o Dashboard"
          message={error}
          onRetry={loadDashboardData}
        />
      ) : (
        <>
          {/* 5 KPI Cards (Responsive Grid: 1 col mobile, 2 sm, 4 lg - 5th card spans nicely) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {loading ? (
              <>
                <Card className="rounded-xl border border-slate-200 bg-white p-4">
                  <TableSkeleton rows={2} cols={2} />
                </Card>
                <Card className="rounded-xl border border-slate-200 bg-white p-4">
                  <TableSkeleton rows={2} cols={2} />
                </Card>
                <Card className="rounded-xl border border-slate-200 bg-white p-4">
                  <TableSkeleton rows={2} cols={2} />
                </Card>
                <Card className="rounded-xl border border-slate-200 bg-white p-4">
                  <TableSkeleton rows={2} cols={2} />
                </Card>
                <Card className="rounded-xl border border-slate-200 bg-white p-4 sm:col-span-2 lg:col-span-4">
                  <TableSkeleton rows={2} cols={2} />
                </Card>
              </>
            ) : (
              <>
                {/* 1. Faturamento do mês */}
                <MetricCard
                  title="Faturamento do mês"
                  value={formatCurrency(data.faturamentoMes)}
                  subtitle="Vendas finalizadas no mês atual"
                  icon={DollarSign}
                />

                {/* 2. Vendas do mês */}
                <MetricCard
                  title="Vendas do mês"
                  value={`${data.vendasMesCount}`}
                  subtitle="Finalizadas no mês atual"
                  icon={ShoppingCart}
                />

                {/* 3. Clientes ativos */}
                <MetricCard
                  title="Clientes ativos"
                  value={`${data.clientesAtivosCount}`}
                  subtitle="Cadastrados e habilitados"
                  icon={Users}
                />

                {/* 4. Produtos cadastrados */}
                <MetricCard
                  title="Produtos cadastrados"
                  value={`${data.produtosAtivosCount}`}
                  subtitle="Itens ativos no catálogo"
                  icon={Package}
                />

                {/* 5. Estoque baixo */}
                <Card
                  className={`rounded-xl border shadow-xs hover:shadow-md transition-shadow ${
                    data.estoqueBaixoCount > 0
                      ? 'border-amber-200 bg-amber-50/20'
                      : 'border-slate-200 bg-white'
                  } sm:col-span-2 lg:col-span-4`}
                >
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle
                      className={`text-xs font-semibold uppercase tracking-wider ${
                        data.estoqueBaixoCount > 0 ? 'text-amber-800' : 'text-slate-500'
                      }`}
                    >
                      Estoque baixo
                    </CardTitle>
                    <div
                      className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                        data.estoqueBaixoCount > 0
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-teal-50 text-teal-700'
                      }`}
                    >
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div
                      className={`text-2xl font-bold tracking-tight tabular-nums ${
                        data.estoqueBaixoCount > 0 ? 'text-amber-700' : 'text-slate-900'
                      }`}
                    >
                      {data.estoqueBaixoCount}{' '}
                      <span className="text-sm font-normal text-slate-500">
                        {data.estoqueBaixoCount === 1
                          ? 'item no limite'
                          : 'itens no limite ou abaixo'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {data.estoqueBaixoCount > 0
                        ? 'Requer reposição imediata junto aos fornecedores'
                        : 'Todos os produtos estão com níveis regulares de estoque'}
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Seções "Vendas Recentes" e "Estoque Baixo" (lado a lado no lg) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Seção Vendas Recentes */}
            <Card className="border border-slate-200 bg-white shadow-xs flex flex-col">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900">
                      Vendas Recentes
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Últimas 5 vendas finalizadas
                    </CardDescription>
                  </div>
                  {canAccessPage(usuario?.perfil, 'vendas') && (
                    <Link to="/app/vendas">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-teal-700 hover:text-teal-800 hover:bg-teal-50 text-xs flex items-center gap-1"
                      >
                        Ver todas
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-4 flex-1">
                {loading ? (
                  <TableSkeleton rows={5} cols={4} />
                ) : data.vendasRecentes.length === 0 ? (
                  <EmptyState
                    icon={ShoppingCart}
                    title="Nenhuma venda recente"
                    description="Nenhuma venda finalizada este mês. Novas vendas registradas aparecerão automaticamente aqui."
                    actionLabel={
                      canAccessPage(usuario?.perfil, 'vendas') ? 'Criar Primeira Venda' : undefined
                    }
                    onAction={
                      canAccessPage(usuario?.perfil, 'vendas')
                        ? () => window.location.assign('/app/vendas')
                        : undefined
                    }
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 uppercase font-semibold">
                          <th className="pb-2 font-medium">Nº</th>
                          <th className="pb-2 font-medium">Cliente</th>
                          <th className="pb-2 font-medium">Pagamento</th>
                          <th className="pb-2 font-medium">Data</th>
                          <th className="pb-2 font-medium text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.vendasRecentes.map((venda) => (
                          <tr key={venda.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2.5 font-mono text-slate-600">
                              {venda.numero != null ? `#${venda.numero}` : '—'}
                            </td>
                            <td className="py-2.5 font-medium text-slate-900">
                              {venda.clientes?.nome || 'Cliente não identificado'}
                            </td>
                            <td className="py-2.5 text-slate-600">
                              <Badge
                                variant="outline"
                                className="text-[11px] font-normal border-slate-200 bg-slate-50"
                              >
                                {formatFormaPagamento(venda.forma_pagamento)}
                              </Badge>
                            </td>
                            <td className="py-2.5 text-slate-500 whitespace-nowrap">
                              {formatDate(venda.created_at)}
                            </td>
                            <td className="py-2.5 font-bold text-slate-900 text-right whitespace-nowrap">
                              {formatCurrency(venda.total || 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Seção Estoque Baixo */}
            <Card className="border border-slate-200 bg-white shadow-xs flex flex-col">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900">
                      Estoque Baixo
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Produtos abaixo ou no limite mínimo
                    </CardDescription>
                  </div>
                  {canAccessPage(usuario?.perfil, 'estoque') && (
                    <Link to="/app/estoque">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-teal-700 hover:text-teal-800 hover:bg-teal-50 text-xs flex items-center gap-1"
                      >
                        Gerenciar estoque
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-4 flex-1">
                {loading ? (
                  <TableSkeleton rows={5} cols={4} />
                ) : data.estoqueBaixoItens.length === 0 ? (
                  <EmptyState
                    icon={CheckCircle2}
                    title="Estoque em dia"
                    description="Todos os produtos estão com estoque adequado."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 uppercase font-semibold">
                          <th className="pb-2 font-medium">Produto</th>
                          <th className="pb-2 font-medium text-center">Mínimo</th>
                          <th className="pb-2 font-medium text-right">Atual</th>
                          <th className="pb-2 font-medium text-right">Situação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.estoqueBaixoItens.map((item, idx) => {
                          const isZero = (item.quantidade ?? 0) <= 0
                          return (
                            <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-2.5 font-medium text-slate-900">
                                {item.produtos?.nome || 'Produto sem nome'}
                              </td>
                              <td className="py-2.5 text-center text-slate-500 font-mono">
                                {item.produtos?.estoque_minimo ?? 0}{' '}
                                {item.produtos?.unidade || 'UN'}
                              </td>
                              <td
                                className={`py-2.5 text-right font-mono font-bold ${
                                  isZero ? 'text-red-600' : 'text-amber-600'
                                }`}
                              >
                                {item.quantidade ?? 0} {item.produtos?.unidade || 'UN'}
                              </td>
                              <td className="py-2.5 text-right whitespace-nowrap">
                                {isZero ? (
                                  <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] hover:bg-red-100 font-semibold">
                                    Zerado
                                  </Badge>
                                ) : (
                                  <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] hover:bg-amber-100 font-semibold">
                                    Abaixo do Mín.
                                  </Badge>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Atalhos Rápidos & Dados da Empresa */}
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
                <CardTitle className="text-base font-bold text-slate-900">
                  Dados da Empresa
                </CardTitle>
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
                  <span className="font-mono text-slate-700">
                    {empresa?.cnpj || 'Não informado'}
                  </span>
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
        </>
      )}
    </div>
  )
}
