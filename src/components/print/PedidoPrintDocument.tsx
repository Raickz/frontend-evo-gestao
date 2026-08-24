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

interface ItemPedidoData {
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

interface PedidoDocumentProps {
  empresa: EmpresaInfo
  pedido: {
    id: string
    numero: number | string
    status: 'pendente' | 'confirmado' | 'faturado' | 'cancelado' | string
    total: number
    observacoes?: string | null
    created_at?: string
    clientes?: ClienteData | null
    vendedores?: VendedorData | null
    itens_pedido?: ItemPedidoData[]
  }
  vendaRelacionada?: {
    numero?: number | string | null
    id?: string
  } | null
}

const statusLabels: Record<string, { label: string; className: string }> = {
  pendente: {
    label: 'PENDENTE / ORÇAMENTO',
    className: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  confirmado: { label: 'CONFIRMADO', className: 'bg-blue-100 text-blue-800 border-blue-300' },
  faturado: { label: 'FATURADO', className: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  cancelado: { label: 'CANCELADO', className: 'bg-red-100 text-red-800 border-red-300' },
}

export const PedidoPrintDocument: React.FC<PedidoDocumentProps> = ({
  empresa,
  pedido,
  vendaRelacionada,
}) => {
  const isFaturado = pedido.status === 'faturado'
  const documentTitle = isFaturado ? 'PEDIDO FATURADO' : 'PEDIDO / ORÇAMENTO'

  const itensTable: PrintItem[] = (pedido.itens_pedido || []).map((it) => ({
    id: it.id,
    nome: it.produtos?.nome || 'Produto não identificado',
    codigo: it.produtos?.codigo || null,
    unidade: it.produtos?.unidade || 'UN',
    quantidade: Number(it.quantidade || 0),
    preco_unitario: Number(it.preco_unitario || 0),
    desconto: it.desconto ? Number(it.desconto) : 0,
    subtotal: Number(it.subtotal || 0),
  }))

  const totalDesconto = itensTable.reduce((acc, it) => acc + (it.desconto || 0), 0)
  const subtotalCalculado = itensTable.reduce(
    (acc, it) => acc + it.quantidade * it.preco_unitario,
    0,
  )

  const statusInfo = statusLabels[pedido.status] || {
    label: pedido.status.toUpperCase(),
    className: 'bg-slate-100 text-slate-800',
  }

  const enderecoCliente = [
    pedido.clientes?.endereco,
    pedido.clientes?.cidade
      ? `${pedido.clientes.cidade}${pedido.clientes.estado ? ` - ${pedido.clientes.estado}` : ''}`
      : null,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <PrintDocument>
      <PrintCompanyHeader
        empresa={empresa}
        documentTitle={documentTitle}
        numero={pedido.numero}
        dataEmissao={pedido.created_at}
        statusBadge={
          <Badge
            variant="outline"
            className={`${statusInfo.className} font-bold px-2 py-0.5 text-xs print:border-black print:text-black`}
          >
            {statusInfo.label}
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
            {pedido.clientes?.nome || 'Cliente não informado / Balcão'}
          </p>
          {pedido.clientes?.documento && (
            <p className="text-slate-600 print:text-slate-700">
              <span className="font-medium">CPF/CNPJ:</span> {pedido.clientes.documento}
            </p>
          )}
          {pedido.clientes?.telefone && (
            <p className="text-slate-600 print:text-slate-700">
              <span className="font-medium">Telefone:</span> {pedido.clientes.telefone}
            </p>
          )}
          {pedido.clientes?.email && (
            <p className="text-slate-600 print:text-slate-700">
              <span className="font-medium">E-mail:</span> {pedido.clientes.email}
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
            Dados do Atendimento
          </h3>
          <p className="text-slate-700 print:text-black">
            <span className="font-medium">Vendedor / Consultor:</span>{' '}
            <strong className="text-slate-900 print:text-black">
              {pedido.vendedores?.nome || 'Não vinculado'}
            </strong>
          </p>
          {vendaRelacionada && vendaRelacionada.numero && (
            <div className="mt-2 p-2 bg-emerald-50 rounded border border-emerald-200 print:border-black print:bg-white text-emerald-900 print:text-black font-semibold">
              Venda Faturada Gerada: #{String(vendaRelacionada.numero).padStart(6, '0')}
            </div>
          )}
        </div>
      </div>

      {/* Itens */}
      <PrintItemsTable itens={itensTable} precoLabel="Preço Unit." />

      {/* Totais */}
      <PrintTotals
        subtotal={subtotalCalculado > 0 ? subtotalCalculado : Number(pedido.total)}
        desconto={totalDesconto > 0 ? totalDesconto : null}
        total={Number(pedido.total || 0)}
      />

      {/* Rodapé e assinaturas */}
      <PrintFooter
        informacoesAdicionais={pedido.observacoes}
        assinatura1Label="Vendedor / Emitente"
        assinatura2Label="Assinatura do Cliente"
      />
    </PrintDocument>
  )
}
