import React from 'react'

interface PrintFooterProps {
  informacoesAdicionais?: string | null
  exibirAssinaturas?: boolean
  assinatura1Label?: string
  assinatura2Label?: string
}

export const PrintFooter: React.FC<PrintFooterProps> = ({
  informacoesAdicionais,
  exibirAssinaturas = true,
  assinatura1Label = 'Assinatura do Responsável',
  assinatura2Label = 'Assinatura do Cliente / Recebedor',
}) => {
  const dataHoraAtual = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return (
    <footer className="mt-8 pt-4 border-t border-slate-300 print:border-black text-xs text-slate-600 print:text-slate-700">
      {informacoesAdicionais && (
        <div className="mb-6 p-3 bg-slate-50 rounded border border-slate-200 print:bg-white print:border-slate-300 text-[11px] leading-relaxed">
          <p className="font-semibold text-slate-800 mb-0.5 print:text-black">
            Observações Gerais:
          </p>
          <p className="whitespace-pre-line text-slate-700 print:text-black">
            {informacoesAdicionais}
          </p>
        </div>
      )}

      {exibirAssinaturas && (
        <div className="my-8 pt-4 grid grid-cols-2 gap-8 print:my-10">
          <div className="text-center">
            <div className="border-t border-slate-400 pt-1.5 mx-auto max-w-[220px] print:border-black">
              <p className="font-medium text-slate-800 text-[11px] print:text-black">
                {assinatura1Label}
              </p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-slate-400 pt-1.5 mx-auto max-w-[220px] print:border-black">
              <p className="font-medium text-slate-800 text-[11px] print:text-black">
                {assinatura2Label}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-400 print:text-slate-600 pt-2 border-t border-slate-200 print:border-slate-300">
        <p>Documento gerado pelo EVO Gestão</p>
        <p>Impresso em {dataHoraAtual}</p>
      </div>
    </footer>
  )
}
