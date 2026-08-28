import React, { useState } from 'react'
import { ShieldAlert, ShieldCheck, XCircle, Clock, Sparkles, AlertTriangle } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AdminService, AdminAssinaturaItem } from '@/services/admin'
import { toast } from 'sonner'

interface AcoesAssinaturaModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tipo: 'suspender' | 'reativar' | 'cancelar' | 'estender_teste' | null
  assinatura: AdminAssinaturaItem | null
  onSuccess: () => void
}

export function AcoesAssinaturaModal({
  open,
  onOpenChange,
  tipo,
  assinatura,
  onSuccess,
}: AcoesAssinaturaModalProps) {
  const [submitting, setSubmitting] = useState(false)
  const [motivo, setMotivo] = useState('Inadimplência')
  const [observacao, setObservacao] = useState('')
  const [dataVencimento, setDataVencimento] = useState('')
  const [dataFimTeste, setDataFimTeste] = useState('')

  React.useEffect(() => {
    if (open && assinatura) {
      setObservacao('')
      if (tipo === 'suspender') {
        setMotivo('Inadimplência')
      } else if (tipo === 'cancelar') {
        setMotivo('Solicitação do cliente')
      } else if (tipo === 'reativar') {
        const d = new Date()
        d.setDate(d.getDate() + 30)
        setDataVencimento(d.toISOString().split('T')[0])
      } else if (tipo === 'estender_teste') {
        const d = new Date()
        d.setDate(d.getDate() + 7)
        setDataFimTeste(d.toISOString().split('T')[0])
      }
    }
  }, [open, tipo, assinatura])

  const handleConfirm = async () => {
    if (!assinatura || !tipo) return

    try {
      setSubmitting(true)
      let payload: any = {}

      if (tipo === 'suspender') {
        payload = { motivo, observacao }
      } else if (tipo === 'cancelar') {
        payload = { motivo, observacao }
      } else if (tipo === 'reativar') {
        payload = { vencimento: dataVencimento }
      } else if (tipo === 'estender_teste') {
        payload = { fim_periodo_teste: dataFimTeste }
      }

      const { data, error } = await AdminService.atualizarAssinaturaManual(
        assinatura.empresa_id,
        tipo,
        payload,
      )

      if (error) throw error

      toast.success(data?.message || 'Ação executada com sucesso!')
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao executar ação.')
    } finally {
      setSubmitting(false)
    }
  }

  const getTitle = () => {
    switch (tipo) {
      case 'suspender':
        return 'Suspender Assinatura'
      case 'reativar':
        return 'Reativar Assinatura'
      case 'cancelar':
        return 'Cancelar Contrato de Assinatura'
      case 'estender_teste':
        return 'Estender Período de Teste (Trial)'
      default:
        return 'Ação na Assinatura'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-slate-950 border-slate-800 text-slate-100 p-0 overflow-hidden shadow-2xl">
        <DialogHeader className="px-6 py-4 border-b border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div
              className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                tipo === 'suspender' || tipo === 'cancelar'
                  ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                  : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
              }`}
            >
              {tipo === 'suspender' && <ShieldAlert className="w-5 h-5" />}
              {tipo === 'cancelar' && <XCircle className="w-5 h-5" />}
              {tipo === 'reativar' && <ShieldCheck className="w-5 h-5" />}
              {tipo === 'estender_teste' && <Clock className="w-5 h-5" />}
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white">{getTitle()}</DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                {assinatura?.empresa_nome_fantasia || assinatura?.empresa_nome}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-4 text-xs">
          {tipo === 'suspender' && (
            <>
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-lg">
                Ao suspender, o acesso operacional dos usuários da empresa será temporariamente
                bloqueado.
              </div>
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold">Motivo da Suspensão *</label>
                <Select value={motivo} onValueChange={setMotivo}>
                  <SelectTrigger className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="Inadimplência">
                      Inadimplência / Falta de Pagamento
                    </SelectItem>
                    <SelectItem value="Solicitação do cliente">Solicitação do Cliente</SelectItem>
                    <SelectItem value="Cancelamento administrativo">
                      Cancelamento Administrativo
                    </SelectItem>
                    <SelectItem value="Outro">Outro Motivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold">Observações Adicionais</label>
                <Input
                  placeholder="Detalhes ou justificativa..."
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  className="bg-slate-900 border-slate-800 text-slate-100"
                />
              </div>
            </>
          )}

          {tipo === 'cancelar' && (
            <>
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-lg">
                O cancelamento marca o fim do contrato. <strong>Nenhum dado será apagado</strong>,
                garantindo histórico fiscal e auditoria completos.
              </div>
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold">Motivo do Cancelamento *</label>
                <Select value={motivo} onValueChange={setMotivo}>
                  <SelectTrigger className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="Solicitação do cliente">Solicitação do Cliente</SelectItem>
                    <SelectItem value="Encerramento de atividades">
                      Encerramento de Atividades
                    </SelectItem>
                    <SelectItem value="Troca de fornecedor">Troca de Fornecedor</SelectItem>
                    <SelectItem value="Inadimplência contínua">Inadimplência Contínua</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold">Observação do Cancelamento</label>
                <Input
                  placeholder="Anotações comerciais sobre o churn..."
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  className="bg-slate-900 border-slate-800 text-slate-100"
                />
              </div>
            </>
          )}

          {tipo === 'reativar' && (
            <>
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-lg">
                A assinatura será restabelecida como <strong>Ativa</strong> e o acesso da empresa
                liberado.
              </div>
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold">Novo Próximo Vencimento *</label>
                <Input
                  type="date"
                  value={dataVencimento}
                  onChange={(e) => setDataVencimento(e.target.value)}
                  className="bg-slate-900 border-slate-800 text-slate-100"
                  required
                />
              </div>
            </>
          )}

          {tipo === 'estender_teste' && (
            <>
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-lg">
                Defina a nova data limite para o período de teste grátis (Trial).
              </div>
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold">Nova Data Término do Teste *</label>
                <Input
                  type="date"
                  value={dataFimTeste}
                  onChange={(e) => setDataFimTeste(e.target.value)}
                  className="bg-slate-900 border-slate-800 text-slate-100"
                  required
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-slate-800/80 bg-slate-900/60">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="text-slate-400 hover:text-white"
          >
            Voltar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={submitting}
            className={`font-bold ${
              tipo === 'suspender' || tipo === 'cancelar'
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {submitting ? (
              <>
                <Sparkles className="w-3.5 h-3.5 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              'Confirmar Ação'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
