import { supabase } from '@/lib/supabase/client'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/types'

export type Pedido = Tables<'pedidos'>
export type ItemPedido = Tables<'itens_pedido'>

export const PedidosService = {
  async list(empresaId: string) {
    return supabase
      .from('pedidos')
      .select('*, clientes(nome, documento), vendedores(nome)')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })
  },

  async getById(empresaId: string, id: string) {
    return supabase
      .from('pedidos')
      .select('*, clientes(*), vendedores(*), itens_pedido(*, produtos(*))')
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .single()
  },

  async create(empresaId: string, data: Omit<TablesInsert<'pedidos'>, 'empresa_id' | 'numero'>) {
    return supabase
      .from('pedidos')
      .insert({ ...data, empresa_id: empresaId })
      .select()
      .single()
  },

  async updateStatus(empresaId: string, id: string, status: string) {
    return supabase
      .from('pedidos')
      .update({ status })
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .select()
      .single()
  },
}
