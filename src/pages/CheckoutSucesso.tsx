import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
  Building2,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useEmpresa } from '@/hooks/use-empresa'
import { toast } from '@/hooks/use-toast'

export default function CheckoutSucessoPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { refreshStatus } = useEmpresa()

  const status = searchParams.get('status') || 'approved'
  const planoSlug = searchParams.get('plano') || 'profissional'
  const isPending = status === 'pending'
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // Atualiza status da assinatura em segundo plano
    refreshStatus()
  }, [refreshStatus])

  const handleCopyPix = () => {
    navigator.clipboard.writeText(
      '00020126580014br.gov.bcb.pix0136evogestao-pix-mercadopago5204000053039865802BR5910EVO GESTAO6009SAO PAULO62070503***6304ABCD',
    )
    setCopied(true)
    toast({
      title: 'Código PIX copiado!',
      description: 'Cole no aplicativo do seu banco para finalizar.',
      className: 'bg-emerald-700 text-white border-emerald-600',
    })
    setTimeout(() => setCopied(false), 3000)
  }

  return (
    <div className="min-h-screen bg-[#0B1523] text-white flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-teal-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full mx-auto space-y-6 relative z-10 my-auto">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 items-center justify-center shadow-xl shadow-teal-950/60 border border-teal-400/20">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">EVO Gestão</h1>
        </div>

        <Card className="rounded-2xl border-slate-800 bg-slate-900/90 text-white shadow-2xl backdrop-blur-md">
          <CardHeader className="text-center pb-3">
            <div className="flex justify-center mb-3">
              {isPending ? (
                <div className="h-16 w-16 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center animate-pulse">
                  <Clock className="w-8 h-8" />
                </div>
              ) : (
                <div className="h-16 w-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
              )}
            </div>

            <Badge
              className={`mx-auto mb-2 text-xs font-semibold ${
                isPending
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              }`}
            >
              {isPending ? 'Pagamento Pendente / Em Análise' : 'Pagamento Aprovado'}
            </Badge>

            <CardTitle className="text-xl font-bold text-white">
              {isPending ? 'Aguardando confirmação do pagamento' : 'Sua assinatura está ativa!'}
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs mt-1">
              {isPending
                ? 'Assim que o Mercado Pago confirmar o processamento, seu plano será liberado imediatamente.'
                : 'Obrigado por assinar o EVO Gestão. Todos os recursos do seu plano já estão liberados.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-2 text-xs text-slate-300">
            {isPending ? (
              <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 space-y-3">
                <p className="text-slate-300">
                  Caso tenha optado por <strong>PIX</strong> ou <strong>Boleto</strong>, utilize o
                  QR Code gerado na tela do Mercado Pago ou clique abaixo para copiar o código.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyPix}
                  className="w-full border-slate-700 bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center gap-2 h-9 text-xs"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copied ? 'Código Copiado!' : 'Copiar Código PIX'}
                </Button>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/40 space-y-2">
                <div className="flex items-center gap-2 text-emerald-300 font-semibold">
                  <Sparkles className="w-4 h-4" />
                  <span>Distribuidora Pronta para Crescer</span>
                </div>
                <p className="text-emerald-200/80 text-[11px]">
                  Sua empresa agora tem acesso total a gestão de pedidos, comissões em cascata,
                  controle de estoque e relatórios financeiros completos.
                </p>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-2 pt-2 border-t border-slate-800">
            <Button
              onClick={() => {
                refreshStatus()
                navigate('/app/dashboard')
              }}
              className="w-full bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-slate-950 font-bold h-11 rounded-xl shadow-lg shadow-teal-950/60 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Ir para o Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </Button>

            {isPending && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  refreshStatus()
                  toast({
                    title: 'Atualizando status...',
                    description: 'Verificando pagamentos recebidos no Mercado Pago.',
                  })
                }}
                className="w-full text-xs text-slate-400 hover:text-white"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                Verificar status novamente
              </Button>
            )}
          </CardFooter>
        </Card>

        <p className="text-center text-[11px] text-slate-500">
          Dúvidas sobre sua assinatura? Entre em contato com o suporte em suporte@evogestao.com.br
        </p>
      </div>
    </div>
  )
}
