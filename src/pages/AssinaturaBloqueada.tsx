import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useEmpresa } from '@/hooks/use-empresa'
import {
  Clock,
  ShieldAlert,
  Calendar,
  Layers,
  HelpCircle,
  PhoneCall,
  Sparkles,
  ArrowRight,
  Database,
} from 'lucide-react'

interface AssinaturaBloqueadaProps {
  onVerPlanos?: () => void
}

export default function AssinaturaBloqueadaPage({ onVerPlanos }: AssinaturaBloqueadaProps) {
  const { statusAssinatura, empresa } = useEmpresa()
  const navigate = useNavigate()
  const [modalSuporteOpen, setModalSuporteOpen] = useState(false)

  const planoNome = statusAssinatura?.plano_nome || 'Profissional'
  const fimData = statusAssinatura?.fim_periodo_teste
    ? new Date(statusAssinatura.fim_periodo_teste).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : null

  const isCanceladaOuBloqueada =
    statusAssinatura?.status === 'cancelada' || statusAssinatura?.status === 'bloqueada'

  const handleActionVerPlanos = () => {
    if (onVerPlanos) {
      onVerPlanos()
    } else {
      navigate('/planos')
    }
  }

  return (
    <div className="py-8 px-4 sm:px-6 flex flex-col items-center justify-center max-w-4xl mx-auto space-y-6 animate-fade-in-up">
      {/* Card Principal de Bloqueio */}
      <Card className="w-full border-rose-200 bg-white shadow-md rounded-2xl overflow-hidden">
        {/* Top Banner Vermelho */}
        <div className="bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 p-6 sm:p-8 text-white flex flex-col sm:flex-row items-center gap-5">
          <div className="h-16 w-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
            {isCanceladaOuBloqueada ? (
              <ShieldAlert className="w-8 h-8 text-white" />
            ) : (
              <Clock className="w-8 h-8 text-white" />
            )}
          </div>
          <div className="text-center sm:text-left space-y-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full">
                {isCanceladaOuBloqueada ? 'Assinatura Inativa' : 'Período de Teste Finalizado'}
              </span>
              <Badge className="bg-rose-900/60 text-rose-100 border-none font-bold text-xs">
                Plano {planoNome}
              </Badge>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              {isCanceladaOuBloqueada
                ? 'Sua assinatura foi desativada'
                : 'Seu período de teste terminou'}
            </h2>
            <p className="text-sm text-rose-100/90 max-w-xl">
              {isCanceladaOuBloqueada
                ? statusAssinatura?.motivo_bloqueio ||
                  'Entre em contato com o suporte EVO Gestão para regularizar sua conta.'
                : 'Para continuar criando registros operacionais, pedidos e movimentações, faça a regularização do seu plano.'}
            </p>
          </div>
        </div>

        <CardContent className="p-6 sm:p-8 space-y-6">
          {/* Informações dos Dados Preservados */}
          <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 flex items-start gap-3.5">
            <div className="h-9 w-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-emerald-950">
                Todos os seus dados estão 100% seguros e preservados
              </h4>
              <p className="text-xs text-emerald-800/90 mt-0.5 leading-relaxed">
                Você ainda pode consultar relatórios, visualizar clientes, produtos, histórico de
                vendas e informações da {empresa?.nome || 'sua empresa'}. Apenas as operações de
                escrita e cadastro foram pausadas temporariamente.
              </p>
            </div>
          </div>

          {/* Detalhes do Plano */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/80 space-y-1">
              <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                Plano Atual
              </span>
              <p className="text-sm font-bold text-slate-900">{planoNome}</p>
            </div>

            {fimData && (
              <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/80 space-y-1">
                <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Encerramento do Trial
                </span>
                <p className="text-sm font-bold text-slate-900">{fimData}</p>
              </div>
            )}

            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/80 space-y-1">
              <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                Modo de Operação
              </span>
              <p className="text-sm font-bold text-amber-700">Somente Leitura</p>
            </div>
          </div>

          {/* Ações */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => navigate('/app/configuracoes')}
              className="w-full sm:w-auto text-xs h-10 border-slate-200 text-slate-700 hover:bg-slate-50 font-medium"
            >
              Ir para Configurações
            </Button>
            <Button
              onClick={handleActionVerPlanos}
              className="w-full sm:w-auto text-xs h-10 bg-teal-700 hover:bg-teal-800 text-white font-bold flex items-center gap-2 shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              Ver Planos & Regularizar
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modal Informativo de Contratação / Suporte */}
      <Dialog open={modalSuporteOpen} onOpenChange={setModalSuporteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="h-10 w-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center mb-2">
              <PhoneCall className="w-5 h-5" />
            </div>
            <DialogTitle className="text-base font-bold text-slate-900">
              Contratação de Planos EVO Gestão
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              A contratação de planos estará disponível em breve. Entre em contato com o suporte EVO
              Gestão para regularizar sua assinatura.
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 text-xs space-y-3">
            <div className="p-3.5 rounded-xl border border-teal-100 bg-teal-50/50 space-y-2">
              <p className="font-semibold text-teal-900">
                Deseja ativar seu plano ou tirar dúvidas comerciais?
              </p>
              <p className="text-slate-600">
                Nossa equipe de atendimento está pronta para orientar sobre os planos adequados para
                o volume da sua distribuidora.
              </p>
            </div>
            <div className="p-3 rounded-lg border border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-slate-500 font-medium">Suporte EVO:</span>
              <span className="font-mono font-semibold text-slate-900">
                suporte@evogestao.com.br
              </span>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalSuporteOpen(false)}
              className="text-xs"
            >
              Fechar
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setModalSuporteOpen(false)
                navigate('/app/configuracoes')
              }}
              className="bg-teal-700 hover:bg-teal-800 text-white text-xs"
            >
              Ver Detalhes do Plano
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
