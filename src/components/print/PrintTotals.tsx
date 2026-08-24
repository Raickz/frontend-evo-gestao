import React from 'react'

interface PrintTotalsProps {
  subtotal?: number | null
  desconto?: number | null
  total: number
  formaPagamento?: string | null
  observacoesFinanceiras?: React.ReactNode
}

const formatCurrency = (val: number | null | undefined): string => {
  return Number(val || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export const PrintTotals: React.FC<PrintTotalsProps> = ({
  subtotal,
  desconto,
  total,
  formaPagamento,
  observacoesFinanceiras,
}) => {
  const showSubtotal = subtotal !== undefined && subtotal !== null
  const showDesconto = desconto !== undefined && desconto !== null && Number(desconto) > 0

  return (
    <div className="flex flex-col sm:flex-row justify-between items-start gap-4 my-6 pt-2">
      {/* Informações adicionais / Pagamento */}
      <div className="w-full sm:w-1/2 text-xs space-y-2">
        {formaPagamento && (
          <div className="p-3 bg-slate-50 rounded border border-slate-200 print:bg-white print:border-slate-300">
            <span className="font-semibold text-slate-700 print:text-black">
              Forma de Pagamento:
            </span>{' '}
            <span className="font-medium text-slate-900 uppercase print:text-black">
              {formaPagamento.replace('_', ' ')}
            </span>
          </div>
        )}
        {observacoesFinanceiras}
      </div>

      {/* Tabela de Totais */}
      <div className="w-full sm:w-64 bg-slate-50 rounded border border-slate-300 p-4 print:bg-white print:border-black">
        <div className="space-y-2 text-xs">
          {showSubtotal && (
            <div className="flex justify-between items-center text-slate-600 print:text-slate-800">
              <span>Subtotal:</span>
              <span className="font-medium text-slate-900 print:text-black tabular-nums">
                {formatCurrency(subtotal)}
              </span>
            </div>
          )}

          {showDesconto && (
            <div className="flex justify-between items-center text-red-600 print:text-black">
              <span>Desconto:</span>
              <span className="font-medium tabular-nums">-{formatCurrency(desconto)}</span>
            </div>
          )}

          <div className="border-t border-slate-300 pt-2.5 mt-2 flex justify-between items-baseline print:border-black">
            <span className="text-sm font-bold uppercase text-slate-900 print:text-black">
              Total:
            </span>
            <span className="text-lg font-black text-slate-900 print:text-black tabular-nums">
              {formatCurrency(total)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
