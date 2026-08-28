import React, { useState } from 'react'
import {
  Building2,
  User,
  KeyRound,
  Layers,
  CreditCard,
  UserCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  AlertCircle,
  HelpCircle,
  Sparkles,
  ShieldCheck,
  Check,
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
import { AdminService, AdminPlanoItem, CadastroManualEmpresaInput } from '@/services/admin'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'

interface NovaEmpresaWizardModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  planos: AdminPlanoItem[]
  onSuccess: (empresaId: string) => void
}

const ETAPAS = [
  { id: 1, title: 'Empresa', desc: 'Dados cadastrais', icon: Building2 },
  { id: 2, title: 'Responsável', desc: 'Contato legal', icon: User },
  { id: 3, title: 'Acesso Master', desc: 'Primeiro usuário', icon: KeyRound },
  { id: 4, title: 'Plano', desc: 'Seleção do plano', icon: Layers },
  { id: 5, title: 'Contratação', desc: 'Condições e datas', icon: CreditCard },
  { id: 6, title: 'Vendedor', desc: 'Admin responsável', icon: UserCheck },
  { id: 7, title: 'Resumo', desc: 'Confirmar cadastro', icon: CheckCircle2 },
]

export function NovaEmpresaWizardModal({
  open,
  onOpenChange,
  planos,
  onSuccess,
}: NovaEmpresaWizardModalProps) {
  const { usuario, user } = useAuth()
  const [currentStep, setCurrentStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)

  // 1. DADOS DA EMPRESA
  const [empresa, setEmpresa] = useState({
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
  })

  // 2. RESPONSÁVEL LEGAL
  const [responsavel, setResponsavel] = useState({
    nome: '',
    cpf: '',
    email: '',
    telefone: '',
    whatsapp: '',
    cargo: 'Diretor Geral',
  })

  // 3. ACESSO MASTER
  const [master, setMaster] = useState({
    nome: '',
    email: '',
    telefone: '',
    senha: '',
    confirmarSenha: '',
    enviarConvite: true,
  })

  // 4. PLANO
  const [selectedPlanoSlug, setSelectedPlanoSlug] = useState<string>('profissional')

  // 5. CONTRATAÇÃO MANUAL
  const todayStr = new Date().toISOString().split('T')[0]
  const vencimentoDefault = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]

  const [contratacao, setContratacao] = useState({
    data_contratacao: todayStr,
    data_inicio: todayStr,
    periodo_teste_tipo: 'sem_teste', // 'sem_teste' | '7' | '14' | '30' | 'custom'
    fim_periodo_teste: '',
    proximo_vencimento: vencimentoDefault,
    valor_contratado: 197,
    desconto: 0,
    valor_final: 197,
    forma_pagamento: 'pix',
    periodicidade: 'mensal',
    status_assinatura: 'ativa',
    observacoes_comerciais: '',
  })

  // Sincronizar plano com valores e teste
  const selectedPlano = planos.find((p) => p.slug === selectedPlanoSlug)

  const handlePlanoSelect = (slug: string) => {
    setSelectedPlanoSlug(slug)
    const p = planos.find((item) => item.slug === slug)
    if (p) {
      const val = Number(p.valor_mensal) || 0
      setContratacao((prev) => ({
        ...prev,
        valor_contratado: val,
        valor_final: Math.max(0, val - prev.desconto),
      }))
    }
  }

  const handleTesteChange = (tipo: string) => {
    let fim = ''
    let status = contratacao.status_assinatura

    if (tipo === '7' || tipo === '14' || tipo === '30') {
      const days = parseInt(tipo, 10)
      const d = new Date()
      d.setDate(d.getDate() + days)
      fim = d.toISOString().split('T')[0]
      status = 'trial'
    } else if (tipo === 'sem_teste') {
      fim = ''
      status = 'ativa'
    }

    setContratacao((prev) => ({
      ...prev,
      periodo_teste_tipo: tipo,
      fim_periodo_teste: fim,
      status_assinatura: status,
    }))
  }

  const handleDescontoChange = (desc: number) => {
    const valContratado = Number(contratacao.valor_contratado) || 0
    const finalVal = Math.max(0, valContratado - desc)
    setContratacao((prev) => ({
      ...prev,
      desconto: desc,
      valor_final: finalVal,
    }))
  }

  // Validações por etapa
  const validateStep = (step: number): boolean => {
    if (step === 1) {
      if (!empresa.nome.trim()) {
        toast.error('Informe a Razão Social da empresa.')
        return false
      }
      const cleanCnpj = empresa.cnpj.replace(/\D/g, '')
      if (!cleanCnpj || cleanCnpj.length !== 14) {
        toast.error('Informe um CNPJ válido com 14 dígitos numéricos.')
        return false
      }
      if (!empresa.email.trim()) {
        toast.error('Informe o e-mail comercial da empresa.')
        return false
      }
      return true
    }

    if (step === 2) {
      if (!responsavel.nome.trim()) {
        toast.error('Informe o nome completo do responsável legal.')
        return false
      }
      if (!responsavel.email.trim()) {
        toast.error('Informe o e-mail do responsável legal.')
        return false
      }
      return true
    }

    if (step === 3) {
      if (!master.nome.trim()) {
        toast.error('Informe o nome completo do usuário Master.')
        return false
      }
      if (!master.email.trim() || !master.email.includes('@')) {
        toast.error('Informe um e-mail de acesso válido para o usuário Master.')
        return false
      }
      if (!master.senha || master.senha.length < 6) {
        toast.error('A senha inicial do Master deve ter pelo menos 6 caracteres.')
        return false
      }
      if (master.senha !== master.confirmarSenha) {
        toast.error('As senhas digitadas não coincidem.')
        return false
      }
      return true
    }

    if (step === 4) {
      if (!selectedPlanoSlug) {
        toast.error('Selecione um plano comercial.')
        return false
      }
      return true
    }

    if (step === 5) {
      if (!contratacao.data_inicio) {
        toast.error('Informe a data de início da vigência.')
        return false
      }
      if (!contratacao.proximo_vencimento) {
        toast.error('Informe a data do próximo vencimento.')
        return false
      }
      if (contratacao.proximo_vencimento < contratacao.data_inicio) {
        toast.error('O próximo vencimento não pode ser anterior à data de início.')
        return false
      }
      return true
    }

    return true
  }

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(ETAPAS.length, prev + 1))
    }
  }

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1))
  }

  const handleCopyMasterCredentials = () => {
    const text = `Acesso EVO Gestão:\nEmpresa: ${empresa.nome_fantasia || empresa.nome}\nUsuário Master: ${master.email}\nSenha Inicial: ${master.senha}\nLink de Acesso: ${window.location.origin}/auth`
    navigator.clipboard.writeText(text)
    toast.success('Credenciais copiadas para a área de transferência!')
  }

  const handleFinalSubmit = async () => {
    if (!validateStep(1) || !validateStep(2) || !validateStep(3) || !validateStep(5)) {
      return
    }

    try {
      setSubmitting(true)

      const payload: CadastroManualEmpresaInput = {
        empresa: {
          nome: empresa.nome.trim(),
          nome_fantasia: empresa.nome_fantasia.trim() || undefined,
          cnpj: empresa.cnpj.replace(/\D/g, ''),
          inscricao_estadual: empresa.inscricao_estadual || undefined,
          inscricao_municipal: empresa.inscricao_municipal || undefined,
          email: empresa.email.trim(),
          telefone: empresa.telefone || undefined,
          whatsapp: empresa.whatsapp || undefined,
          cep: empresa.cep || undefined,
          estado: empresa.estado || undefined,
          cidade: empresa.cidade || undefined,
          bairro: empresa.bairro || undefined,
          endereco: empresa.endereco || undefined,
          numero: empresa.numero || undefined,
          complemento: empresa.complemento || undefined,
          status: empresa.status,
          observacoes: empresa.observacoes || undefined,
        },
        responsavel: {
          nome: responsavel.nome.trim(),
          cpf: responsavel.cpf?.replace(/\D/g, '') || undefined,
          email: responsavel.email.trim(),
          telefone: responsavel.telefone || undefined,
          whatsapp: responsavel.whatsapp || undefined,
          cargo: responsavel.cargo || undefined,
        },
        master: {
          nome: master.nome.trim(),
          email: master.email.trim().toLowerCase(),
          telefone: master.telefone || undefined,
          senha: master.senha,
          enviar_convite: master.enviarConvite,
        },
        plano_slug: selectedPlanoSlug,
        contratacao: {
          data_contratacao: contratacao.data_contratacao,
          data_inicio: contratacao.data_inicio,
          fim_periodo_teste: contratacao.fim_periodo_teste || null,
          proximo_vencimento: contratacao.proximo_vencimento,
          valor_contratado: Number(contratacao.valor_contratado),
          desconto: Number(contratacao.desconto),
          valor_final: Number(contratacao.valor_final),
          forma_pagamento: contratacao.forma_pagamento,
          periodicidade: contratacao.periodicidade,
          status_assinatura: contratacao.status_assinatura,
          observacoes_comerciais: contratacao.observacoes_comerciais || undefined,
        },
      }

      const { data, error } = await AdminService.criarEmpresaManual(payload)
      if (error) throw error

      toast.success('Empresa, usuário Master e assinatura criados com sucesso!')
      onOpenChange(false)
      if (data?.empresa_id) {
        onSuccess(data.empresa_id)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao cadastrar empresa.')
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 bg-slate-950 border-slate-800 text-slate-100 overflow-hidden shadow-2xl">
        {/* Header do Wizard */}
        <DialogHeader className="px-6 py-4 border-b border-slate-800/80 bg-slate-900/60 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-950/50">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Cadastro Manual de Empresa</span>
                  <Badge className="bg-sky-500/20 text-sky-400 border-sky-500/40 text-[10px] font-semibold">
                    Platform Admin
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  Etapa {currentStep} de {ETAPAS.length}: {ETAPAS[currentStep - 1]?.title} —{' '}
                  {ETAPAS[currentStep - 1]?.desc}
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Stepper Horizontal Progress */}
          <div className="mt-4 hidden sm:grid grid-cols-7 gap-1">
            {ETAPAS.map((etapa) => {
              const Icon = etapa.icon
              const isDone = etapa.id < currentStep
              const isCurrent = etapa.id === currentStep
              return (
                <div
                  key={etapa.id}
                  onClick={() => {
                    if (etapa.id < currentStep) setCurrentStep(etapa.id)
                  }}
                  className={`flex flex-col items-center p-1.5 rounded-lg text-center transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-sky-500/15 border border-sky-500/40 text-sky-300 font-bold'
                      : isDone
                        ? 'text-emerald-400 hover:bg-slate-900'
                        : 'text-slate-400 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    {isDone ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Icon className="w-3.5 h-3.5" />
                    )}
                    <span className="text-[11px] font-medium">{etapa.title}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </DialogHeader>

        {/* Corpo Scrollável do Formulário */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar text-xs">
          {/* ============================================================ */}
          {/* ETAPA 1: DADOS DA EMPRESA */}
          {/* ============================================================ */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-fade-in-up">
              <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-300 flex items-center gap-2.5">
                <Building2 className="w-5 h-5 shrink-0 text-sky-400" />
                <p>
                  Preencha as informações cadastrais da nova empresa cliente. O CNPJ é único e
                  validará duplicidade no banco.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-slate-300 font-semibold">Razão Social *</label>
                  <Input
                    placeholder="Ex: Distribuidora Alvorada Ltda"
                    value={empresa.nome}
                    onChange={(e) => setEmpresa({ ...empresa, nome: e.target.value })}
                    className="bg-slate-900 border-slate-800 text-slate-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">Nome Fantasia</label>
                  <Input
                    placeholder="Ex: Alvorada Bebidas"
                    value={empresa.nome_fantasia}
                    onChange={(e) => setEmpresa({ ...empresa, nome_fantasia: e.target.value })}
                    className="bg-slate-900 border-slate-800 text-slate-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">CNPJ (14 dígitos) *</label>
                  <Input
                    placeholder="00.000.000/0000-00"
                    value={empresa.cnpj}
                    onChange={(e) => setEmpresa({ ...empresa, cnpj: e.target.value })}
                    className="bg-slate-900 border-slate-800 text-slate-100 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">Inscrição Estadual</label>
                  <Input
                    placeholder="Isento ou número da IE"
                    value={empresa.inscricao_estadual}
                    onChange={(e) => setEmpresa({ ...empresa, inscricao_estadual: e.target.value })}
                    className="bg-slate-900 border-slate-800 text-slate-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">Inscrição Municipal</label>
                  <Input
                    placeholder="Número da IM"
                    value={empresa.inscricao_municipal}
                    onChange={(e) =>
                      setEmpresa({ ...empresa, inscricao_municipal: e.target.value })
                    }
                    className="bg-slate-900 border-slate-800 text-slate-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">E-mail Comercial *</label>
                  <Input
                    type="email"
                    placeholder="contato@empresa.com.br"
                    value={empresa.email}
                    onChange={(e) => setEmpresa({ ...empresa, email: e.target.value })}
                    className="bg-slate-900 border-slate-800 text-slate-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">Telefone Comercial</label>
                  <Input
                    placeholder="(11) 3456-7890"
                    value={empresa.telefone}
                    onChange={(e) => setEmpresa({ ...empresa, telefone: e.target.value })}
                    className="bg-slate-900 border-slate-800 text-slate-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">WhatsApp da Empresa</label>
                  <Input
                    placeholder="(11) 98765-4321"
                    value={empresa.whatsapp}
                    onChange={(e) => setEmpresa({ ...empresa, whatsapp: e.target.value })}
                    className="bg-slate-900 border-slate-800 text-slate-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">Status Inicial</label>
                  <Select
                    value={empresa.status}
                    onValueChange={(val) => setEmpresa({ ...empresa, status: val })}
                  >
                    <SelectTrigger className="bg-slate-900 border-slate-800 text-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                      <SelectItem value="ativo">Ativa (Acesso Liberado)</SelectItem>
                      <SelectItem value="inativo">Inativa (Pendente)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Endereço */}
              <div className="pt-3 border-t border-slate-800/80">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                  Endereço da Sede
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-slate-400">CEP</label>
                    <Input
                      placeholder="00000-000"
                      value={empresa.cep}
                      onChange={(e) => setEmpresa({ ...empresa, cep: e.target.value })}
                      className="bg-slate-900 border-slate-800 text-slate-100"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-slate-400">Logradouro / Endereço</label>
                    <Input
                      placeholder="Av. Paulista, Rua das Flores..."
                      value={empresa.endereco}
                      onChange={(e) => setEmpresa({ ...empresa, endereco: e.target.value })}
                      className="bg-slate-900 border-slate-800 text-slate-100"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-slate-400">Número</label>
                    <Input
                      placeholder="1000"
                      value={empresa.numero}
                      onChange={(e) => setEmpresa({ ...empresa, numero: e.target.value })}
                      className="bg-slate-900 border-slate-800 text-slate-100"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-slate-400">Bairro</label>
                    <Input
                      placeholder="Centro"
                      value={empresa.bairro}
                      onChange={(e) => setEmpresa({ ...empresa, bairro: e.target.value })}
                      className="bg-slate-900 border-slate-800 text-slate-100"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-slate-400">Cidade / UF</label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="São Paulo"
                        value={empresa.cidade}
                        onChange={(e) => setEmpresa({ ...empresa, cidade: e.target.value })}
                        className="bg-slate-900 border-slate-800 text-slate-100 flex-1"
                      />
                      <Input
                        placeholder="UF"
                        value={empresa.estado}
                        onChange={(e) => setEmpresa({ ...empresa, estado: e.target.value })}
                        className="bg-slate-900 border-slate-800 text-slate-100 w-16 uppercase"
                        maxLength={2}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="text-slate-300 font-semibold">
                  Observações Internas da Plataforma
                </label>
                <Input
                  placeholder="Anotações comerciais ou operacionais visíveis apenas para Platform Admin..."
                  value={empresa.observacoes}
                  onChange={(e) => setEmpresa({ ...empresa, observacoes: e.target.value })}
                  className="bg-slate-900 border-slate-800 text-slate-100"
                />
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* ETAPA 2: RESPONSÁVEL LEGAL */}
          {/* ============================================================ */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-fade-in-up">
              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 flex items-center gap-2.5">
                <User className="w-5 h-5 shrink-0 text-indigo-400" />
                <p>
                  Dados do contato principal / representante legal da empresa para fins de contrato
                  e comunicação corporativa.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-slate-300 font-semibold">
                    Nome Completo do Responsável *
                  </label>
                  <Input
                    placeholder="Ex: Carlos Eduardo de Oliveira"
                    value={responsavel.nome}
                    onChange={(e) => setResponsavel({ ...responsavel, nome: e.target.value })}
                    className="bg-slate-900 border-slate-800 text-slate-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">CPF</label>
                  <Input
                    placeholder="000.000.000-00"
                    value={responsavel.cpf}
                    onChange={(e) => setResponsavel({ ...responsavel, cpf: e.target.value })}
                    className="bg-slate-900 border-slate-800 text-slate-100 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">Cargo / Função</label>
                  <Input
                    placeholder="Ex: Diretor Geral / Proprietário"
                    value={responsavel.cargo}
                    onChange={(e) => setResponsavel({ ...responsavel, cargo: e.target.value })}
                    className="bg-slate-900 border-slate-800 text-slate-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">E-mail do Responsável *</label>
                  <Input
                    type="email"
                    placeholder="carlos@empresa.com.br"
                    value={responsavel.email}
                    onChange={(e) => setResponsavel({ ...responsavel, email: e.target.value })}
                    className="bg-slate-900 border-slate-800 text-slate-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">Telefone / WhatsApp</label>
                  <Input
                    placeholder="(11) 98765-4321"
                    value={responsavel.whatsapp || responsavel.telefone}
                    onChange={(e) =>
                      setResponsavel({
                        ...responsavel,
                        whatsapp: e.target.value,
                        telefone: e.target.value,
                      })
                    }
                    className="bg-slate-900 border-slate-800 text-slate-100"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Usar os mesmos dados para o Usuário Master?</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setMaster((prev) => ({
                      ...prev,
                      nome: responsavel.nome,
                      email: responsavel.email,
                      telefone: responsavel.whatsapp || responsavel.telefone,
                    }))
                    toast.success('Dados copiados para a etapa de Acesso Master!')
                  }}
                  className="bg-slate-800 border-slate-700 text-sky-400 hover:text-sky-300 text-xs"
                >
                  Copiar para Master →
                </Button>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* ETAPA 3: ACESSO INICIAL (PRIMEIRO MASTER) */}
          {/* ============================================================ */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-fade-in-up">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-400" />
                <p>
                  Criação do <strong>primeiro usuário Master</strong> da empresa. Ele terá acesso
                  total para gerenciar a distribuidora de forma 100% isolada e exclusiva.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-slate-300 font-semibold">Nome Completo do Usuário *</label>
                  <Input
                    placeholder="Ex: Carlos Oliveira (Master)"
                    value={master.nome}
                    onChange={(e) => setMaster({ ...master, nome: e.target.value })}
                    className="bg-slate-900 border-slate-800 text-slate-100"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-slate-300 font-semibold">
                    E-mail de Login do Usuário Master *
                  </label>
                  <Input
                    type="email"
                    placeholder="master@empresa.com.br"
                    value={master.email}
                    onChange={(e) => setMaster({ ...master, email: e.target.value })}
                    className="bg-slate-900 border-slate-800 text-slate-100 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">Senha Inicial *</label>
                  <Input
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={master.senha}
                    onChange={(e) => setMaster({ ...master, senha: e.target.value })}
                    className="bg-slate-900 border-slate-800 text-slate-100 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">Confirmar Senha *</label>
                  <Input
                    type="password"
                    placeholder="Digite a senha novamente"
                    value={master.confirmarSenha}
                    onChange={(e) => setMaster({ ...master, confirmarSenha: e.target.value })}
                    className="bg-slate-900 border-slate-800 text-slate-100 font-mono"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-slate-300 font-semibold">Perfil de Acesso</label>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-sky-500/20 text-sky-400 border-sky-500/40 text-xs">
                        MASTER
                      </Badge>
                      <span className="text-slate-400 text-xs">
                        Acesso total aos módulos comerciais e configurações da empresa.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* ETAPA 4: PLANO CONTRATADO */}
          {/* ============================================================ */}
          {currentStep === 4 && (
            <div className="space-y-4 animate-fade-in-up">
              <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-300 flex items-center gap-2.5">
                <Layers className="w-5 h-5 shrink-0 text-sky-400" />
                <p>
                  Selecione o plano contratado pela empresa. Os limites e recursos serão atribuídos
                  automaticamente.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {planos.map((p) => {
                  const isSelected = selectedPlanoSlug === p.slug
                  return (
                    <div
                      key={p.id}
                      onClick={() => handlePlanoSelect(p.slug)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-sky-950/60 border-sky-500 shadow-md shadow-sky-950 text-white'
                          : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-bold text-base text-white">{p.nome}</h4>
                          {isSelected && (
                            <Badge className="bg-sky-500 text-white text-[10px]">Selecionado</Badge>
                          )}
                        </div>
                        <p className="text-xl font-black text-white font-mono mb-3">
                          {formatCurrency(p.valor_mensal)}
                          <span className="text-xs font-normal text-slate-400">/mês</span>
                        </p>

                        <div className="space-y-1.5 text-xs text-slate-300 pt-2 border-t border-slate-800/80">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Usuários:</span>
                            <span className="font-semibold">
                              {p.limite_usuarios ?? 'Ilimitado'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Vendedores:</span>
                            <span className="font-semibold">
                              {p.limite_vendedores ?? 'Ilimitado'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Clientes:</span>
                            <span className="font-semibold">
                              {p.limite_clientes ?? 'Ilimitado'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Produtos:</span>
                            <span className="font-semibold">
                              {p.limite_produtos ?? 'Ilimitado'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* ETAPA 5: CONTRATAÇÃO MANUAL */}
          {/* ============================================================ */}
          {currentStep === 5 && (
            <div className="space-y-4 animate-fade-in-up">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-center gap-2.5">
                <CreditCard className="w-5 h-5 shrink-0 text-amber-400" />
                <p>
                  Defina as condições comerciais, vigência, período de teste e valores negociados
                  manualmente com a distribuidora.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">Data da Contratação *</label>
                  <Input
                    type="date"
                    value={contratacao.data_contratacao}
                    onChange={(e) =>
                      setContratacao({ ...contratacao, data_contratacao: e.target.value })
                    }
                    className="bg-slate-900 border-slate-800 text-slate-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">
                    Data de Início da Vigência *
                  </label>
                  <Input
                    type="date"
                    value={contratacao.data_inicio}
                    onChange={(e) =>
                      setContratacao({ ...contratacao, data_inicio: e.target.value })
                    }
                    className="bg-slate-900 border-slate-800 text-slate-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">Próximo Vencimento *</label>
                  <Input
                    type="date"
                    value={contratacao.proximo_vencimento}
                    onChange={(e) =>
                      setContratacao({ ...contratacao, proximo_vencimento: e.target.value })
                    }
                    className="bg-slate-900 border-slate-800 text-slate-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">Período de Teste (Trial)</label>
                  <Select value={contratacao.periodo_teste_tipo} onValueChange={handleTesteChange}>
                    <SelectTrigger className="bg-slate-900 border-slate-800 text-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                      <SelectItem value="sem_teste">Sem Teste (Início Imediato)</SelectItem>
                      <SelectItem value="7">7 Dias de Teste Grátis</SelectItem>
                      <SelectItem value="14">14 Dias de Teste Grátis</SelectItem>
                      <SelectItem value="30">30 Dias de Teste Grátis</SelectItem>
                      <SelectItem value="custom">Data Personalizada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {contratacao.periodo_teste_tipo !== 'sem_teste' && (
                  <div className="space-y-1.5">
                    <label className="text-slate-300 font-semibold">Término do Teste</label>
                    <Input
                      type="date"
                      value={contratacao.fim_periodo_teste}
                      onChange={(e) =>
                        setContratacao({ ...contratacao, fim_periodo_teste: e.target.value })
                      }
                      className="bg-slate-900 border-slate-800 text-slate-100"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">Status da Assinatura</label>
                  <Select
                    value={contratacao.status_assinatura}
                    onValueChange={(val) =>
                      setContratacao({ ...contratacao, status_assinatura: val })
                    }
                  >
                    <SelectTrigger className="bg-slate-900 border-slate-800 text-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                      <SelectItem value="ativa">Ativa</SelectItem>
                      <SelectItem value="trial">Em Teste (Trial)</SelectItem>
                      <SelectItem value="pendente">Pendente de Pagamento</SelectItem>
                      <SelectItem value="suspensa">Suspensa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">Forma de Pagamento</label>
                  <Select
                    value={contratacao.forma_pagamento}
                    onValueChange={(val) =>
                      setContratacao({ ...contratacao, forma_pagamento: val })
                    }
                  >
                    <SelectTrigger className="bg-slate-900 border-slate-800 text-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="boleto">Boleto Bancário</SelectItem>
                      <SelectItem value="cartao">Cartão de Crédito</SelectItem>
                      <SelectItem value="transferencia">Transferência Bancária</SelectItem>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="outro">Outro / Especial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">Periodicidade</label>
                  <Select
                    value={contratacao.periodicidade}
                    onValueChange={(val) => setContratacao({ ...contratacao, periodicidade: val })}
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
                  <label className="text-slate-300 font-semibold">Valor Contratado (R$)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={contratacao.valor_contratado}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0
                      setContratacao({
                        ...contratacao,
                        valor_contratado: val,
                        valor_final: Math.max(0, val - contratacao.desconto),
                      })
                    }}
                    className="bg-slate-900 border-slate-800 text-slate-100 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">Desconto Negociado (R$)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={contratacao.desconto}
                    onChange={(e) => handleDescontoChange(parseFloat(e.target.value) || 0)}
                    className="bg-slate-900 border-slate-800 text-slate-100 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-emerald-400 font-semibold">Valor Final Mensal (R$)</label>
                  <div className="h-10 px-3 rounded-md bg-emerald-950/40 border border-emerald-500/40 flex items-center font-mono font-bold text-emerald-400 text-sm">
                    {formatCurrency(contratacao.valor_final)}
                  </div>
                </div>

                <div className="space-y-1.5 sm:col-span-3">
                  <label className="text-slate-300 font-semibold">Observações Comerciais</label>
                  <Input
                    placeholder="Ex: Condição especial de implantação, desconto de inauguração..."
                    value={contratacao.observacoes_comerciais}
                    onChange={(e) =>
                      setContratacao({ ...contratacao, observacoes_comerciais: e.target.value })
                    }
                    className="bg-slate-900 border-slate-800 text-slate-100"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* ETAPA 6: RESPONSÁVEL PELA VENDA / AUDITORIA */}
          {/* ============================================================ */}
          {currentStep === 6 && (
            <div className="space-y-4 animate-fade-in-up">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-2.5">
                <UserCheck className="w-5 h-5 shrink-0 text-sky-400" />
                <p>
                  Registro do operador administrativo da plataforma que está homologando o cadastro
                  para fins de rastreabilidade e auditoria.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Platform Admin Autenticado:</span>
                  <span className="font-bold text-white text-sm">
                    {usuario?.nome || 'Admin Plataforma'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">E-mail do Administrador:</span>
                  <span className="font-mono text-slate-200">{user?.email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Perfil:</span>
                  <Badge className="bg-sky-500/20 text-sky-400 border-sky-500/40 text-xs">
                    PLATFORM_ADMIN
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Data e Hora do Cadastro:</span>
                  <span className="font-mono text-slate-300">
                    {new Date().toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* ETAPA 7: RESUMO ANTES DE SALVAR */}
          {/* ============================================================ */}
          {currentStep === 7 && (
            <div className="space-y-4 animate-fade-in-up">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
                  <p>
                    Revise todos os dados antes de confirmar. Ao salvar, a empresa, o usuário Master
                    e a assinatura serão criados de forma transacional.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyMasterCredentials}
                  className="bg-slate-900 border-slate-700 text-emerald-400 hover:text-emerald-300 text-xs"
                >
                  Copiar Acesso Master
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Card Empresa */}
                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                  <h4 className="font-bold text-white flex items-center gap-1.5 text-xs text-sky-400 uppercase tracking-wider">
                    <Building2 className="w-4 h-4" /> Dados da Empresa
                  </h4>
                  <p className="text-sm font-bold text-white">{empresa.nome}</p>
                  <p className="text-slate-400">Fantasia: {empresa.nome_fantasia || '-'}</p>
                  <p className="text-slate-400 font-mono">CNPJ: {empresa.cnpj}</p>
                  <p className="text-slate-400">E-mail: {empresa.email}</p>
                  <p className="text-slate-400">
                    Cidade/UF: {empresa.cidade}/{empresa.estado}
                  </p>
                </div>

                {/* Card Master */}
                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                  <h4 className="font-bold text-white flex items-center gap-1.5 text-xs text-emerald-400 uppercase tracking-wider">
                    <KeyRound className="w-4 h-4" /> Usuário Master
                  </h4>
                  <p className="text-sm font-bold text-white">{master.nome}</p>
                  <p className="text-slate-300 font-mono">Login: {master.email}</p>
                  <p className="text-slate-400 font-mono">Senha: •••••••• ({master.senha})</p>
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs">
                    Perfil MASTER
                  </Badge>
                </div>

                {/* Card Plano e Valores */}
                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 sm:col-span-2">
                  <h4 className="font-bold text-white flex items-center gap-1.5 text-xs text-indigo-400 uppercase tracking-wider">
                    <Layers className="w-4 h-4" /> Plano e Condições da Assinatura
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                    <div>
                      <span className="text-slate-400 block">Plano:</span>
                      <strong className="text-white">{selectedPlano?.nome}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Valor Final:</span>
                      <strong className="text-emerald-400 font-mono">
                        {formatCurrency(contratacao.valor_final)}/mês
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Forma Pagto:</span>
                      <span className="text-slate-200 capitalize">
                        {contratacao.forma_pagamento}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Vencimento:</span>
                      <span className="text-slate-200">
                        {contratacao.proximo_vencimento.split('-').reverse().join('/')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer com Botões de Navegação */}
        <DialogFooter className="px-6 py-4 border-t border-slate-800/80 bg-slate-900/60 shrink-0 flex items-center justify-between sm:justify-between">
          <div>
            {currentStep > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleBack}
                disabled={submitting}
                className="bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Voltar
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="text-slate-400 hover:text-white"
            >
              Cancelar
            </Button>

            {currentStep < ETAPAS.length ? (
              <Button
                type="button"
                size="sm"
                onClick={handleNext}
                className="bg-sky-600 hover:bg-sky-500 text-white font-semibold shadow-md shadow-sky-950/40"
              >
                Avançar
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={handleFinalSubmit}
                disabled={submitting}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md shadow-emerald-950/50"
              >
                {submitting ? (
                  <>
                    <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                    Processando Cadastro...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Confirmar e Criar Empresa
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
