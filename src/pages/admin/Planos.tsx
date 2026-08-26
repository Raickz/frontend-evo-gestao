import { useState, useEffect } from 'react'
import {
  Layers,
  Plus,
  Edit2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Users,
  Briefcase,
  Package,
  ShoppingCart,
} from 'lucide-react'
import { AdminService, AdminPlanoItem, CreatePlanoInput } from '@/services/admin'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

export default function AdminPlanosPage() {
  const [planos, setPlanos] = useState<AdminPlanoItem[]>([])
  const [loading, setLoading] = useState(true)

  // Modal Novo / Edição
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPlanoId, setEditingPlanoId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Formulário
  const [nome, setNome] = useState('')
  const [slug, setSlug] = useState('')
  const [descricao, setDescricao] = useState('')
  const [valorMensal, setValorMensal] = useState<number>(0)
  const [periodoTesteDias, setPeriodoTesteDias] = useState<number>(14)
  const [limiteUsuarios, setLimiteUsuarios] = useState<string>('')
  const [limiteVendedores, setLimiteVendedores] = useState<string>('')
  const [limiteProdutos, setLimiteProdutos] = useState<string>('')
  const [limiteClientes, setLimiteClientes] = useState<string>('')
  const [limiteVendasMes, setLimiteVendasMes] = useState<string>('')
  const [ordem, setOrdem] = useState<number>(1)
  const [ativo, setAtivo] = useState(true)
  const [recursosText, setRecursosText] = useState('')

  const loadPlanos = async () => {
    try {
      setLoading(true)
      const { data, error } = await AdminService.listarPlanosAdmin()
      if (error) throw error
      setPlanos(data)
    } catch (err: any) {
      toast.error('Erro ao carregar planos: ' + (err?.message || 'Falha na requisição.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPlanos()
  }, [])

  const resetForm = () => {
    setEditingPlanoId(null)
    setNome('')
    setSlug('')
    setDescricao('')
    setValorMensal(0)
    setPeriodoTesteDias(14)
    setLimiteUsuarios('')
    setLimiteVendedores('')
    setLimiteProdutos('')
    setLimiteClientes('')
    setLimiteVendasMes('')
    setOrdem(1)
    setAtivo(true)
    setRecursosText('')
  }

  const handleOpenCreate = () => {
    resetForm()
    setModalOpen(true)
  }

  const handleOpenEdit = (plano: AdminPlanoItem) => {
    setEditingPlanoId(plano.id)
    setNome(plano.nome)
    setSlug(plano.slug)
    setDescricao(plano.descricao || '')
    setValorMensal(plano.valor_mensal)
    setPeriodoTesteDias(plano.periodo_teste_dias || 0)
    setLimiteUsuarios(plano.limite_usuarios !== null ? String(plano.limite_usuarios) : '')
    setLimiteVendedores(plano.limite_vendedores !== null ? String(plano.limite_vendedores) : '')
    setLimiteProdutos(plano.limite_produtos !== null ? String(plano.limite_produtos) : '')
    setLimiteClientes(plano.limite_clientes !== null ? String(plano.limite_clientes) : '')
    setLimiteVendasMes(plano.limite_vendas_mes !== null ? String(plano.limite_vendas_mes) : '')
    setOrdem(plano.ordem || 0)
    setAtivo(plano.ativo)

    if (Array.isArray(plano.recursos)) {
      setRecursosText(plano.recursos.join('\n'))
    } else {
      setRecursosText('')
    }

    setModalOpen(true)
  }

  const handleToggleAtivo = async (plano: AdminPlanoItem) => {
    try {
      const novoStatus = !plano.ativo
      const { error } = await AdminService.togglePlanoAtivo(plano.id, novoStatus)
      if (error) throw error

      toast.success(`Plano ${plano.nome} ${novoStatus ? 'ativado' : 'inativado'} com sucesso!`)
      loadPlanos()
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao alterar status do plano.')
    }
  }

  const handleSavePlano = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!nome.trim() || !slug.trim()) {
      toast.error('Nome e Slug são obrigatórios.')
      return
    }

    const recursosArray = recursosText
      .split('\n')
      .map((r) => r.trim())
      .filter(Boolean)

    const payload: CreatePlanoInput = {
      nome: nome.trim(),
      slug: slug.trim().toLowerCase(),
      descricao: descricao.trim() || null,
      valor_mensal: Number(valorMensal) || 0,
      periodo_teste_dias: Number(periodoTesteDias) || 0,
      limite_usuarios: limiteUsuarios !== '' ? Number(limiteUsuarios) : null,
      limite_vendedores: limiteVendedores !== '' ? Number(limiteVendedores) : null,
      limite_produtos: limiteProdutos !== '' ? Number(limiteProdutos) : null,
      limite_clientes: limiteClientes !== '' ? Number(limiteClientes) : null,
      limite_vendas_mes: limiteVendasMes !== '' ? Number(limiteVendasMes) : null,
      recursos: recursosArray,
      ordem: Number(ordem) || 0,
      ativo,
    }

    try {
      setSubmitting(true)
      if (editingPlanoId) {
        const { error } = await AdminService.editarPlano(editingPlanoId, payload)
        if (error) throw error
        toast.success('Plano atualizado com sucesso!')
      } else {
        const { error } = await AdminService.criarPlano(payload)
        if (error) throw error
        toast.success('Novo plano cadastrado com sucesso!')
      }

      setModalOpen(false)
      resetForm()
      loadPlanos()
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao salvar plano.')
    } finally {
      setSubmitting(false)
    }
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val || 0)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black tracking-tight text-white">Gestão de Planos</h2>
            <Badge className="bg-sky-500/20 text-sky-400 border-sky-500/40 text-xs font-semibold">
              {planos.length} Planos
            </Badge>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Configure os planos de assinatura, preços, limites operacionais e recursos disponíveis.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadPlanos}
            disabled={loading}
            className="bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-200"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin text-sky-400' : ''}`} />
            Atualizar
          </Button>
          <Button
            size="sm"
            onClick={handleOpenCreate}
            className="bg-sky-600 hover:bg-sky-500 text-white font-semibold"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Novo Plano
          </Button>
        </div>
      </div>

      {/* Grid de Cards de Planos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-3 py-16 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sky-400 mb-2" />
            Carregando catálogo de planos...
          </div>
        ) : (
          planos.map((p) => {
            return (
              <Card
                key={p.id}
                className={`bg-slate-900/90 border-slate-800 text-slate-100 flex flex-col justify-between transition-all duration-200 hover:border-slate-700 shadow-sm ${
                  !p.ativo ? 'opacity-60 bg-slate-950/80' : ''
                }`}
              >
                <div className="p-5 space-y-4">
                  {/* Topo do Card */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-black text-white">{p.nome}</h3>
                        <Badge
                          className={`text-[10px] font-bold ${
                            p.ativo
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {p.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                      <span className="text-xs font-mono text-sky-400">slug: {p.slug}</span>
                    </div>

                    <div className="text-right">
                      <span className="text-xl font-black text-white">
                        {formatCurrency(p.valor_mensal)}
                      </span>
                      <span className="text-xs text-slate-400 block">/mês</span>
                    </div>
                  </div>

                  {p.descricao && (
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                      {p.descricao}
                    </p>
                  )}

                  {/* Limites Operacionais */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800">
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>Usuários:</span>
                      <strong className="text-white ml-auto">
                        {p.limite_usuarios ?? 'Ilimitado'}
                      </strong>
                    </div>

                    <div className="flex items-center gap-1.5 text-slate-300">
                      <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                      <span>Vendedores:</span>
                      <strong className="text-white ml-auto">
                        {p.limite_vendedores ?? 'Ilimitado'}
                      </strong>
                    </div>

                    <div className="flex items-center gap-1.5 text-slate-300">
                      <Package className="w-3.5 h-3.5 text-slate-400" />
                      <span>Produtos:</span>
                      <strong className="text-white ml-auto">
                        {p.limite_produtos ?? 'Ilimitado'}
                      </strong>
                    </div>

                    <div className="flex items-center gap-1.5 text-slate-300">
                      <ShoppingCart className="w-3.5 h-3.5 text-slate-400" />
                      <span>Vendas/mês:</span>
                      <strong className="text-white ml-auto">
                        {p.limite_vendas_mes ?? 'Ilimitado'}
                      </strong>
                    </div>
                  </div>

                  {/* Lista de Recursos */}
                  {Array.isArray(p.recursos) && p.recursos.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-slate-800">
                      <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
                        Recursos inclusos ({p.recursos.length}):
                      </span>
                      <ul className="space-y-1">
                        {p.recursos.slice(0, 4).map((rec, idx) => (
                          <li
                            key={idx}
                            className="text-xs text-slate-300 flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="truncate">{rec}</span>
                          </li>
                        ))}
                        {p.recursos.length > 4 && (
                          <li className="text-[11px] text-slate-400 italic">
                            + {p.recursos.length - 4} outros recursos...
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Footer do Card com Botões de Ação */}
                <div className="p-4 bg-slate-950/70 border-t border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Ordem: {p.ordem}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleAtivo(p)}
                      className={`h-8 text-xs border-slate-700 ${
                        p.ativo
                          ? 'bg-slate-900 text-amber-300 hover:bg-amber-950/30'
                          : 'bg-slate-900 text-emerald-300 hover:bg-emerald-950/30'
                      }`}
                    >
                      {p.ativo ? (
                        <>
                          <XCircle className="w-3.5 h-3.5 mr-1" />
                          Inativar
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          Ativar
                        </>
                      )}
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleOpenEdit(p)}
                      className="h-8 text-xs bg-slate-800 text-slate-200 hover:bg-slate-700"
                    >
                      <Edit2 className="w-3.5 h-3.5 mr-1 text-sky-400" />
                      Editar
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })
        )}
      </div>

      {/* MODAL DE CRIAÇÃO / EDIÇÃO DE PLANO */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl bg-slate-900 border-slate-800 text-slate-100 max-h-[90vh] overflow-y-auto custom-scrollbar">
          <form onSubmit={handleSavePlano}>
            <DialogHeader>
              <div className="h-10 w-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center mb-1">
                <Layers className="w-5 h-5" />
              </div>
              <DialogTitle className="text-lg font-bold text-white">
                {editingPlanoId ? 'Editar Plano' : 'Criar Novo Plano'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Preencha as informações do plano. Não é permitida exclusão física para resguardar o
                histórico.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 text-xs">
              {/* Nome */}
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">Nome do Plano *</label>
                <Input
                  required
                  placeholder="Ex: Profissional"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-slate-100"
                />
              </div>

              {/* Slug */}
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">Slug Identificador *</label>
                <Input
                  required
                  placeholder="Ex: profissional"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-slate-100 font-mono"
                />
              </div>

              {/* Descrição */}
              <div className="col-span-2 space-y-1">
                <label className="text-slate-300 font-semibold block">Descrição</label>
                <Textarea
                  rows={2}
                  placeholder="Resumo do objetivo ou público-alvo do plano..."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-slate-100"
                />
              </div>

              {/* Valor Mensal */}
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">Valor Mensal (R$) *</label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  placeholder="197.00"
                  value={valorMensal}
                  onChange={(e) => setValorMensal(Number(e.target.value))}
                  className="bg-slate-950 border-slate-800 text-slate-100 font-mono"
                />
              </div>

              {/* Dias de Teste */}
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">
                  Período de Teste (Dias)
                </label>
                <Input
                  type="number"
                  placeholder="14"
                  value={periodoTesteDias}
                  onChange={(e) => setPeriodoTesteDias(Number(e.target.value))}
                  className="bg-slate-950 border-slate-800 text-slate-100"
                />
              </div>

              {/* Limite Usuários */}
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">
                  Limite Usuários (vazio = ilimitado)
                </label>
                <Input
                  type="number"
                  placeholder="Ex: 5"
                  value={limiteUsuarios}
                  onChange={(e) => setLimiteUsuarios(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-slate-100"
                />
              </div>

              {/* Limite Vendedores */}
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">
                  Limite Vendedores (vazio = ilimitado)
                </label>
                <Input
                  type="number"
                  placeholder="Ex: 3"
                  value={limiteVendedores}
                  onChange={(e) => setLimiteVendedores(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-slate-100"
                />
              </div>

              {/* Limite Produtos */}
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">
                  Limite Produtos (vazio = ilimitado)
                </label>
                <Input
                  type="number"
                  placeholder="Ex: 1000"
                  value={limiteProdutos}
                  onChange={(e) => setLimiteProdutos(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-slate-100"
                />
              </div>

              {/* Limite Clientes */}
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">
                  Limite Clientes (vazio = ilimitado)
                </label>
                <Input
                  type="number"
                  placeholder="Ex: 500"
                  value={limiteClientes}
                  onChange={(e) => setLimiteClientes(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-slate-100"
                />
              </div>

              {/* Limite Vendas/mês */}
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">
                  Limite Vendas/mês (vazio = ilimitado)
                </label>
                <Input
                  type="number"
                  placeholder="Ex: 500"
                  value={limiteVendasMes}
                  onChange={(e) => setLimiteVendasMes(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-slate-100"
                />
              </div>

              {/* Ordem de exibição */}
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">Ordem de Exibição</label>
                <Input
                  type="number"
                  placeholder="1"
                  value={ordem}
                  onChange={(e) => setOrdem(Number(e.target.value))}
                  className="bg-slate-950 border-slate-800 text-slate-100"
                />
              </div>

              {/* Status Ativo */}
              <div className="col-span-2 flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <span className="font-semibold text-white block">Plano Ativo</span>
                  <span className="text-slate-400 text-[11px]">
                    Planos inativos não ficam visíveis para contratação por novas empresas.
                  </span>
                </div>
                <Switch checked={ativo} onCheckedChange={setAtivo} />
              </div>

              {/* Recursos (1 por linha) */}
              <div className="col-span-2 space-y-1">
                <label className="text-slate-300 font-semibold block">
                  Lista de Recursos (1 por linha)
                </label>
                <Textarea
                  rows={4}
                  placeholder={`Gestão de produtos\nControle de estoque\nVendas e pedidos\nRelatório de lucro`}
                  value={recursosText}
                  onChange={(e) => setRecursosText(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-slate-100 font-mono text-xs"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(false)}
                disabled={submitting}
                className="bg-slate-800 border-slate-700 text-slate-200"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submitting}
                className="bg-sky-600 hover:bg-sky-500 text-white font-semibold"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Plano'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
