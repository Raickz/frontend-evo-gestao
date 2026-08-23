import { supabase } from '@/lib/supabase/client'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/types'

export type Cliente = Tables<'clientes'>
export type ClienteInsert = TablesInsert<'clientes'>
export type ClienteUpdate = TablesUpdate<'clientes'>

export const ClientesService = {
  async list(empresaId: string) {
    return supabase
      .from('clientes')
      .select('*, vendedores(nome)')
      .eq('empresa_id', empresaId)
      .order('nome', { ascending: true })
  },

  async countAtivos(empresaId: string) {
    return supabase
      .from('clientes')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', empresaId)
      .eq('ativo', true)
  },

  async getById(empresaId: string, id: string) {
    return supabase
      .from('clientes')
      .select('*, vendedores(nome)')
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .single()
  },

  async create(empresaId: string, data: Omit<ClienteInsert, 'empresa_id'>) {
    return supabase
      .from('clientes')
      .insert({ ...data, empresa_id: empresaId })
      .select()
      .single()
  },

  async update(empresaId: string, id: string, data: ClienteUpdate) {
    return supabase
      .from('clientes')
      .update(data)
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .select()
      .single()
  },

  async search(empresaId: string, termo: string) {
    const cleanTerm = termo.trim()
    if (!cleanTerm) {
      return this.list(empresaId)
    }
    // Search by nome, documento, or telefone using PostgREST ilike
    return supabase
      .from('clientes')
      .select('*, vendedores(nome)')
      .eq('empresa_id', empresaId)
      .or(`nome.ilike.%${cleanTerm}%,documento.ilike.%${cleanTerm}%,telefone.ilike.%${cleanTerm}%`)
      .order('nome', { ascending: true })
  },

  async toggleAtivo(empresaId: string, id: string, ativo: boolean) {
    return supabase
      .from('clientes')
      .update({ ativo })
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .select()
      .single()
  },
}
