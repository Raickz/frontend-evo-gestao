import React from 'react'
import { PrintDocument } from './PrintDocument'
import { PrintCompanyHeader, EmpresaInfo } from './PrintCompanyHeader'
import { PrintItemsTable, PrintItem } from './PrintItemsTable'
import { PrintTotals } from './PrintTotals'
import { PrintFooter } from './PrintFooter'
import { Badge } from '@/components/ui/badge'

interface FornecedorData {
  nome: string
  documento?: string | null
  telefone?: string | null
  email?: string | null
  endereco?: string | null
  cidade?: string | null
  estado?: string | null
}

interface ItemCompraData {
  id?: string | number
  quantidade: number
  preco_unitario: number
  subtotal: number
  produtos?: {
    nome: string
    codigo?: string | null
    unidade?: string | null
  } | null
}

interface CompraDocumentProps {
  empresa: EmpresaInfo
  compra: {
    id: string
    numero: number | string
    status: 'rascunho' | 'confirmada' | 'cancelada' | string
    total: number
    observacoes?: string | null
    data_compra?: string | null
    forma_pagamento?: string | null
    vencimento?: string | null
    valor_pago?: number | null
    fornecedores?: FornecedorData | null
    itens_compra?: ItemCompraData[]
  }
}

const statusLabels: Record<string, { title: string; badgeLabel: string; className: string }> = {
  confirmada: {
    title: 'COMPRA CONFIRMADA',
    badgeLabel: 'CONFIRMADA',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  rascunho: {
    title: 'RASCUNHO DE COMPRA',
    badgeLabel: 'RASCUNHO',
    className: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  cancelada: {
    title: 'COMPRA CANCELADA',
    badgeLabel: 'CANCELADA',
    className: 'bg-red-100 text-red-800 border-red-300',
  },
}

export const CompraPrintDocument: React.FC<CompraDocumentProps> = ({ empresa, compra }) => {
  const statusMeta = statusLabels[compra.status] || {
    title: `ORDEM DE COMPRA (${compra.status.toUpperCase()})`,
    badgeLabel: compra.status.toUpperCase(),
    className: 'bg-slate-100 text-slate-800',
  }

  const itensTable: PrintItem[] = (compra.itens_compra || []).map((it) => ({
    id: it.id,
    nome: it.produtos?.nome || 'Produto não identificado',
    codigo: it.produtos?.codigo || null,
    unidade: it.produtos?.unidade || 'UN',
    quantidade: Number(it.quantidade || 0),
    preco_unitario: Number(it.preco_unitario || 0),
    subtotal: Number(it.subtotal || 0),
  }))

  const subtotal = itensTable.reduce(
    (acc, it) => acc + (it.subtotal || it.quantidade * it.preco_unitario),
    0,
  )

  const enderecoFornecedor = [
    compra.fornecedores?.endereco,
    compra.fornecedores?.cidade
      ? `${compra.fornecedores.cidade}${compra.fornecedores.estado ? ` - ${compra.fornecedores.estado}` : ''}`
      : null,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <PrintDocument>
      <PrintCompanyHeader
        empresa={empresa}
        documentTitle={statusMeta.title}
        documentSubtitle="Ordem de Compra / Entrada de Mercadoria"
        numero={compra.numero}
        dataEmissao={
          compra.data_compra || (compra as unknown as { created_at?: string }).created_at
        }
        statusBadge={
          <Badge
            variant="outline"
            className={`${statusMeta.className} font-bold px-2 py-0.5 text-xs print:border-black print:text-black`}
          >
            {statusMeta.badgeLabel}
          </Badge>
        }
      />

      {/* Dados do Fornecedor e Condições */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded bg-slate-50 border border-slate-200 print:bg-white print:border-slate-300 text-xs mb-4">
        <div>
          <h3 className="font-bold text-slate-800 uppercase tracking-wide mb-1.5 print:text-black">
            Dados do Fornecedor
          </h3>
          <p className="font-semibold text-slate-900 text-sm print:text-black">
            {compra.fornecedores?.nome || 'Fornecedor não especificado'}
          </p>
          {compra.fornecedores?.documento && (
            <p className="text-slate-600 print:text-slate-700">
              <span className="font-medium">CNPJ/CPF:</span> {compra.fornecedores.documento}
            </p>
          )}
          {compra.fornecedores?.telefone && (
            <p className="text-slate-600 print:text-slate-700">
              <span className="font-medium">Telefone:</span> {compra.fornecedores.telefone}
            </p>
          )}
          {compra.fornecedores?.email && (
            <p className="text-slate-600 print:text-slate-700">
              <span className="font-medium">E-mail:</span> {compra.fornecedores.email}
            </p>
          )}
          {enderecoFornecedor && (
            <p className="text-slate-600 print:text-slate-700">
              <span className="font-medium">Endereço:</span> {enderecoFornecedor}
            </p>
          )}
        </div>

        <div>
          <h3 className="font-bold text-slate-800 uppercase tracking-wide mb-1.5 print:text-black">
            Condições Comerciais
          </h3>
          <p className="text-slate-700 print:text-black">
            <span className="font-medium">Data da Compra:</span>{' '}
            {compra.data_compra
              ? new Date(compra.data_compra).toLocaleDateString('pt-BR')
              : 'Não informada'}
          </p>
          {compra.vencimento && (
            <p className="text-slate-700 mt-1 print:text-black">
              <span className="font-medium">Data de Vencimento:</span>{' '}
              {new Date(compra.vencimento).toLocaleDateString('pt-BR')}
            </p>
          )}
          {compra.forma_pagamento && (
            <p className="text-slate-700 mt-1 print:text-black">
              <span className="font-medium">Forma de Pagamento:</span>{' '}
              <span className="capitalize font-semibold">
                {compra.forma_pagamento.replace('_', ' ')}
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Itens */}
      <PrintItemsTable itens={itensTable} precoLabel="Preço Custo" hasDesconto={false} />

      {/* Totais */}
      <PrintTotals
        subtotal={subtotal > 0 ? subtotal : Number(compra.total)}
        total={Number(compra.total || 0)}
        formaPagamento={compra.forma_pagamento}
      />

      {/* Rodapé e assinaturas */}
      <PrintFooter
        informacoesAdicionais={compra.observacoes}
        assinatura1Label="Responsável pela Compra"
        assinatura2Label="Assinatura / Recebimento do Fornecedor"
      />
    </PrintDocument>
  )
}
