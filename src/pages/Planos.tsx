import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2,
  ArrowRight,
  Loader2,
  AlertCircle,
  Check,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  ShoppingCart,
  Users,
  Package,
  Boxes,
  ClipboardList,
  DollarSign,
  BarChart3,
  Percent,
  UserCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { useAuth } from '@/hooks/use-auth'
import { AssinaturasService, Plano } from '@/services/assinaturas'

export default function PlanosPage() {
  const { user } = useAuth()
  const [planos, setPlanos] = useState<Plano[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPlanos = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await AssinaturasService.listPlanos()
      if (err) throw err
      if (data && data.length > 0) {
        setPlanos(data)
      } else {
        setError('Nenhum plano disponível no momento.')
      }
    } catch {
      setError('Não foi possível carregar os planos. Verifique sua conexão e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPlanos()
  }, [])

  const beneficios = [
    {
      icon: ShoppingCart,
      titulo: 'Gestão de vendas',
      descricao: 'Fechamento ágil de vendas, múltiplos formatos e controle de descontos.',
    },
    {
      icon: Users,
      titulo: 'Cadastro de clientes',
      descricao: 'Organização completa de contatos, limites de crédito e histórico de compras.',
    },
    {
      icon: Package,
      titulo: 'Catálogo de produtos',
      descricao: 'Categorias, códigos de barras, precificação e imagens de produtos.',
    },
    {
      icon: Boxes,
      titulo: 'Controle de estoque',
      descricao: 'Entradas, saídas, movimentações detalhadas e alertas de estoque mínimo.',
    },
    {
      icon: ClipboardList,
      titulo: 'Pedidos e orçamentos',
      descricao: 'Emissão e conversão rápida de pedidos de venda em faturamento real.',
    },
    {
      icon: DollarSign,
      titulo: 'Financeiro',
      descricao: 'Contas a pagar e receber integradas, fluxo de caixa e controle de liquidações.',
    },
    {
      icon: BarChart3,
      titulo: 'Relatórios gerenciais',
      descricao: 'Métricas de desempenho, faturamento e relatórios detalhados de lucro.',
    },
    {
      icon: Percent,
      titulo: 'Comissões',
      descricao: 'Cálculo automático e transparente de comissões por vendedor.',
    },
    {
      icon: UserCheck,
      titulo: 'Controle de usuários',
      descricao: 'Permissões por perfil (Master, Administrador, Gerente, Vendedor, Operador).',
    },
    {
      icon: Building2,
      titulo: 'Multiempresa',
      descricao: 'Arquitetura com isolamento total e segurança de dados para distribuidoras.',
    },
  ]

  const faqs = [
    {
      pergunta: 'Como funciona o período de teste?',
      resposta:
        'Você tem 14 dias gratuitos para testar todas as funcionalidades do plano escolhido. Não é necessário cadastrar cartão de crédito.',
    },
    {
      pergunta: 'Posso mudar de plano?',
      resposta:
        'Durante o período de teste, você pode entrar em contato conosco para avaliar a migração.',
    },
    {
      pergunta: 'Meus dados ficam seguros?',
      resposta: 'Sim. Cada empresa tem seu ambiente isolado com as melhores práticas de segurança.',
    },
    {
      pergunta: 'O que acontece quando o período de teste termina?',
      resposta:
        'O sistema entra em modo somente leitura. Todos os seus dados permanecem preservados.',
    },
    {
      pergunta: 'Posso cancelar?',
      resposta: 'O cancelamento estará disponível em breve na área de Configurações.',
    },
  ]

  const formatPrice = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(Number(val || 0))
  }

  return (
    <div className="min-h-screen bg-[#0E1B2C] text-slate-100 flex flex-col selection:bg-teal-500 selection:text-slate-950 font-sans">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-[#0E1B2C]/90 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link
            to="/planos"
            className="flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 rounded-lg group"
          >
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center shadow-lg shadow-teal-950/50 border border-teal-400/20 group-hover:scale-105 transition-transform duration-200">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-white font-sans">
                EVO Gestão
              </span>
              <span className="text-[10px] text-teal-400 font-semibold tracking-wider uppercase">
                Distribuidoras
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3 sm:gap-4">
            <Button
              asChild
              variant="outline"
              className="border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800 hover:text-white transition-all text-sm h-10 px-4 rounded-lg cursor-pointer"
            >
              <Link to="/auth">Entrar</Link>
            </Button>
            <Button
              asChild
              className="bg-teal-600 hover:bg-teal-500 text-white font-semibold transition-all shadow-lg shadow-teal-950/40 text-sm h-10 px-5 rounded-lg cursor-pointer group"
            >
              <Link to="/setup" className="flex items-center gap-2">
                <span>Começar agora</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-16 pb-12 sm:pt-24 sm:pb-16 overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 -right-32 w-80 h-80 bg-teal-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center relative z-10 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-950/80 border border-teal-500/30 text-teal-300 text-xs font-semibold mb-6 shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            <span>14 dias grátis em todos os planos — Sem cartão de crédito</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.15]">
            Escolha o plano ideal para sua empresa
          </h1>

          <p className="mt-5 text-base sm:text-lg md:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed font-normal">
            Gestão completa para distribuidoras com período de teste gratuito. Comece agora e
            transforme a operação da sua empresa.
          </p>
        </div>
      </section>

      {/* PRICING CARDS SECTION */}
      <section className="relative pb-20 sm:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 bg-slate-900/50 rounded-2xl border border-slate-800">
              <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
              <p className="text-sm text-slate-400">Carregando planos disponíveis...</p>
            </div>
          ) : error ? (
            <div className="max-w-xl mx-auto p-6 rounded-2xl bg-red-950/40 border border-red-800/60 text-center space-y-4">
              <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
              <p className="text-sm text-red-200">{error}</p>
              <Button
                variant="outline"
                onClick={fetchPlanos}
                className="border-red-700 bg-red-950/60 hover:bg-red-900 text-red-100 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Tentar novamente
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch pt-4 animate-fade-in-up">
              {planos.map((plano) => {
                const isRecomendado = plano.slug === 'profissional'
                const diasTeste = plano.periodo_teste_dias ?? 14
                const linkDestino = user
                  ? `/checkout?plano=${plano.slug || 'profissional'}`
                  : `/checkout?plano=${plano.slug || 'profissional'}`

                let recursosList: string[] = []
                if (Array.isArray(plano.recursos)) {
                  recursosList = plano.recursos as string[]
                } else if (typeof plano.recursos === 'object' && plano.recursos !== null) {
                  recursosList = Object.values(plano.recursos).filter(
                    (v): v is string => typeof v === 'string',
                  )
                }

                return (
                  <div
                    key={plano.id}
                    className={`relative rounded-2xl flex flex-col justify-between transition-all duration-300 ${
                      isRecomendado
                        ? 'bg-slate-900/95 border-2 border-teal-500 shadow-2xl shadow-teal-950/80 lg:-translate-y-2'
                        : 'bg-slate-900/90 border border-slate-800 hover:border-slate-700 shadow-xl'
                    }`}
                  >
                    {/* Badge Recomendado */}
                    {isRecomendado && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-20">
                        <Badge className="bg-teal-500 hover:bg-teal-500 text-slate-950 font-extrabold text-xs px-3.5 py-1 uppercase tracking-wider shadow-lg shadow-teal-950/60 border-0">
                          Recomendado
                        </Badge>
                      </div>
                    )}

                    {/* Card Content Top */}
                    <div className="p-6 sm:p-8">
                      {/* Header do Card */}
                      <div className="space-y-2">
                        <h3 className="text-2xl font-bold text-white tracking-tight">
                          {plano.nome}
                        </h3>
                        {plano.descricao && (
                          <p className="text-xs sm:text-sm text-slate-400 min-h-[40px] leading-relaxed">
                            {plano.descricao}
                          </p>
                        )}
                      </div>

                      {/* Preço e Período de Teste */}
                      <div className="mt-6 pt-6 border-t border-slate-800">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                            {formatPrice(plano.valor_mensal)}
                          </span>
                          <span className="text-sm font-medium text-slate-400">/mês</span>
                        </div>
                        <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                          <Check className="w-3.5 h-3.5" />
                          <span>{diasTeste} dias grátis</span>
                        </div>
                      </div>

                      {/* Limites do Plano */}
                      <div className="mt-6 pt-6 border-t border-slate-800 space-y-2.5">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Limites operacionais
                        </p>
                        <ul className="space-y-2 text-sm text-slate-300">
                          <li className="flex items-center justify-between py-1 border-b border-slate-800/60">
                            <span className="text-slate-400">Usuários</span>
                            <span className="font-semibold text-white">
                              {plano.limite_usuarios != null ? plano.limite_usuarios : 'Ilimitado'}
                            </span>
                          </li>
                          <li className="flex items-center justify-between py-1 border-b border-slate-800/60">
                            <span className="text-slate-400">Vendedores</span>
                            <span className="font-semibold text-white">
                              {plano.limite_vendedores != null
                                ? plano.limite_vendedores
                                : 'Ilimitado'}
                            </span>
                          </li>
                          <li className="flex items-center justify-between py-1 border-b border-slate-800/60">
                            <span className="text-slate-400">Produtos</span>
                            <span className="font-semibold text-white">
                              {plano.limite_produtos != null ? plano.limite_produtos : 'Ilimitado'}
                            </span>
                          </li>
                          <li className="flex items-center justify-between py-1 border-b border-slate-800/60">
                            <span className="text-slate-400">Clientes</span>
                            <span className="font-semibold text-white">
                              {plano.limite_clientes != null ? plano.limite_clientes : 'Ilimitado'}
                            </span>
                          </li>
                          <li className="flex items-center justify-between py-1">
                            <span className="text-slate-400">Vendas/mês</span>
                            <span className="font-semibold text-white">
                              {plano.limite_vendas_mes != null
                                ? plano.limite_vendas_mes
                                : 'Ilimitado'}
                            </span>
                          </li>
                        </ul>
                      </div>

                      {/* Recursos do Plano */}
                      {recursosList.length > 0 && (
                        <div className="mt-6 pt-6 border-t border-slate-800 space-y-3">
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            Recursos inclusos
                          </p>
                          <ul className="space-y-2.5">
                            {recursosList.map((rec, rIdx) => (
                              <li
                                key={rIdx}
                                className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-300"
                              >
                                <ShieldCheck className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                                <span className="leading-tight">{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Botão de Ação CTA */}
                    <div className="p-6 sm:p-8 pt-0">
                      <Button
                        asChild
                        className={`w-full h-12 text-sm font-bold rounded-xl shadow-lg transition-all duration-200 cursor-pointer ${
                          isRecomendado
                            ? 'bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-teal-950/70 hover:shadow-teal-900/80'
                            : 'bg-teal-600 hover:bg-teal-500 text-white shadow-teal-950/40'
                        }`}
                      >
                        <Link to={linkDestino} className="flex items-center justify-center gap-2">
                          <span>Começar agora</span>
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      </Button>
                      <p className="mt-2.5 text-center text-[11px] text-slate-500">
                        {diasTeste} dias grátis • Sem compromisso
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* BENEFÍCIOS SECTION */}
      <section className="relative py-20 bg-slate-900/50 border-y border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-950/60 border border-teal-500/20 text-teal-300 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5 text-teal-400" />
              <span>Funcionalidades completas</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              Todos os planos incluem
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-400">
              Tudo o que sua distribuidora precisa para operar com eficiência máxima e controle
              total desde o primeiro dia.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
            {beneficios.map((beneficio, bIdx) => {
              const Icon = beneficio.icon
              return (
                <div
                  key={bIdx}
                  className="bg-slate-900/80 border border-slate-800 hover:border-teal-500/40 p-5 rounded-xl transition-all duration-200 hover:-translate-y-1 shadow-md flex flex-col group"
                >
                  <div className="h-10 w-10 rounded-lg bg-teal-950/70 border border-teal-500/20 flex items-center justify-center text-teal-400 group-hover:bg-teal-500 group-hover:text-slate-950 transition-colors mb-3.5">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1.5">{beneficio.titulo}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed font-normal">
                    {beneficio.descricao}
                  </p>
                </div>
              )
            })}
          </div>

          {/* TABELA COMPARATIVA DE LIMITES */}
          <div className="mt-20">
            <div className="text-center max-w-2xl mx-auto mb-8">
              <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Comparativo de Limites Operacionais
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-400">
                Veja detalhadamente a capacidade de cada versão para escalar sua distribuidora.
              </p>
            </div>

            {(() => {
              const planoBasico = planos.find((p) => p.slug === 'basico')
              const planoProfissional = planos.find((p) => p.slug === 'profissional')
              const planoEmpresarial = planos.find((p) => p.slug === 'empresarial')

              const formatLim = (val: number | null | undefined) =>
                val === null || val === undefined ? 'Ilimitado' : val.toLocaleString('pt-BR')

              const linhas = [
                {
                  recurso: 'Usuários no Sistema',
                  basico: formatLim(planoBasico?.limite_usuarios),
                  profissional: formatLim(planoProfissional?.limite_usuarios),
                  empresarial: formatLim(planoEmpresarial?.limite_usuarios),
                },
                {
                  recurso: 'Vendedores',
                  basico: formatLim(planoBasico?.limite_vendedores),
                  profissional: formatLim(planoProfissional?.limite_vendedores),
                  empresarial: formatLim(planoEmpresarial?.limite_vendedores),
                },
                {
                  recurso: 'Produtos Ativos',
                  basico: formatLim(planoBasico?.limite_produtos),
                  profissional: formatLim(planoProfissional?.limite_produtos),
                  empresarial: formatLim(planoEmpresarial?.limite_produtos),
                },
                {
                  recurso: 'Clientes Cadastrados',
                  basico: formatLim(planoBasico?.limite_clientes),
                  profissional: formatLim(planoProfissional?.limite_clientes),
                  empresarial: formatLim(planoEmpresarial?.limite_clientes),
                },
                {
                  recurso: 'Vendas por Mês',
                  basico: formatLim(planoBasico?.limite_vendas_mes),
                  profissional: formatLim(planoProfissional?.limite_vendas_mes),
                  empresarial: formatLim(planoEmpresarial?.limite_vendas_mes),
                },
                {
                  recurso: 'Preço Mensal',
                  basico: formatPrice(planoBasico?.valor_mensal),
                  profissional: formatPrice(planoProfissional?.valor_mensal),
                  empresarial: formatPrice(planoEmpresarial?.valor_mensal),
                  isPrice: true,
                },
              ]

              return (
                <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/70">
                        <th className="py-4 px-6 font-bold text-white text-xs uppercase tracking-wider w-1/4">
                          Recurso
                        </th>
                        <th className="py-4 px-6 font-bold text-slate-300 text-center text-xs uppercase tracking-wider w-1/4">
                          Básico
                        </th>
                        <th className="py-4 px-6 font-extrabold text-teal-400 text-center text-xs uppercase tracking-wider w-1/4 bg-teal-950/40 border-x border-teal-500/30">
                          Profissional (Mais Popular)
                        </th>
                        <th className="py-4 px-6 font-bold text-slate-300 text-center text-xs uppercase tracking-wider w-1/4">
                          Empresarial
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {linhas.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3.5 px-6 text-slate-300 font-medium text-xs sm:text-sm">
                            {row.recurso}
                          </td>
                          <td className="py-3.5 px-6 text-slate-400 text-center text-xs sm:text-sm">
                            {row.basico}
                          </td>
                          <td className="py-3.5 px-6 text-center text-xs sm:text-sm font-semibold text-white bg-teal-950/20 border-x border-teal-500/20">
                            {row.profissional}
                          </td>
                          <td className="py-3.5 px-6 text-slate-400 text-center text-xs sm:text-sm">
                            {row.empresarial}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })()}
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section className="relative py-20 bg-slate-900/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              Dúvidas frequentes
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-400">
              Tudo o que você precisa saber sobre nossos planos e o período de testes.
            </p>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
            <Accordion type="single" collapsible className="w-full space-y-4">
              {faqs.map((faq, index) => (
                <AccordionItem
                  key={index}
                  value={`item-${index}`}
                  className="border-b border-slate-800 last:border-0 pb-3"
                >
                  <AccordionTrigger className="text-left text-sm sm:text-base font-semibold text-slate-200 hover:text-teal-400 transition-colors py-3 hover:no-underline cursor-pointer">
                    {faq.pergunta}
                  </AccordionTrigger>
                  <AccordionContent className="text-xs sm:text-sm text-slate-400 leading-relaxed pt-1 pb-3">
                    {faq.resposta}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          {/* Call to action inside FAQ bottom */}
          <div className="mt-12 text-center p-8 rounded-2xl bg-gradient-to-r from-teal-950/40 via-slate-900/80 to-teal-950/40 border border-teal-500/20">
            <h3 className="text-lg sm:text-xl font-bold text-white mb-2">
              Pronto para transformar sua distribuidora?
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto mb-5">
              Crie sua conta agora e aproveite os 14 dias gratuitos com acesso total.
            </p>
            <Button
              asChild
              className="bg-teal-600 hover:bg-teal-500 text-white font-semibold h-11 px-6 rounded-lg shadow-lg shadow-teal-950/50 cursor-pointer"
            >
              <Link to="/setup" className="flex items-center gap-2">
                <span>Criar minha conta</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mt-auto border-t border-slate-800 bg-[#0E1B2C] py-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-teal-400" />
            <span className="font-semibold text-slate-300">EVO Gestão</span>
          </div>
          <p>
            EVO Gestão © {new Date().getFullYear()} — Plataforma Multiempresa para Distribuidoras
          </p>
          <div className="flex items-center gap-4 text-slate-400">
            <Link to="/auth" className="hover:text-teal-400 transition-colors">
              Área do cliente
            </Link>
            <Link to="/setup" className="hover:text-teal-400 transition-colors">
              Criar empresa
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
