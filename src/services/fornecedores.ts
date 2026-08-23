import { supabase } from '@/lib/supabase/client'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/types'

export type Fornecedor = Tables<'fornecedores'>
export type FornecedorInsert = TablesInsert<'fornecedores'>
export type FornecedorUpdate = TablesUpdate<'fornecedores'>

export const FornecedoresService = {
  async list(empresaId: string) {
    return supabase
      .from('fornecedores')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('nome', { ascending: true })
  },

  async search(empresaId: string, termo: string) {
    const cleanTerm = termo.trim()
    if (!cleanTerm) return this.list(empresaId)
    return supabase
      .from('fornecedores')
      .select('*')
      .eq('empresa_id', empresaId)
      .or(`nome.ilike.%${cleanTerm}%,documento.ilike.%${cleanTerm}%,telefone.ilike.%${cleanTerm}%`)
      .order('nome', { ascending: true })
  },

  async create(empresaId: string, data: Omit<FornecedorInsert, 'empresa_id'>) {
    return supabase
      .from('fornecedores')
      .insert({ ...data, empresa_id: empresaId })
      .select()
      .single()
  },

  async update(empresaId: string, id: string, data: FornecedorUpdate) {
    return supabase
      .from('fornecedores')
      .update(data)
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .select()
      .single()
  },

  async toggleAtivo(empresaId: string, id: string, ativo: boolean) {
    return supabase
      .from('fornecedores')
      .update({ ativo })
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .select()
      .single()
  },
}
