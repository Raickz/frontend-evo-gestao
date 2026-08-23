import { supabase } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/types'

export type Venda = Tables<'vendas'>
export type ItemVenda = Tables<'itens_venda'>

export interface FinalizarVendaPayloadItem {
  produto_id: string
  quantidade: number
  preco_unitario: number
  desconto?: number
}

export const VendasService = {
  async list(empresaId: string) {
    return supabase
      .from('vendas')
      .select('*, clientes(nome, documento), vendedores(nome), usuarios(nome)')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })
  },

  async getById(empresaId: string, id: string) {
    return supabase
      .from('vendas')
      .select('*, clientes(*), vendedores(*), itens_venda(*, produtos(*))')
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .single()
  },

  async finalizarVendaViaRpc(params: {
    clienteId: string
    vendedorId: string
    itens: FinalizarVendaPayloadItem[]
    desconto?: number
    formaPagamento?: string
    vencimento?: string
    observacoes?: string
  }) {
    return supabase.rpc('finalizar_venda', {
      p_cliente_id: params.clienteId,
      p_vendedor_id: params.vendedorId,
      p_itens: params.itens as any,
      p_desconto: params.desconto || 0,
      p_forma_pagamento: params.formaPagamento || 'pix',
      p_vencimento: params.vencimento,
      p_observacoes: params.observacoes,
    })
  },
}
