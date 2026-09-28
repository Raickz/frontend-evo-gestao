import React, { useState, useEffect, useCallback } from 'react'
import { useEmpresa } from '@/hooks/use-empresa'
import { useAuth } from '@/hooks/use-auth'
import { CestasService, OrdemMontagemItem, CestaItem } from '@/services/cestas'
import { PageHeader } from '@/components/common/CommonUI'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency, formatApiError } from '@/lib/utils'
import { MobileFab } from '@/components/common/MobileFab'
import { toast } from 'sonner'
import {
  Hammer,
  Plus,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Calendar,
  Layers,
  ShoppingBag,
  ArrowRight,
  User,
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

export default function OrdensMontagemPage() {
  const { empresaId, moduloCestas } = useEmpresa()
  const { usuario } = useAuth()
  const navigate = useNavigate()

  const [ordens, setOrdens] = useState<OrdemMontagemItem[]>([])
  const [cestas, setCestas] = useState<CestaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')

  // Modal Nova Ordem
  const [modalNovaOrdemOpen, setModalNovaOrdemOpen] = useState(false)
  const [cestaIdNova, setCestaIdNova] = useState('')
  const [qtdPlanejadaNova, setQtdPlanejadaNova] = useState('')
  const [dataMontagemNova, setDataMontagemNova] = useState(new Date().toISOString().split('T')[0])
  const [obsNova, setObsNova] = useState('')
  const [criandoOrdem, setCriandoOrdem] = useState(false)

  // Modal Concluir/Finalizar Ordem
  const [modalFinalizarOpen, setModalFinalizarOpen] = useState(false)
  const [ordemParaFinalizar, setOrdemParaFinalizar] = useState<OrdemMontagemItem | null>(null)
  const [qtdProduzidaEfetiva, setQtdProduzidaEfetiva] = useState('')
  const [finalizando, setFinalizando] = useState(false)

  // Modal Cancelar Ordem
  const [modalCancelarOpen, setModalCancelarOpen] = useState(false)
  const [ordemParaCancelar, setOrdemParaCancelar] = useState<OrdemMontagemItem | null>(null)
  const [cancelando, setCancelando] = useState(false)

  // Permissão: master, admin, gerente, operador
  const podeMontar =
    usuario?.perfil === 'master' ||
    usuario?.perfil === 'admin' ||
    usuario?.perfil === 'gerente' ||
    usuario?.perfil === 'operador'

  const carregarOrdens = useCallback(async () => {
    if (!empresaId) return
    setLoading(true)
    try {
      const data = await CestasService.listOrdensMontagem(empresaId, filtroStatus)
      setOrdens(data)
    } catch (err: any) {
      toast.error(formatApiError(err))
    } finally {
      setLoading(false)
    }
  }, [empresaId, filtroStatus])

  const carregarCestas = useCallback(async () => {
    if (!empresaId) return
    try {
      const data = await CestasService.listCestas(empresaId)
      setCestas(data)
    } catch (err: any) {
      if (import.meta.env.DEV) console.error('Erro ao carregar cestas:', err)
    }
  }, [empresaId])

  useEffect(() => {
    carregarOrdens()
    carregarCestas()
  }, [carregarOrdens, carregarCestas])

  // Abrir modal de criação
  const handleAbrirNovaOrdem = () => {
    if (!podeMontar) {
      toast.error('Você não possui permissão para abrir ordens de montagem.')
      return
    }
    setCestaIdNova('')
    setQtdPlanejadaNova('')
    setDataMontagemNova(new Date().toISOString().split('T')[0])
    setObsNova('')
    setModalNovaOrdemOpen(true)
  }

  // Criar ordem
  const handleCriarOrdem = async () => {
    if (!cestaIdNova) {
      toast.error('Selecione uma cesta para montar.')
      return
    }
    const qtd = parseFloat(qtdPlanejadaNova.replace(',', '.'))
    if (!qtd || qtd <= 0) {
      toast.error('Informe uma quantidade planejada válida maior que zero.')
      return
    }

    setCriandoOrdem(true)
    try {
      const res = await CestasService.criarOrdemMontagem({
        cestaProdutoId: cestaIdNova,
        quantidadePlanejada: qtd,
        dataMontagem: dataMontagemNova,
        observacoes: obsNova.trim() || null,
      })

      toast.success(
        `Ordem de montagem #${res.numero} aberta com sucesso para ${qtd} ${res.cesta_nome}!`,
      )
      setModalNovaOrdemOpen(false)
      await carregarOrdens()
    } catch (err: any) {
      toast.error(formatApiError(err))
    } finally {
      setCriandoOrdem(false)
    }
  }

  // Abrir finalização de ordem
  const handleAbrirFinalizar = (ordem: OrdemMontagemItem) => {
    if (!podeMontar) {
      toast.error('Você não possui permissão para finalizar montagem de cestas.')
      return
    }
    setOrdemParaFinalizar(ordem)
    setQtdProduzidaEfetiva(String(ordem.quantidade_planejada))
    setModalFinalizarOpen(true)
  }

  // Finalizar ordem (executa transação atômica no banco)
  const handleFinalizarOrdem = async () => {
    if (!ordemParaFinalizar) return

    const qtd = parseFloat(qtdProduzidaEfetiva.replace(',', '.'))
    if (!qtd || qtd <= 0) {
      toast.error('A quantidade produzida deve ser maior que zero.')
      return
    }

    setFinalizando(true)
    try {
      const res = await CestasService.finalizarMontagemCestas(ordemParaFinalizar.id, qtd)
      toast.success(
        `Ordem #${res.numero} finalizada com sucesso! ${res.quantidade_produzida} cestas prontas adicionadas ao estoque com custo médio de ${formatCurrency(res.novo_custo_medio_cesta)}.`,
      )
      setModalFinalizarOpen(false)
      await carregarOrdens()
    } catch (err: any) {
      toast.error(formatApiError(err), { duration: 6000 })
    } finally {
      setFinalizando(false)
    }
  }

  // Cancelar ordem
  const handleAbrirCancelar = (ordem: OrdemMontagemItem) => {
    if (!podeMontar) {
      toast.error('Você não tem permissão para cancelar ordens.')
      return
    }
    setOrdemParaCancelar(ordem)
    setModalCancelarOpen(true)
  }

  const handleConfirmarCancelamento = async () => {
    if (!ordemParaCancelar) return
    setCancelando(true)
    try {
      await CestasService.cancelarOrdemMontagem(ordemParaCancelar.id)
      toast.success(`Ordem #${ordemParaCancelar.numero} cancelada.`)
      setModalCancelarOpen(false)
      await carregarOrdens()
    } catch (err: any) {
      toast.error(formatApiError(err))
    } finally {
      setCancelando(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'planejada':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" />
            Planejada
          </span>
        )
      case 'concluida':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle className="w-3 h-3" />
            Concluída
          </span>
        )
      case 'cancelada':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3 h-3" />
            Cancelada
          </span>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-6 pb-24 sm:pb-6">
      {/* FAB Mobile Nova Ordem */}
      {podeMontar && (
        <MobileFab
          label="Nova Montagem"
          onClick={handleAbrirNovaOrdem}
          icon={Plus}
          variant="primary"
        />
      )}

      <PageHeader
        title="Ordens de Montagem"
        description="Planejamento e execução da montagem de cestas básicas prontas com baixa atômica de insumos."
        badge={
          <span className="flex items-center gap-1.5">
            <Hammer className="w-3.5 h-3.5 text-sky-400" />
            {ordens.length} Ordens
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate('/app/cestas')}
              variant="outline"
              className="h-10 text-xs gap-1.5 rounded-xl border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-200"
            >
              <ShoppingBag className="w-4 h-4 text-amber-400" />
              Catálogo de Cestas
            </Button>
            {podeMontar && (
              <Button
                onClick={handleAbrirNovaOrdem}
                className="h-10 text-xs gap-1.5 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Nova Ordem de Montagem
              </Button>
            )}
          </div>
        }
      />

      {/* Filtros de status */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {['todos', 'planejada', 'concluida', 'cancelada'].map((st) => (
          <button
            key={st}
            onClick={() => setFiltroStatus(st)}
            className={`px-3.5 py-1.5 text-xs rounded-xl font-medium capitalize transition-all ${
              filtroStatus === st
                ? 'bg-[#0066FF] text-white shadow-sm font-semibold'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            {st === 'todos' ? 'Todas' : st}
          </button>
        ))}
      </div>

      {/* Lista de Ordens (Mobile-First em cartões) */}
      {loading ? (
        <div className="p-12 text-center flex flex-col items-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#0066FF] mb-2" />
          <p className="text-xs text-slate-400">Carregando ordens de montagem...</p>
        </div>
      ) : ordens.length === 0 ? (
        <div className="p-8 sm:p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/20">
          <Hammer className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-200">Nenhuma ordem encontrada</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Abra uma nova ordem de montagem para registrar a produção de cestas básicas.
          </p>
          {podeMontar && (
            <Button
              onClick={handleAbrirNovaOrdem}
              className="mt-4 text-xs h-9 bg-[#0066FF] hover:bg-[#0052CC] text-white rounded-xl"
            >
              Criar Primeira Ordem
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {ordens.map((ordem) => {
            const dataFmt = ordem.data_montagem
              ? new Date(ordem.data_montagem + 'T00:00:00').toLocaleDateString('pt-BR')
              : ''

            return (
              <div
                key={ordem.id}
                className="p-4 rounded-2xl border border-slate-800 bg-slate-900/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-slate-700"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-lg border border-sky-500/20">
                      #{ordem.numero}
                    </span>
                    {getStatusBadge(ordem.status)}
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      {dataFmt}
                    </span>
                    {ordem.responsavel?.nome && (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        {ordem.responsavel.nome}
                      </span>
                    )}
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      {ordem.cesta?.nome || 'Cesta'}
                      <span className="text-[11px] font-normal text-slate-400">
                        (Versão {ordem.composicao?.versao})
                      </span>
                    </h4>
                    {ordem.observacoes && (
                      <p className="text-[11px] text-slate-400 italic mt-0.5">
                        "{ordem.observacoes}"
                      </p>
                    )}
                  </div>

                  {/* Quantidades e Custos */}
                  <div className="flex items-center gap-4 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                        Planejada:
                      </span>
                      <span className="font-bold text-slate-200">
                        {ordem.quantidade_planejada} un.
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                        Produzida:
                      </span>
                      <span className="font-bold text-emerald-400">
                        {ordem.quantidade_produzida > 0 ? `${ordem.quantidade_produzida} un.` : '—'}
                      </span>
                    </div>

                    {ordem.custo_unitario_efetivo > 0 && (
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                          Custo Efetivo:
                        </span>
                        <span className="font-bold text-white">
                          {formatCurrency(ordem.custo_unitario_efetivo)}/un
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ações da Ordem */}
                {ordem.status === 'planejada' && podeMontar && (
                  <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                    <Button
                      onClick={() => handleAbrirFinalizar(ordem)}
                      className="flex-1 sm:flex-none h-11 px-4 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 shadow-sm"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      Finalizar Montagem
                    </Button>
                    <Button
                      onClick={() => handleAbrirCancelar(ordem)}
                      variant="ghost"
                      className="h-11 px-3 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl"
                    >
                      Cancelar
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal: Nova Ordem de Montagem */}
      <Dialog open={modalNovaOrdemOpen} onOpenChange={setModalNovaOrdemOpen}>
        <DialogContent className="max-w-md bg-slate-950 border-slate-800 text-slate-100 rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <Hammer className="w-5 h-5 text-sky-400" />
              Abrir Ordem de Montagem
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Crie um planejamento de montagem. A versão da composição ativa da cesta será congelada
              neste pedido.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="cesta_select" className="text-xs font-semibold text-slate-300">
                Selecione a Cesta <span className="text-red-400">*</span>
              </Label>
              <select
                id="cesta_select"
                value={cestaIdNova}
                onChange={(e) => setCestaIdNova(e.target.value)}
                className="w-full h-11 px-3 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="">Selecione uma cesta com composição ativa...</option>
                {cestas
                  .filter((c) => Boolean(c.composicao_ativa))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} (v{c.composicao_ativa?.versao} — {c.composicao_ativa?.itens.length}{' '}
                      componentes)
                    </option>
                  ))}
              </select>
              {cestas.filter((c) => !c.composicao_ativa).length > 0 && (
                <p className="text-[10px] text-amber-400">
                  Cestas sem composição ativa configurada não aparecem aqui. Defina a composição
                  antes.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="qtd_plan" className="text-xs font-semibold text-slate-300">
                  Qtd. Planejada <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="qtd_plan"
                  type="number"
                  inputMode="numeric"
                  step="1"
                  min="1"
                  value={qtdPlanejadaNova}
                  onChange={(e) => setQtdPlanejadaNova(e.target.value)}
                  placeholder="Ex: 50"
                  className="h-11 text-xs font-mono rounded-xl bg-slate-900 border-slate-800 text-white"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="data_montagem" className="text-xs font-semibold text-slate-300">
                  Data Prevista
                </Label>
                <Input
                  id="data_montagem"
                  type="date"
                  value={dataMontagemNova}
                  onChange={(e) => setDataMontagemNova(e.target.value)}
                  className="h-11 text-xs rounded-xl bg-slate-900 border-slate-800 text-white"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="obs_ordem" className="text-xs font-semibold text-slate-300">
                Observações
              </Label>
              <Input
                id="obs_ordem"
                value={obsNova}
                onChange={(e) => setObsNova(e.target.value)}
                placeholder="Ex: Montagem especial para cliente X ou lote da manhã"
                className="h-11 text-xs rounded-xl bg-slate-900 border-slate-800 text-white"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalNovaOrdemOpen(false)}
              disabled={criandoOrdem}
              className="h-11 text-xs rounded-xl border-slate-800 bg-slate-900 text-slate-300"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleCriarOrdem}
              disabled={criandoOrdem}
              className="h-11 text-xs font-semibold rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white gap-1.5 shadow-sm"
            >
              {criandoOrdem ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Abrindo Ordem...
                </>
              ) : (
                'Criar Ordem'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Finalizar Montagem (Executa Baixa e Entrada Atômica) */}
      <Dialog open={modalFinalizarOpen} onOpenChange={setModalFinalizarOpen}>
        <DialogContent className="max-w-md bg-slate-950 border-slate-800 text-slate-100 rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              Finalizar Montagem #{ordemParaFinalizar?.numero}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Ao confirmar, o sistema validará e dará baixa em todos os componentes necessários do
              estoque e dará entrada nas cestas prontas de forma atômica.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <p className="text-xs text-slate-400">Cesta a ser produzida:</p>
              <p className="text-sm font-bold text-white">{ordemParaFinalizar?.cesta?.nome}</p>
              <p className="text-[11px] text-slate-400">
                Fórmula: Versão {ordemParaFinalizar?.composicao?.versao}
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="qtd_efetiva" className="text-xs font-semibold text-slate-300">
                Quantidade Efetivamente Produzida (Cestas Prontas)
              </Label>
              <Input
                id="qtd_efetiva"
                type="number"
                inputMode="numeric"
                step="1"
                min="1"
                value={qtdProduzidaEfetiva}
                onChange={(e) => setQtdProduzidaEfetiva(e.target.value)}
                className="h-11 text-xs font-mono rounded-xl bg-slate-900 border-slate-800 text-white"
              />
              <p className="text-[10px] text-slate-500">
                Se você produziu menos ou mais do que o planejado originalmente, ajuste aqui. Os
                componentes serão consumidos proporcionalmente.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Se faltar qualquer componente no estoque físico, a transação será abortada com o
                aviso exato do item em falta e nada será alterado.
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalFinalizarOpen(false)}
              disabled={finalizando}
              className="h-11 text-xs rounded-xl border-slate-800 bg-slate-900 text-slate-300"
            >
              Voltar
            </Button>
            <Button
              type="button"
              onClick={handleFinalizarOrdem}
              disabled={finalizando}
              className="h-11 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 shadow-sm"
            >
              {finalizando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processando Estoque...
                </>
              ) : (
                'Confirmar e Baixar Componentes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Cancelar Ordem */}
      <Dialog open={modalCancelarOpen} onOpenChange={setModalCancelarOpen}>
        <DialogContent className="max-w-md bg-slate-950 border-slate-800 text-slate-100 rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <XCircle className="w-5 h-5 text-rose-400" />
              Cancelar Ordem #{ordemParaCancelar?.numero}?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Tem certeza que deseja cancelar esta ordem de montagem? Nenhuma movimentação de
              estoque foi feita ainda.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalCancelarOpen(false)}
              disabled={cancelando}
              className="h-11 text-xs rounded-xl border-slate-800 bg-slate-900 text-slate-300"
            >
              Não, manter
            </Button>
            <Button
              type="button"
              onClick={handleConfirmarCancelamento}
              disabled={cancelando}
              className="h-11 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-500 text-white gap-1.5 shadow-sm"
            >
              {cancelando ? 'Cancelando...' : 'Sim, cancelar ordem'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
