import { supabase } from '@/lib/supabase/client'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/types'

export type Vendedor = Tables<'vendedores'>
export type Comissao = Tables<'comissoes'>

export const VendedoresService = {
  async list(empresaId: string) {
    return supabase
      .from('vendedores')
      .select('*, usuarios(nome, email)')
      .eq('empresa_id', empresaId)
      .order('nome', { ascending: true })
  },

  async getById(empresaId: string, id: string) {
    return supabase
      .from('vendedores')
      .select('*, usuarios(nome, email)')
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .single()
  },

  async create(empresaId: string, data: Omit<TablesInsert<'vendedores'>, 'empresa_id'>) {
    return supabase
      .from('vendedores')
      .insert({ ...data, empresa_id: empresaId })
      .select()
      .single()
  },

  async update(empresaId: string, id: string, data: TablesUpdate<'vendedores'>) {
    return supabase
      .from('vendedores')
      .update(data)
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .select()
      .single()
  },

  async listComissoes(empresaId: string) {
    return supabase
      .from('comissoes')
      .select('*, vendedores(nome), vendas(numero, total)')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })
  },
}
