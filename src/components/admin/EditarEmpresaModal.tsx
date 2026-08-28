import React, { useState, useEffect } from 'react'
import {
  Building2,
  Layers,
  CreditCard,
  Users,
  History,
  Save,
  Sparkles,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  ShieldAlert,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AdminService, AdminEmpresaItem, AdminPlanoItem, AdminUsuarioItem } from '@/services/admin'
import { toast } from 'sonner'

interface EditarEmpresaModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  empresa: AdminEmpresaItem | null
  planos: AdminPlanoItem[]
  onSuccess: () => void
}

export function EditarEmpresaModal({
  open,
  onOpenChange,
  empresa,
  planos,
  onSuccess,
}: EditarEmpresaModalProps) {
  const [activeTab, setActiveTab] = useState<'cadastral' | 'plano' | 'usuarios' | 'historico'>(
    'cadastral',
  )
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Dados cadastrais
  const [cadastral, setCadastral] = useState({
    nome: '',
    nome_fantasia: '',
    cnpj: '',
    inscricao_estadual: '',
    inscricao_municipal: '',
    email: '',
    telefone: '',
    whatsapp: '',
    cep: '',
    estado: 'SP',
    cidade: '',
    bairro: '',
    endereco: '',
    numero: '',
    complemento: '',
    status: 'ativo',
    observacoes: '',
    responsavel_nome: '',
    responsavel_cpf: '',
    responsavel_email: '',
    responsavel_telefone: '',
    responsavel_whatsapp: '',
    responsavel_cargo: '',
  })

  // Plano e assinatura
  const [planoForm, setPlanoForm] = useState({
    plano_slug: 'profissional',
    valor: 197,
    desconto: 0,
    periodicidade: 'mensal',
    metodo_pagamento: 'pix',
    vencimento: '',
    fim_periodo_teste: '',
    observacoes_comerciais: '',
  })

  // Usuários da empresa
  const [usuarios, setUsuarios] = useState<AdminUsuarioItem[]>([])
  const [historico, setHistorico] = useState<any[]>([])

  useEffect(() => {
    if (empresa && open) {
      setCadastral({
        nome: empresa.nome || '',
        nome_fantasia: empresa.nome_fantasia || '',
        cnpj: empresa.cnpj || '',
        inscricao_estadual: empresa.inscricao_estadual || '',
        inscricao_municipal: empresa.inscricao_municipal || '',
        email: empresa.email || '',
        telefone: empresa.telefone || '',
        whatsapp: empresa.whatsapp || '',
        cep: empresa.cep || '',
        estado: empresa.estado || 'SP',
        cidade: empresa.cidade || '',
        bairro: empresa.bairro || '',
        endereco: empresa.endereco || '',
        numero: empresa.numero || '',
        complemento: empresa.complemento || '',
        status: empresa.status || 'ativo',
        observacoes: empresa.observacoes || '',
        responsavel_nome: empresa.responsavel_nome || '',
        responsavel_cpf: empresa.responsavel_cpf || '',
        responsavel_email: empresa.responsavel_email || '',
        responsavel_telefone: empresa.responsavel_telefone || '',
        responsavel_whatsapp: empresa.responsavel_whatsapp || '',
        responsavel_cargo: empresa.responsavel_cargo || '',
      })

      setPlanoForm({
        plano_slug: empresa.plano_slug || 'profissional',
        valor: empresa.valor_assinatura || 0,
        desconto: 0,
        periodicidade: 'mensal',
        metodo_pagamento: 'pix',
        vencimento: empresa.vencimento ? empresa.vencimento.split('T')[0] : '',
        fim_periodo_teste: empresa.fim_periodo_teste ? empresa.fim_periodo_teste.split('T')[0] : '',
        observacoes_comerciais: '',
      })

      carregarDadosRelacionados(empresa.id)
    }
  }, [empresa, open])

  const carregarDadosRelacionados = async (empresaId: string) => {
    setLoading(true)
    try {
      const [usersRes, histRes] = await Promise.all([
        AdminService.listarUsuarios(empresaId),
        AdminService.listarHistoricoEmpresa(empresaId),
      ])
      setUsuarios(usersRes.data || [])
      setHistorico(histRes.data || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const handleSalvarCadastral = async () => {
    if (!empresa) return
    if (!cadastral.nome.trim()) {
      toast.error('Razão social é obrigatória.')
      return
    }

    try {
      setSaving(true)
      const { error } = await AdminService.editarEmpresaCadastral(empresa.id, cadastral)
      if (error) throw error
      toast.success('Dados cadastrais atualizados com sucesso!')
      onSuccess()
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao salvar dados cadastrais.')
    } finally {
      setSaving(false)
    }
  }

  const handleSalvarPlanoAssinatura = async () => {
    if (!empresa) return

    try {
      setSaving(true)
      const { error } = await AdminService.atualizarAssinaturaManual(empresa.id, 'alterar_dados', {
        plano_slug: planoForm.plano_slug,
        valor: Number(planoForm.valor),
        desconto: Number(planoForm.desconto),
        periodicidade: planoForm.periodicidade,
        metodo_pagamento: planoForm.metodo_pagamento,
        vencimento: planoForm.vencimento || null,
        fim_periodo_teste: planoForm.fim_periodo_teste || null,
        observacoes_comerciais: planoForm.observacoes_comerciais,
      })
      if (error) throw error
      toast.success('Plano e condições de assinatura atualizados com sucesso!')
      onSuccess()
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao salvar assinatura.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 bg-slate-950 border-slate-800 text-slate-100 overflow-hidden shadow-2xl">
        <DialogHeader className="px-6 py-4 border-b border-slate-800/80 bg-slate-900/60 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-sky-400">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Gerenciar Empresa: {empresa?.nome_fantasia || empresa?.nome}</span>
                  <Badge
                    className={`text-[10px] ${
                      empresa?.status === 'ativo'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                    }`}
                  >
                    {empresa?.status?.toUpperCase()}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400 font-mono">
                  ID: {empresa?.id} • CNPJ: {empresa?.cnpj || 'Sem CNPJ'}
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar text-xs">
          <Tabs
            value={activeTab}
            onValueChange={(val: any) => setActiveTab(val)}
            className="w-full"
          >
            <TabsList className="grid grid-cols-4 bg-slate-900 border border-slate-800 text-slate-400 p-1 mb-4">
              <TabsTrigger
                value="cadastral"
                className="data-[state=active]:bg-sky-500 data-[state=active]:text-white flex items-center gap-1.5"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Dados Cadastrais</span>
              </TabsTrigger>
              <TabsTrigger
                value="plano"
                className="data-[state=active]:bg-sky-500 data-[state=active]:text-white flex items-center gap-1.5"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Plano & Assinatura</span>
              </TabsTrigger>
              <TabsTrigger
                value="usuarios"
                className="data-[state=active]:bg-sky-500 data-[state=active]:text-white flex items-center gap-1.5"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Usuários ({usuarios.length})</span>
              </TabsTrigger>
              <TabsTrigger
                value="historico"
                className="data-[state=active]:bg-sky-500 data-[state=active]:text-white flex items-center gap-1.5"
              >
                <History className="w-3.5 h-3.5" />
                <span>Histórico ({historico.length})</span>
              </TabsTrigger>
            </TabsList>

            {/* ABA 1: DADOS CADASTRAIS */}
            <TabsContent value="cadastral" className="space-y-4 m-0">
              <div className="p-3 bg-sky-500/10 border border-sky-500/20 text-sky-300 rounded-lg text-xs">
                A alteração cadastral <strong>NÃO</strong> altera nem consome limites de usuários,
                produtos ou clientes do plano da empresa.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-slate-300 font-semibold">Razão Social *</label>
                  <Input
                    value={cadastral.nome}
                    onChange={(e) => setCadastral({ ...cadastral, nome: e.target.value })}
                    className="bg-slate-900 border-slate-800 text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Nome Fantasia</label>
                  <Input
                    value={cadastral.nome_fantasia}
                    onChange={(e) => setCadastral({ ...cadastral, nome_fantasia: e.target.value })}
                    className="bg-slate-900 border-slate-800 text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">CNPJ</label>
                  <Input
                    value={cadastral.cnpj}
                    onChange={(e) => setCadastral({ ...cadastral, cnpj: e.target.value })}
                    className="bg-slate-900 border-slate-800 text-slate-100 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Inscrição Estadual</label>
                  <Input
                    value={cadastral.inscricao_estadual}
                    onChange={(e) =>
                      setCadastral({ ...cadastral, inscricao_estadual: e.target.value })
                    }
                    className="bg-slate-900 border-slate-800 text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Inscrição Municipal</label>
                  <Input
                    value={cadastral.inscricao_municipal}
                    onChange={(e) =>
                      setCadastral({ ...cadastral, inscricao_municipal: e.target.value })
                    }
                    className="bg-slate-900 border-slate-800 text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">E-mail Comercial</label>
                  <Input
                    type="email"
                    value={cadastral.email}
                    onChange={(e) => setCadastral({ ...cadastral, email: e.target.value })}
                    className="bg-slate-900 border-slate-800 text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Telefone</label>
                  <Input
                    value={cadastral.telefone}
                    onChange={(e) => setCadastral({ ...cadastral, telefone: e.target.value })}
                    className="bg-slate-900 border-slate-800 text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">WhatsApp</label>
                  <Input
                    value={cadastral.whatsapp}
                    onChange={(e) => setCadastral({ ...cadastral, whatsapp: e.target.value })}
                    className="bg-slate-900 border-slate-800 text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Status Operacional</label>
                  <Select
                    value={cadastral.status}
                    onValueChange={(val) => setCadastral({ ...cadastral, status: val })}
                  >
                    <SelectTrigger className="bg-slate-900 border-slate-800 text-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                      <SelectItem value="bloqueado">Bloqueado</SelectItem>
                      <SelectItem value="suspenso">Suspenso</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Endereço */}
              <div className="pt-2 border-t border-slate-800/80">
                <h4 className="font-bold text-slate-400 mb-2 uppercase text-[10px]">Endereço</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-slate-400">CEP</label>
                    <Input
                      value={cadastral.cep}
                      onChange={(e) => setCadastral({ ...cadastral, cep: e.target.value })}
                      className="bg-slate-900 border-slate-800 text-slate-100"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-slate-400">Endereço</label>
                    <Input
                      value={cadastral.endereco}
                      onChange={(e) => setCadastral({ ...cadastral, endereco: e.target.value })}
                      className="bg-slate-900 border-slate-800 text-slate-100"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-400">Cidade</label>
                    <Input
                      value={cadastral.cidade}
                      onChange={(e) => setCadastral({ ...cadastral, cidade: e.target.value })}
                      className="bg-slate-900 border-slate-800 text-slate-100"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-400">Estado / UF</label>
                    <Input
                      value={cadastral.estado}
                      onChange={(e) => setCadastral({ ...cadastral, estado: e.target.value })}
                      className="bg-slate-900 border-slate-800 text-slate-100"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-400">Bairro</label>
                    <Input
                      value={cadastral.bairro}
                      onChange={(e) => setCadastral({ ...cadastral, bairro: e.target.value })}
                      className="bg-slate-900 border-slate-800 text-slate-100"
                    />
                  </div>
                </div>
              </div>

              {/* Responsável Legal */}
              <div className="pt-2 border-t border-slate-800/80">
                <h4 className="font-bold text-slate-400 mb-2 uppercase text-[10px]">
                  Responsável Legal
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-slate-400">Nome</label>
                    <Input
                      value={cadastral.responsavel_nome}
                      onChange={(e) =>
                        setCadastral({ ...cadastral, responsavel_nome: e.target.value })
                      }
                      className="bg-slate-900 border-slate-800 text-slate-100"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-400">E-mail</label>
                    <Input
                      value={cadastral.responsavel_email}
                      onChange={(e) =>
                        setCadastral({ ...cadastral, responsavel_email: e.target.value })
                      }
                      className="bg-slate-900 border-slate-800 text-slate-100"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-400">Cargo</label>
                    <Input
                      value={cadastral.responsavel_cargo}
                      onChange={(e) =>
                        setCadastral({ ...cadastral, responsavel_cargo: e.target.value })
                      }
                      className="bg-slate-900 border-slate-800 text-slate-100"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  type="button"
                  onClick={handleSalvarCadastral}
                  disabled={saving}
                  className="bg-sky-600 hover:bg-sky-500 text-white font-semibold"
                >
                  <Save className="w-4 h-4 mr-1.5" />
                  Salvar Dados Cadastrais
                </Button>
              </div>
            </TabsContent>

            {/* ABA 2: PLANO & ASSINATURA */}
            <TabsContent value="plano" className="space-y-4 m-0">
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded-lg text-xs">
                Alteração comercial de plano, vigência ou valores. As atualizações serão registradas
                automaticamente na trilha de auditoria.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">Plano Comercial</label>
                  <Select
                    value={planoForm.plano_slug}
                    onValueChange={(val) => {
                      setPlanoForm({ ...planoForm, plano_slug: val })
                      const p = planos.find((item) => item.slug === val)
                      if (p)
                        setPlanoForm((prev) => ({ ...prev, valor: Number(p.valor_mensal) || 0 }))
                    }}
                  >
                    <SelectTrigger className="bg-slate-900 border-slate-800 text-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                      {planos.map((p) => (
                        <SelectItem key={p.id} value={p.slug}>
                          {p.nome} (R$ {Number(p.valor_mensal).toFixed(2)}/mês)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">Periodicidade</label>
                  <Select
                    value={planoForm.periodicidade}
                    onValueChange={(val) => setPlanoForm({ ...planoForm, periodicidade: val })}
                  >
                    <SelectTrigger className="bg-slate-900 border-slate-800 text-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                      <SelectItem value="mensal">Mensal</SelectItem>
                      <SelectItem value="trimestral">Trimestral</SelectItem>
                      <SelectItem value="semestral">Semestral</SelectItem>
                      <SelectItem value="anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">Valor Mensal (R$)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={planoForm.valor}
                    onChange={(e) =>
                      setPlanoForm({ ...planoForm, valor: parseFloat(e.target.value) || 0 })
                    }
                    className="bg-slate-900 border-slate-800 text-slate-100 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">Desconto (R$)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={planoForm.desconto}
                    onChange={(e) =>
                      setPlanoForm({ ...planoForm, desconto: parseFloat(e.target.value) || 0 })
                    }
                    className="bg-slate-900 border-slate-800 text-slate-100 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">Próximo Vencimento</label>
                  <Input
                    type="date"
                    value={planoForm.vencimento}
                    onChange={(e) => setPlanoForm({ ...planoForm, vencimento: e.target.value })}
                    className="bg-slate-900 border-slate-800 text-slate-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">Forma de Pagamento</label>
                  <Select
                    value={planoForm.metodo_pagamento}
                    onValueChange={(val) => setPlanoForm({ ...planoForm, metodo_pagamento: val })}
                  >
                    <SelectTrigger className="bg-slate-900 border-slate-800 text-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="boleto">Boleto</SelectItem>
                      <SelectItem value="cartao">Cartão de Crédito</SelectItem>
                      <SelectItem value="transferencia">Transferência</SelectItem>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-slate-300 font-semibold">Observações Comerciais</label>
                  <Input
                    placeholder="Anotações comerciais sobre o contrato..."
                    value={planoForm.observacoes_comerciais}
                    onChange={(e) =>
                      setPlanoForm({ ...planoForm, observacoes_comerciais: e.target.value })
                    }
                    className="bg-slate-900 border-slate-800 text-slate-100"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  type="button"
                  onClick={handleSalvarPlanoAssinatura}
                  disabled={saving}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                >
                  <Save className="w-4 h-4 mr-1.5" />
                  Salvar Condições de Assinatura
                </Button>
              </div>
            </TabsContent>

            {/* ABA 3: USUÁRIOS */}
            <TabsContent value="usuarios" className="space-y-3 m-0">
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-between">
                <span className="text-slate-300">
                  Usuários vinculados exclusivamente a esta empresa:
                </span>
                <Badge className="bg-sky-500/20 text-sky-400 font-mono">
                  {usuarios.length} usuários
                </Badge>
              </div>

              <div className="rounded-lg border border-slate-800 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px]">
                    <tr>
                      <th className="p-2.5">Nome</th>
                      <th className="p-2.5">E-mail</th>
                      <th className="p-2.5">Perfil</th>
                      <th className="p-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {usuarios.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-slate-500">
                          Nenhum usuário encontrado.
                        </td>
                      </tr>
                    ) : (
                      usuarios.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-900/40">
                          <td className="p-2.5 font-semibold text-white">{u.nome}</td>
                          <td className="p-2.5 font-mono text-slate-300">{u.email}</td>
                          <td className="p-2.5">
                            <Badge
                              className={`text-[10px] ${
                                u.perfil === 'master'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-sky-500/20 text-sky-400'
                              }`}
                            >
                              {u.perfil.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="p-2.5">
                            <Badge
                              className={`text-[10px] ${
                                u.ativo
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-rose-500/20 text-rose-400'
                              }`}
                            >
                              {u.ativo ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* ABA 4: HISTÓRICO */}
            <TabsContent value="historico" className="space-y-3 m-0">
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                <span className="text-slate-300">
                  Trilha de auditoria e alterações administrativas da empresa:
                </span>
              </div>

              <div className="space-y-2">
                {historico.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 border border-slate-800 rounded-lg">
                    Nenhum registro histórico disponível.
                  </div>
                ) : (
                  historico.map((h) => (
                    <div
                      key={h.id}
                      className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 flex items-start justify-between gap-4"
                    >
                      <div>
                        <p className="font-semibold text-slate-200">{h.descricao || h.tipo}</p>
                        <p className="text-[11px] text-slate-400">
                          Por: {h.usuario_nome || 'Sistema / Admin'} •{' '}
                          {new Date(h.created_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <Badge className="bg-slate-800 text-slate-300 text-[10px] font-mono">
                        {h.tipo}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="px-6 py-3 border-t border-slate-800/80 bg-slate-900/60 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-slate-400 hover:text-white"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
