import { supabase } from '@/lib/supabase/client'
import type { Tables, TablesInsert } from '@/lib/supabase/types'

export type Estoque = Tables<'estoques'>
export type MovimentacaoEstoque = Tables<'movimentacoes_estoque'>

export const EstoqueService = {
  async listSaldos(empresaId: string) {
    return supabase
      .from('estoques')
      .select('*, produtos(*, categorias(nome))')
      .eq('empresa_id', empresaId)
  },

  async listMovimentacoes(empresaId: string) {
    return supabase
      .from('movimentacoes_estoque')
      .select('*, produtos(nome, codigo), usuarios(nome)')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })
      .limit(100)
  },

  async registrarEntrada(produtoId: string, quantidade: number, motivo: string) {
    return supabase.rpc('registrar_entrada_estoque', {
      p_produto_id: produtoId,
      p_quantidade: quantidade,
      p_motivo: motivo,
    })
  },

  async registrarMovimentacaoManual(
    empresaId: string,
    data: Omit<TablesInsert<'movimentacoes_estoque'>, 'empresa_id'>,
  ) {
    return supabase
      .from('movimentacoes_estoque')
      .insert({ ...data, empresa_id: empresaId })
      .select()
      .single()
  },
}
