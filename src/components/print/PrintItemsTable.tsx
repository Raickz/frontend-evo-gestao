import React from 'react'

export interface PrintItem {
  id?: string | number
  nome: string
  codigo?: string | null
  unidade?: string | null
  quantidade: number
  preco_unitario: number
  desconto?: number | null
  subtotal: number
}

interface PrintItemsTableProps {
  itens: PrintItem[]
  precoLabel?: string
  hasDesconto?: boolean
}

const formatCurrency = (val: number | null | undefined): string => {
  return Number(val || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

const formatQuantity = (val: number | null | undefined): string => {
  return Number(val || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })
}

export const PrintItemsTable: React.FC<PrintItemsTableProps> = ({
  itens,
  precoLabel = 'Preço Unit.',
  hasDesconto,
}) => {
  const showDiscountCol =
    hasDesconto !== undefined
      ? hasDesconto
      : itens.some((it) => it.desconto && Number(it.desconto) > 0)

  return (
    <div className="w-full my-6 overflow-hidden rounded border border-slate-300 print:border-black">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="bg-slate-100 text-slate-800 uppercase font-semibold border-b border-slate-300 print:bg-slate-100 print:text-black print:border-black">
            <th className="py-2.5 px-3 w-12 text-center">Item</th>
            <th className="py-2.5 px-3">Produto / Descrição</th>
            <th className="py-2.5 px-3 w-20 text-center">Código</th>
            <th className="py-2.5 px-3 w-14 text-center">UN</th>
            <th className="py-2.5 px-3 w-16 text-right">Qtd</th>
            <th className="py-2.5 px-3 w-24 text-right">{precoLabel}</th>
            {showDiscountCol && <th className="py-2.5 px-3 w-20 text-right">Desc.</th>}
            <th className="py-2.5 px-3 w-28 text-right">Subtotal</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 print:divide-slate-300">
          {itens.length === 0 ? (
            <tr>
              <td
                colSpan={showDiscountCol ? 8 : 7}
                className="py-6 text-center text-slate-500 italic"
              >
                Nenhum item registrado.
              </td>
            </tr>
          ) : (
            itens.map((item, idx) => (
              <tr
                key={item.id || idx}
                className={idx % 2 === 1 ? 'bg-slate-50/70 print:bg-slate-50/50' : 'bg-white'}
              >
                <td className="py-2 px-3 text-center text-slate-500 font-mono text-[11px] print:text-slate-700">
                  {String(idx + 1).padStart(2, '0')}
                </td>
                <td className="py-2 px-3 font-medium text-slate-900 print:text-black">
                  {item.nome}
                </td>
                <td className="py-2 px-3 text-center text-slate-600 font-mono text-[11px] print:text-slate-800">
                  {item.codigo || '-'}
                </td>
                <td className="py-2 px-3 text-center text-slate-600 uppercase text-[11px] print:text-slate-800">
                  {item.unidade || 'UN'}
                </td>
                <td className="py-2 px-3 text-right font-medium text-slate-900 tabular-nums print:text-black">
                  {formatQuantity(item.quantidade)}
                </td>
                <td className="py-2 px-3 text-right text-slate-700 tabular-nums print:text-black">
                  {formatCurrency(item.preco_unitario)}
                </td>
                {showDiscountCol && (
                  <td className="py-2 px-3 text-right text-red-600 tabular-nums print:text-black font-medium">
                    {item.desconto && Number(item.desconto) > 0
                      ? `-${formatCurrency(item.desconto)}`
                      : '-'}
                  </td>
                )}
                <td className="py-2 px-3 text-right font-semibold text-slate-900 tabular-nums print:text-black">
                  {formatCurrency(item.subtotal)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
