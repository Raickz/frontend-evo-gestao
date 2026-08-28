import React, { useState } from 'react'
import { CreditCard, DollarSign, Calendar, CheckCircle2, Sparkles } from 'lucide-react'
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

interface RegistrarPagamentoManualModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  assinatura: AdminAssinaturaItem | null
  onSuccess: () => void
}

export function RegistrarPagamentoManualModal({
  open,
  onOpenChange,
  assinatura,
  onSuccess,
}: RegistrarPagamentoManualModalProps) {
  const [submitting, setSubmitting] = useState(false)

  const todayStr = new Date().toISOString().split('T')[0]
  const defaultNext = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const currentMonthCompetencia = () => {
    const d = new Date()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    return `${month}/${d.getFullYear()}`
  }

  const [form, setForm] = useState({
    valor: assinatura?.valor || 0,
    data_pagamento: todayStr,
    forma_pagamento: 'pix',
    competencia: currentMonthCompetencia(),
    proximo_vencimento: defaultNext,
    referencia: '',
  })

  // Sincronizar quando abrir
  React.useEffect(() => {
    if (assinatura && open) {
      setForm({
        valor: assinatura.valor || 0,
        data_pagamento: todayStr,
        forma_pagamento: assinatura.metodo_pagamento || 'pix',
        competencia: currentMonthCompetencia(),
        proximo_vencimento: defaultNext,
        referencia: '',
      })
    }
  }, [assinatura, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assinatura) return

    if (!form.valor || Number(form.valor) <= 0) {
      toast.error('Informe um valor de pagamento válido.')
      return
    }

    if (!form.data_pagamento) {
      toast.error('Informe a data do pagamento.')
      return
    }

    try {
      setSubmitting(true)
      const { data, error } = await AdminService.registrarPagamentoManual({
        empresa_id: assinatura.empresa_id,
        valor: Number(form.valor),
        data_pagamento: form.data_pagamento,
        forma_pagamento: form.forma_pagamento,
        competencia: form.competencia,
        proximo_vencimento: form.proximo_vencimento,
        referencia: form.referencia,
      })

      if (error) throw error

      toast.success(data?.message || 'Pagamento manual registrado com sucesso!')
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao registrar pagamento manual.')
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
      <DialogContent className="max-w-md bg-slate-950 border-slate-800 text-slate-100 p-0 overflow-hidden shadow-2xl">
        <DialogHeader className="px-6 py-4 border-b border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white">
                Registrar Pagamento Manual
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                {assinatura?.empresa_nome_fantasia || assinatura?.empresa_nome}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Plano:</span>
              <strong className="text-white">{assinatura?.plano_nome}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Mensalidade Contratada:</span>
              <span className="font-mono font-semibold text-emerald-400">
                {formatCurrency(assinatura?.valor || 0)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold">Valor Pago (R$) *</label>
              <Input
                type="number"
                step="0.01"
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: parseFloat(e.target.value) || 0 })}
                className="bg-slate-900 border-slate-800 text-slate-100 font-mono"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold">Data do Pagamento *</label>
              <Input
                type="date"
                value={form.data_pagamento}
                onChange={(e) => setForm({ ...form, data_pagamento: e.target.value })}
                className="bg-slate-900 border-slate-800 text-slate-100"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold">Forma de Pagamento</label>
              <Select
                value={form.forma_pagamento}
                onValueChange={(val) => setForm({ ...form, forma_pagamento: val })}
              >
                <SelectTrigger className="bg-slate-900 border-slate-800 text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="boleto">Boleto Bancário</SelectItem>
                  <SelectItem value="cartao">Cartão de Crédito</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold">Mês / Competência</label>
              <Input
                placeholder="MM/AAAA (ex: 04/2026)"
                value={form.competencia}
                onChange={(e) => setForm({ ...form, competencia: e.target.value })}
                className="bg-slate-900 border-slate-800 text-slate-100"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-slate-300 font-semibold">Novo Próximo Vencimento</label>
              <Input
                type="date"
                value={form.proximo_vencimento}
                onChange={(e) => setForm({ ...form, proximo_vencimento: e.target.value })}
                className="bg-slate-900 border-slate-800 text-slate-100"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-slate-300 font-semibold">
                Referência / Identificador / Observação
              </label>
              <Input
                placeholder="Ex: Comprovante PIX E2E 123456, depósito em conta..."
                value={form.referencia}
                onChange={(e) => setForm({ ...form, referencia: e.target.value })}
                className="bg-slate-900 border-slate-800 text-slate-100"
              />
            </div>
          </div>

          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-lg text-[11px]">
            Ao registrar este pagamento, a assinatura será reativada/mantida como{' '}
            <strong>Ativa</strong>, um registro financeiro de transação aprovada será criado e o
            histórico será preservado.
          </div>

          <DialogFooter className="pt-2">
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
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              {submitting ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 mr-2 animate-spin" />
                  Gravando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  Confirmar Pagamento
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
