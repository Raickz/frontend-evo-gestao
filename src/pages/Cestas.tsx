import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useEmpresa } from '@/hooks/use-empresa'
import { useAuth } from '@/hooks/use-auth'
import { CestasService, CestaItem, CestaComposicaoItemInput } from '@/services/cestas'
import { PageHeader } from '@/components/common/CommonUI'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency, formatApiError } from '@/lib/utils'
import { toast } from 'sonner'
import {
  ShoppingBag,
  Plus,
  Search,
  Layers,
  Edit,
  History,
  Info,
  DollarSign,
  TrendingUp,
  Boxes,
  Loader2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  X,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useNavigate } from 'react-router-dom'

interface ComponenteOption {
  id: string
  nome: string
  codigo: string | null
  unidade: string
  preco_custo: number
  estoque_atual: number
}

export default function CestasPage() {
  const { empresaId, moduloCestas } = useEmpresa()
  const { usuario } = useAuth()
  const navigate = useNavigate()

  const [cestas, setCestas] = useState<CestaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [componentes, setComponentes] = useState<ComponenteOption[]>([])

  // Modal Composição State
  const [modalComposicaoOpen, setModalComposicaoOpen] = useState(false)
  const [cestaSelecionada, setCestaSelecionada] = useState<CestaItem | null>(null)
  const [itensComposicao, setItensComposicao] = useState<
    Array<{
      componente_produto_id: string
      quantidade: number
      unidade: string
      nome?: string
      preco_custo?: number
      estoque_atual?: number
    }>
  >([])
  const [custoAdicional, setCustoAdicional] = useState('0')
  const [observacoesComp, setObservacoesComp] = useState('')
  const [salvandoComp, setSalvandoComp] = useState(false)

  // Modal Histórico
  const [modalHistoricoOpen, setModalHistoricoOpen] = useState(false)
  const [historicoVersoes, setHistoricoVersoes] = useState<any[]>([])
  const [loadingHistorico, setLoadingHistorico] = useState(false)

  const podeGerenciar =
    usuario?.perfil === 'master' || usuario?.perfil === 'admin' || usuario?.perfil === 'gerente'

  const carregarCestas = useCallback(async () => {
    if (!empresaId) return
    setLoading(true)
    try {
      const data = await CestasService.listCestas(empresaId, search)
      setCestas(data)
    } catch (err: any) {
      toast.error(formatApiError(err))
    } finally {
      setLoading(false)
    }
  }, [empresaId, search])

  const carregarComponentes = useCallback(async () => {
    if (!empresaId) return
    try {
      const comps = await CestasService.listComponentesDisponiveis(empresaId)
      setComponentes(comps)
    } catch (err: any) {
      if (import.meta.env.DEV) console.error('Erro ao carregar componentes:', err)
    }
  }, [empresaId])

  useEffect(() => {
    carregarCestas()
    carregarComponentes()
  }, [carregarCestas, carregarComponentes])

  // Abrir modal de Composição
  const handleAbrirComposicao = (cesta: CestaItem) => {
    setCestaSelecionada(cesta)
    if (cesta.composicao_ativa) {
      setItensComposicao(
        cesta.composicao_ativa.itens.map((it) => ({
          componente_produto_id: it.componente_produto_id,
          quantidade: it.quantidade,
          unidade: it.unidade,
          nome: it.componente.nome,
          preco_custo: it.componente.preco_custo,
        })),
      )
      setCustoAdicional(String(cesta.composicao_ativa.custo_adicional || 0))
      setObservacoesComp(cesta.composicao_ativa.observacoes || '')
    } else {
      setItensComposicao([])
      setCustoAdicional('0')
      setObservacoesComp('')
    }
    setModalComposicaoOpen(true)
  }

  // Abrir Histórico de Versões
  const handleAbrirHistorico = async (cesta: CestaItem) => {
    if (!empresaId) return
    setCestaSelecionada(cesta)
    setModalHistoricoOpen(true)
    setLoadingHistorico(true)
    try {
      const hist = await CestasService.listHistoricoComposicoes(empresaId, cesta.id)
      setHistoricoVersoes(hist)
    } catch (err: any) {
      toast.error(formatApiError(err))
    } finally {
      setLoadingHistorico(false)
    }
  }

  // Adicionar item à composição em edição
  const handleAdicionarComponente = (componenteId: string) => {
    const comp = componentes.find((c) => c.id === componenteId)
    if (!comp) return

    setItensComposicao((prev) => {
      const jaExiste = prev.find((it) => it.componente_produto_id === componenteId)
      if (jaExiste) return prev
      return [
        ...prev,
        {
          componente_produto_id: comp.id,
          quantidade: 1,
          unidade: comp.unidade || 'UN',
          nome: comp.nome,
          preco_custo: comp.preco_custo,
          estoque_atual: comp.estoque_atual,
        },
      ]
    })
  }

  const handleRemoverItemComposicao = (componenteId: string) => {
    setItensComposicao((prev) => prev.filter((it) => it.componente_produto_id !== componenteId))
  }

  const handleAlterarQtdItem = (componenteId: string, quantidade: number) => {
    setItensComposicao((prev) =>
      prev.map((it) => (it.componente_produto_id === componenteId ? { ...it, quantidade } : it)),
    )
  }

  // Cálculos da composição em edição
  const calculosEdicao = useMemo(() => {
    const somaComponentes = itensComposicao.reduce((acc, it) => {
      const preco = it.preco_custo || 0
      return acc + (it.quantidade || 0) * preco
    }, 0)

    const adicional = parseFloat(custoAdicional.replace(',', '.')) || 0
    const custoTeorico = somaComponentes + adicional
    const precoVenda = cestaSelecionada?.preco_venda || 0
    const margem = precoVenda - custoTeorico

    return {
      somaComponentes,
      custoTeorico,
      precoVenda,
      margem,
    }
  }, [itensComposicao, custoAdicional, cestaSelecionada])

  // Salvar composição (gera nova versão)
  const handleSalvarComposicao = async () => {
    if (!cestaSelecionada) return

    if (itensComposicao.length === 0) {
      toast.error('Adicione ao menos um componente à cesta.')
      return
    }

    const itemInvalido = itensComposicao.find((it) => !it.quantidade || it.quantidade <= 0)
    if (itemInvalido) {
      toast.error('Todas as quantidades devem ser maiores que zero.')
      return
    }

    const adicionalNum = parseFloat(custoAdicional.replace(',', '.')) || 0
    if (adicionalNum < 0) {
      toast.error('O custo adicional não pode ser negativo.')
      return
    }

    setSalvandoComp(true)
    try {
      const payload: CestaComposicaoItemInput[] = itensComposicao.map((it) => ({
        componente_produto_id: it.componente_produto_id,
        quantidade: it.quantidade,
        unidade: it.unidade,
      }))

      const res = await CestasService.salvarComposicao({
        cesta_produto_id: cestaSelecionada.id,
        custo_adicional: adicionalNum,
        itens: payload,
        observacoes: observacoesComp.trim() || null,
      })

      toast.success(
        `Composição da cesta atualizada! Nova versão ${res.versao} criada com custo teórico de ${formatCurrency(res.custo_total)}.`,
      )
      setModalComposicaoOpen(false)
      await carregarCestas()
    } catch (err: any) {
      toast.error(formatApiError(err))
    } finally {
      setSalvandoComp(false)
    }
  }

  return (
    <div className="space-y-6 pb-20 sm:pb-6">
      <PageHeader
        title="Catálogo de Cestas"
        description="Gestão de cestas básicas prontas, fichas técnicas de composição versionadas e margens de venda."
        badge={
          <span className="flex items-center gap-1.5">
            <ShoppingBag className="w-3.5 h-3.5 text-amber-500" />
            {cestas.length} Cestas Cadastradas
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate('/app/ordens-montagem')}
              variant="outline"
              className="h-10 text-xs gap-1.5 rounded-xl border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-200"
            >
              <Boxes className="w-4 h-4 text-sky-400" />
              Montagem de Cestas
            </Button>
            {podeGerenciar && (
              <Button
                onClick={() => navigate('/app/produtos')}
                className="h-10 text-xs gap-1.5 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Cadastrar Nova Cesta
              </Button>
            )}
          </div>
        }
      />

      {/* Busca */}
      <div className="glass-card p-4 rounded-2xl border border-slate-200/80 dark:border-[#1A294A]">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou código da cesta..."
            className="pl-9 h-10 text-xs rounded-xl bg-slate-50/70 dark:bg-[#0A1328]/50 border-slate-200 dark:border-[#1A294A]"
          />
        </div>
      </div>

      {/* Lista Mobile-First */}
      {loading ? (
        <div className="p-12 text-center flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#0066FF] mb-2" />
          <p className="text-xs text-slate-400">Carregando catálogo de cestas...</p>
        </div>
      ) : cestas.length === 0 ? (
        <div className="p-8 sm:p-12 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
          <ShoppingBag className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-200">Nenhuma cesta cadastrada</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Cadastre os produtos do tipo "Cesta" no menu Produtos para definir suas composições e
            produzir.
          </p>
          {podeGerenciar && (
            <Button
              onClick={() => navigate('/app/produtos')}
              className="mt-4 text-xs h-9 bg-[#0066FF] hover:bg-[#0052CC] text-white rounded-xl"
            >
              Ir para Produtos
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cestas.map((cesta) => {
            const comp = cesta.composicao_ativa
            const custoTeorico = comp
              ? comp.itens.reduce((acc, it) => acc + it.quantidade * it.componente.preco_custo, 0) +
                comp.custo_adicional
              : cesta.preco_custo
            const margem = cesta.preco_venda - custoTeorico

            return (
              <div
                key={cesta.id}
                className="p-4 rounded-2xl border border-slate-200/80 dark:border-[#1A294A] bg-white dark:bg-[#0A1328] flex flex-col justify-between shadow-xs transition-all hover:border-slate-300 dark:hover:border-slate-700"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          <ShoppingBag className="w-4 h-4" />
                        </span>
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                            {cesta.nome}
                          </h4>
                          {cesta.codigo && (
                            <span className="text-[10px] font-mono text-slate-400">
                              {cesta.codigo}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {cesta.estoque_atual} prontas
                      </span>
                    </div>
                  </div>

                  {/* Informações financeiras */}
                  <div className="mt-4 grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 text-center">
                    <div>
                      <p className="text-[10px] text-slate-400 font-medium">Preço Venda</p>
                      <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {formatCurrency(cesta.preco_venda)}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] text-slate-400 font-medium">Custo Teórico</p>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                        {formatCurrency(custoTeorico)}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] text-slate-400 font-medium">Margem Unit.</p>
                      <p
                        className={`text-xs font-bold mt-0.5 ${
                          margem >= 0
                            ? 'text-sky-600 dark:text-sky-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {formatCurrency(margem)}
                      </p>
                    </div>
                  </div>

                  {/* Resumo da composição ativa */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-slate-400 text-[11px] font-medium flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-amber-400" />
                        Composição: {comp ? `Versão ${comp.versao}` : 'Sem composição'}
                      </span>
                      {comp && (
                        <span className="text-[10px] text-slate-500">
                          {comp.itens.length} itens (+ {formatCurrency(comp.custo_adicional)}{' '}
                          outros)
                        </span>
                      )}
                    </div>

                    {comp && comp.itens.length > 0 ? (
                      <div className="max-h-28 overflow-y-auto pr-1 space-y-1 custom-scrollbar">
                        {comp.itens.map((it) => (
                          <div
                            key={it.id}
                            className="flex items-center justify-between text-[11px] py-1 px-2 rounded-lg bg-slate-100/70 dark:bg-slate-950/40 text-slate-300"
                          >
                            <span className="truncate max-w-[150px]">{it.componente.nome}</span>
                            <span className="font-mono text-[10px] text-slate-400 shrink-0">
                              {it.quantidade} {it.unidade}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-amber-400/90 italic p-2 bg-amber-500/10 rounded-lg">
                        ⚠️ Cesta sem receita definida. Adicione a composição para permitir ordens de
                        montagem.
                      </p>
                    )}
                  </div>
                </div>

                {/* Ações */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2">
                  <Button
                    onClick={() => handleAbrirComposicao(cesta)}
                    className="flex-1 h-11 text-xs font-semibold rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 gap-1.5"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    {comp ? 'Editar Composição' : 'Definir Composição'}
                  </Button>

                  <Button
                    onClick={() => handleAbrirHistorico(cesta)}
                    variant="outline"
                    className="h-11 px-3 text-xs rounded-xl border-slate-700 bg-slate-900/40 hover:bg-slate-800 text-slate-300"
                    title="Histórico de Versões"
                  >
                    <History className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal: Editar/Criar Composição (Gera Nova Versão) */}
      <Dialog open={modalComposicaoOpen} onOpenChange={setModalComposicaoOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto bg-slate-950 border-slate-800 text-slate-100 rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-white">
              <ShoppingBag className="w-5 h-5 text-amber-400" />
              Composição da Cesta: {cestaSelecionada?.nome}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Cada alteração salva gera uma <strong className="text-amber-400">nova versão</strong>{' '}
              imutável. Versões antigas e ordens de montagem passadas não sofrem impacto.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Seletor para adicionar componente */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <Label className="text-xs font-semibold text-slate-300">
                Adicionar Componente à Cesta
              </Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  id="select-componente"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAdicionarComponente(e.target.value)
                      e.target.value = ''
                    }
                  }}
                  className="flex-1 h-11 px-3 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="" disabled>
                    Selecione um componente para adicionar...
                  </option>
                  {componentes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} ({c.unidade}) — Custo: {formatCurrency(c.preco_custo)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Lista de itens na composição */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Itens da Composição ({itensComposicao.length})</span>
                <span className="text-[11px] text-slate-400">
                  Subtotal: {formatCurrency(calculosEdicao.somaComponentes)}
                </span>
              </Label>

              {itensComposicao.length === 0 ? (
                <div className="p-6 text-center rounded-xl border border-dashed border-slate-800 text-xs text-slate-500">
                  Nenhum componente adicionado ainda. Escolha no seletor acima.
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                  {itensComposicao.map((it) => (
                    <div
                      key={it.componente_produto_id}
                      className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-200 truncate">{it.nome}</p>
                        <p className="text-[11px] text-slate-400">
                          Custo un.: {formatCurrency(it.preco_custo || 0)} | Total:{' '}
                          {formatCurrency((it.quantidade || 0) * (it.preco_custo || 0))}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1.5">
                          <Label className="text-[11px] text-slate-400">Qtd:</Label>
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="0.001"
                            min="0.001"
                            value={it.quantidade}
                            onChange={(e) =>
                              handleAlterarQtdItem(
                                it.componente_produto_id,
                                parseFloat(e.target.value) || 0,
                              )
                            }
                            className="h-10 w-24 text-center font-mono text-xs rounded-xl bg-slate-950 border-slate-800 text-white"
                          />
                          <span className="text-xs text-slate-400 font-mono">{it.unidade}</span>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoverItemComposicao(it.componente_produto_id)}
                          className="h-10 w-10 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Custo adicional (embalagem, outros) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="space-y-1">
                <Label htmlFor="custo_adicional" className="text-xs font-semibold text-slate-300">
                  Custo Adicional por Cesta (R$)
                </Label>
                <Input
                  id="custo_adicional"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={custoAdicional}
                  onChange={(e) => setCustoAdicional(e.target.value)}
                  placeholder="0.00 (Ex: R$ 4,50 de caixa + fita)"
                  className="h-11 text-xs font-mono rounded-xl bg-slate-900 border-slate-800 text-white"
                />
                <p className="text-[10px] text-slate-500">
                  Embalagem, fitas, encartes ou custos diretos de montagem.
                </p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="obs_comp" className="text-xs font-semibold text-slate-300">
                  Observações da Versão
                </Label>
                <Input
                  id="obs_comp"
                  value={observacoesComp}
                  onChange={(e) => setObservacoesComp(e.target.value)}
                  placeholder="Ex: Troca da marca de feijão na safra nova"
                  className="h-11 text-xs rounded-xl bg-slate-900 border-slate-800 text-white"
                />
              </div>
            </div>

            {/* Resumo financeiro do novo cálculo */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10px] text-slate-400">Preço de Venda</p>
                <p className="text-sm font-black text-emerald-400 mt-0.5">
                  {formatCurrency(calculosEdicao.precoVenda)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400">Novo Custo Teórico</p>
                <p className="text-sm font-black text-white mt-0.5">
                  {formatCurrency(calculosEdicao.custoTeorico)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400">Margem Estimada</p>
                <p
                  className={`text-sm font-black mt-0.5 ${
                    calculosEdicao.margem >= 0 ? 'text-sky-400' : 'text-rose-400'
                  }`}
                >
                  {formatCurrency(calculosEdicao.margem)}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalComposicaoOpen(false)}
              disabled={salvandoComp}
              className="h-11 text-xs rounded-xl border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSalvarComposicao}
              disabled={salvandoComp}
              className="h-11 text-xs font-semibold rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 gap-1.5 shadow-sm"
            >
              {salvandoComp ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Gravando Nova Versão...
                </>
              ) : (
                'Salvar Nova Versão da Composição'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Histórico de Versões */}
      <Dialog open={modalHistoricoOpen} onOpenChange={setModalHistoricoOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-950 border-slate-800 text-slate-100 rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-sky-400" />
              Histórico de Versões: {cestaSelecionada?.nome}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Linha do tempo de todas as formulações já utilizadas nesta cesta básica.
            </DialogDescription>
          </DialogHeader>

          {loadingHistorico ? (
            <div className="p-8 text-center flex flex-col items-center">
              <Loader2 className="w-6 h-6 animate-spin text-sky-400 mb-2" />
              <p className="text-xs text-slate-400">Carregando histórico...</p>
            </div>
          ) : historicoVersoes.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              Nenhuma versão encontrada para esta cesta.
            </div>
          ) : (
            <div className="space-y-3 py-2">
              {historicoVersoes.map((v) => {
                const soma = (v.itens || []).reduce(
                  (acc: number, it: any) =>
                    acc + Number(it.quantidade) * Number(it.componente?.preco_custo || 0),
                  0,
                )
                const custoTotal = soma + Number(v.custo_adicional || 0)

                return (
                  <div
                    key={v.id}
                    className={`p-3.5 rounded-xl border ${
                      v.ativa
                        ? 'border-amber-500/40 bg-amber-500/5'
                        : 'border-slate-800 bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">Versão {v.versao}</span>
                        {v.ativa ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Ativa Atual
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400">
                            Histórica
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {new Date(v.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>

                    <div className="mt-2 text-xs flex items-center justify-between text-slate-400">
                      <span>Custo Adicional: {formatCurrency(v.custo_adicional)}</span>
                      <span className="font-bold text-slate-200">
                        Custo Base: {formatCurrency(custoTotal)}
                      </span>
                    </div>

                    {v.observacoes && (
                      <p className="text-[11px] text-slate-400 italic mt-1 bg-slate-950/40 p-1.5 rounded">
                        "{v.observacoes}"
                      </p>
                    )}

                    <div className="mt-2 pt-2 border-t border-slate-800/80">
                      <p className="text-[10px] text-slate-500 uppercase font-semibold mb-1">
                        Componentes ({v.itens?.length || 0}):
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-slate-300">
                        {(v.itens || []).map((it: any) => (
                          <div key={it.id} className="flex justify-between py-0.5">
                            <span className="truncate pr-2">{it.componente?.nome}</span>
                            <span className="font-mono text-[10px] text-slate-400 shrink-0">
                              {it.quantidade} {it.unidade}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={() => setModalHistoricoOpen(false)}
              className="h-11 w-full sm:w-auto text-xs rounded-xl bg-slate-800 hover:bg-slate-700 text-white"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
