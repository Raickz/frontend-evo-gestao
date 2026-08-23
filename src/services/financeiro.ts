import { supabase } from '@/lib/supabase/client'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/types'

export type ContaReceber = Tables<'contas_receber'>
export type ContaPagar = Tables<'contas_pagar'>

export const FinanceiroService = {
  async listContasReceber(empresaId: string) {
    return supabase
      .from('contas_receber')
      .select('*, clientes(nome)')
      .eq('empresa_id', empresaId)
      .order('vencimento', { ascending: true })
  },

  async listContasPagar(empresaId: string) {
    return supabase
      .from('contas_pagar')
      .select('*, fornecedores(nome)')
      .eq('empresa_id', empresaId)
      .order('vencimento', { ascending: true })
  },

  async createContaReceber(
    empresaId: string,
    data: Omit<TablesInsert<'contas_receber'>, 'empresa_id'>,
  ) {
    return supabase
      .from('contas_receber')
      .insert({ ...data, empresa_id: empresaId })
      .select()
      .single()
  },

  async createContaPagar(
    empresaId: string,
    data: Omit<TablesInsert<'contas_pagar'>, 'empresa_id'>,
  ) {
    return supabase
      .from('contas_pagar')
      .insert({ ...data, empresa_id: empresaId })
      .select()
      .single()
  },

  async updateContaReceber(empresaId: string, id: string, data: TablesUpdate<'contas_receber'>) {
    return supabase
      .from('contas_receber')
      .update(data)
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .select()
      .single()
  },

  async updateContaPagar(empresaId: string, id: string, data: TablesUpdate<'contas_pagar'>) {
    return supabase
      .from('contas_pagar')
      .update(data)
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .select()
      .single()
  },
}
