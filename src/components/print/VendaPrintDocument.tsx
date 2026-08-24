import React from 'react'
import { PrintDocument } from './PrintDocument'
import { PrintCompanyHeader, EmpresaInfo } from './PrintCompanyHeader'
import { PrintItemsTable, PrintItem } from './PrintItemsTable'
import { PrintTotals } from './PrintTotals'
import { PrintFooter } from './PrintFooter'
import { Badge } from '@/components/ui/badge'

interface ClienteData {
  nome: string
  documento?: string | null
  telefone?: string | null
  email?: string | null
  endereco?: string | null
  cidade?: string | null
  estado?: string | null
}

interface VendedorData {
  nome: string
}

interface ItemVendaData {
  id?: string | number
  quantidade: number
  preco_unitario: number
  desconto?: number | null
  subtotal: number
  produtos?: {
    nome: string
    codigo?: string | null
    unidade?: string | null
  } | null
}

interface ContaReceberData {
  id?: string
  valor?: number
  valor_pago?: number | null
  vencimento?: string | null
  status?: string | null
}

interface VendaDocumentProps {
  empresa: EmpresaInfo
  venda: {
    id: string
    numero: number | string
    status: 'finalizada' | string
    subtotal?: number | null
    desconto?: number | null
    total: number
    forma_pagamento?: string | null
    observacoes?: string | null
    created_at?: string
    pedido_id?: string | null
    clientes?: ClienteData | null
    vendedores?: VendedorData | null
    itens_venda?: ItemVendaData[]
    pedidos?: {
      numero?: number | string | null
    } | null
  }
  contasReceber?: ContaReceberData[] | null
}

const formatCurrency = (val: number | null | undefined): string => {
  return Number(val || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export const VendaPrintDocument: React.FC<VendaDocumentProps> = ({
  empresa,
  venda,
  contasReceber,
}) => {
  const itensTable: PrintItem[] = (venda.itens_venda || []).map((it) => ({
    id: it.id,
    nome: it.produtos?.nome || 'Produto não identificado',
    codigo: it.produtos?.codigo || null,
    unidade: it.produtos?.unidade || 'UN',
    quantidade: Number(it.quantidade || 0),
    preco_unitario: Number(it.preco_unitario || 0),
    desconto: it.desconto ? Number(it.desconto) : 0,
    subtotal: Number(it.subtotal || 0),
  }))

  const totalDesconto =
    venda.desconto !== undefined && venda.desconto !== null
      ? Number(venda.desconto)
      : itensTable.reduce((acc, it) => acc + (it.desconto || 0), 0)

  const subtotal =
    venda.subtotal !== undefined && venda.subtotal !== null
      ? Number(venda.subtotal)
      : itensTable.reduce((acc, it) => acc + it.quantidade * it.preco_unitario, 0)

  const isFiado = venda.forma_pagamento === 'fiado' || venda.forma_pagamento === 'a_prazo'
  const primaryConta = contasReceber && contasReceber.length > 0 ? contasReceber[0] : null

  const enderecoCliente = [
    venda.clientes?.endereco,
    venda.clientes?.cidade
      ? `${venda.clientes.cidade}${venda.clientes.estado ? ` - ${venda.clientes.estado}` : ''}`
      : null,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <PrintDocument>
      <PrintCompanyHeader
        empresa={empresa}
        documentTitle="COMPROVANTE DE VENDA"
        documentSubtitle="Cupom Não-Fiscal / Recibo de Entrega"
        numero={venda.numero}
        dataEmissao={venda.created_at}
        statusBadge={
          <Badge
            variant="outline"
            className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold px-2 py-0.5 text-xs print:border-black print:text-black"
          >
            FINALIZADA
          </Badge>
        }
      />

      {/* Dados do Cliente e Vendedor */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded bg-slate-50 border border-slate-200 print:bg-white print:border-slate-300 text-xs mb-4">
        <div>
          <h3 className="font-bold text-slate-800 uppercase tracking-wide mb-1.5 print:text-black">
            Dados do Cliente
          </h3>
          <p className="font-semibold text-slate-900 text-sm print:text-black">
            {venda.clientes?.nome || 'Consumidor Final / Balcão'}
          </p>
          {venda.clientes?.documento && (
            <p className="text-slate-600 print:text-slate-700">
              <span className="font-medium">CPF/CNPJ:</span> {venda.clientes.documento}
            </p>
          )}
          {venda.clientes?.telefone && (
            <p className="text-slate-600 print:text-slate-700">
              <span className="font-medium">Telefone:</span> {venda.clientes.telefone}
            </p>
          )}
          {venda.clientes?.email && (
            <p className="text-slate-600 print:text-slate-700">
              <span className="font-medium">E-mail:</span> {venda.clientes.email}
            </p>
          )}
          {enderecoCliente && (
            <p className="text-slate-600 print:text-slate-700">
              <span className="font-medium">Endereço:</span> {enderecoCliente}
            </p>
          )}
        </div>

        <div>
          <h3 className="font-bold text-slate-800 uppercase tracking-wide mb-1.5 print:text-black">
            Dados da Venda
          </h3>
          <p className="text-slate-700 print:text-black">
            <span className="font-medium">Vendedor:</span>{' '}
            <strong className="text-slate-900 print:text-black">
              {venda.vendedores?.nome || 'Venda Direta / PDV'}
            </strong>
          </p>
          {venda.pedidos?.numero && (
            <p className="text-slate-700 mt-1 print:text-black">
              <span className="font-medium">Origem:</span>{' '}
              <span className="font-semibold text-teal-800 print:text-black">
                Pedido #{String(venda.pedidos.numero).padStart(6, '0')}
              </span>
            </p>
          )}
          {venda.pedido_id && !venda.pedidos?.numero && (
            <p className="text-slate-700 mt-1 print:text-black">
              <span className="font-medium">Origem:</span> Pedido Vinculado
            </p>
          )}
        </div>
      </div>

      {/* Itens */}
      <PrintItemsTable itens={itensTable} precoLabel="Preço Venda" />

      {/* Totais & Detalhes de Pagamento */}
      <PrintTotals
        subtotal={subtotal > 0 ? subtotal : Number(venda.total)}
        desconto={totalDesconto > 0 ? totalDesconto : null}
        total={Number(venda.total || 0)}
        formaPagamento={venda.forma_pagamento || 'Não especificada'}
        observacoesFinanceiras={
          isFiado ? (
            <div className="p-2.5 bg-amber-50 rounded border border-amber-200 print:bg-white print:border-black text-amber-900 print:text-black space-y-1">
              <p className="font-bold text-xs uppercase">Venda a Prazo / Fiado</p>
              {primaryConta?.vencimento && (
                <p>
                  <span className="font-medium">Vencimento:</span>{' '}
                  {new Date(primaryConta.vencimento).toLocaleDateString('pt-BR')}
                </p>
              )}
              {primaryConta?.valor_pago !== undefined && primaryConta?.valor_pago !== null && (
                <p>
                  <span className="font-medium">Valor Pago:</span>{' '}
                  {formatCurrency(primaryConta.valor_pago)} (Saldo restante:{' '}
                  {formatCurrency(Number(venda.total) - Number(primaryConta.valor_pago))})
                </p>
              )}
            </div>
          ) : null
        }
      />

      {/* Rodapé e assinaturas */}
      <PrintFooter
        informacoesAdicionais={venda.observacoes}
        assinatura1Label="Assinatura do Vendedor"
        assinatura2Label="Assinatura do Cliente"
      />
    </PrintDocument>
  )
}
